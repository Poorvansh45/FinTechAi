"""
FinAI Edge — Market Data Provider: yfinance (Default)
=======================================================
Fallback provider using yfinance. No API key required.

IMPORTANT: yfinance is a synchronous library. All blocking calls
are wrapped in asyncio.to_thread() to prevent event loop blocking.
"""

import asyncio
import logging
import time
import yfinance as yf
import pandas as pd
from typing import Optional
from .base import MarketDataProvider, StockQuote, Instrument, Candle
from utils.helpers import search_stocks as search_nse_stocks, validate_ticker_format

log = logging.getLogger("finai_edge.yfinance")


# ── Synchronous helpers (run in thread pool) ────────────────────────

def _format_symbol_for_yf(symbol: str) -> str:
    """Ensure symbol has .NS suffix for NSE stocks."""
    if "." not in symbol:
        return f"{symbol}.NS"
    return symbol

def _sync_get_quote(symbol: str) -> dict:
    """Synchronous quote fetch — runs in thread pool via asyncio.to_thread()."""
    yf_symbol = _format_symbol_for_yf(symbol)
    ticker = yf.Ticker(yf_symbol)
    info = ticker.fast_info

    price = getattr(info, "last_price", None)
    prev_close = getattr(info, "previous_close", None)
    day_high = getattr(info, "day_high", None)
    day_low = getattr(info, "day_low", None)
    volume = getattr(info, "last_volume", None)

    if price and price > 0:
        change = (price - prev_close) if prev_close else 0
        change_pct = (change / prev_close * 100) if prev_close else 0
        return {
            "price": round(price, 2),
            "change": round(change, 2),
            "change_pct": round(change_pct, 2),
            "high": round(day_high, 2) if day_high else None,
            "low": round(day_low, 2) if day_low else None,
            "prev_close": round(prev_close, 2) if prev_close else None,
            "volume": int(volume) if volume else None,
            "available": True,
        }
    return {"available": False}


def _sync_get_candles(symbol: str, interval: str, period: str) -> list[dict]:
    """Synchronous candle fetch — runs in thread pool."""
    yf_symbol = _format_symbol_for_yf(symbol)
    ticker = yf.Ticker(yf_symbol)
    hist = ticker.history(period=period, interval=interval)

    if hist.empty:
        return []

    candles = []
    for idx, row in hist.iterrows():
        candles.append({
            "timestamp": idx.isoformat(),
            "open": round(float(row["Open"]), 2),
            "high": round(float(row["High"]), 2),
            "low": round(float(row["Low"]), 2),
            "close": round(float(row["Close"]), 2),
            "volume": int(row.get("Volume", 0)),
        })
    return candles


def _sync_bulk_download(tickers: list[str], period: str) -> pd.DataFrame:
    """Synchronous bulk download — runs in thread pool."""
    yf_tickers = [_format_symbol_for_yf(t) for t in tickers]
    raw = yf.download(
        yf_tickers,
        period=period,
        auto_adjust=True,
        progress=False,
        threads=True,
    )

    if raw.empty:
        return pd.DataFrame()

    if isinstance(raw.columns, pd.MultiIndex):
        prices = raw["Close"]
    else:
        prices = raw[["Close"]] if "Close" in raw.columns else raw
        if len(tickers) == 1:
            prices.columns = yf_tickers

    # Rename columns back to original tickers to avoid breaking downstream
    rename_map = {yf_t: t for yf_t, t in zip(yf_tickers, tickers)}
    prices = prices.rename(columns=rename_map)

    return prices.copy().dropna(how="all").ffill().bfill()


# ── Async Provider ──────────────────────────────────────────────────

class YFinanceProvider(MarketDataProvider):
    """
    Market data via yfinance (no API key needed).

    All yfinance calls are synchronous and use network I/O internally.
    We wrap them in asyncio.to_thread() to avoid blocking the FastAPI
    event loop, keeping the server responsive during data fetches.
    """

    @property
    def name(self) -> str:
        return "yfinance"

    async def get_quote(self, symbol: str) -> StockQuote:
        """Fetch live quote from Yahoo Finance (non-blocking)."""
        start = time.time()
        try:
            data = await asyncio.to_thread(_sync_get_quote, symbol)
            elapsed = time.time() - start

            if data.get("available"):
                log.debug(f"yfinance quote {symbol}: ₹{data['price']} ({elapsed:.2f}s)")
                return StockQuote(
                    ticker=symbol,
                    price=data["price"],
                    change=data["change"],
                    change_pct=data["change_pct"],
                    high=data.get("high"),
                    low=data.get("low"),
                    prev_close=data.get("prev_close"),
                    volume=data.get("volume"),
                    available=True,
                    source="yfinance",
                )
            else:
                log.warning(f"yfinance quote unavailable for {symbol} ({elapsed:.2f}s)")
        except Exception as e:
            elapsed = time.time() - start
            log.warning(f"yfinance quote failed for {symbol} ({elapsed:.2f}s): {e}")

        return StockQuote(
            ticker=symbol,
            available=False,
            source="yfinance",
        )

    async def search_instruments(self, query: str, limit: int = 12) -> list[Instrument]:
        """Search curated NSE stock database (local, no network call)."""
        results = search_nse_stocks(query, limit)
        return [
            Instrument(
                ticker=s["ticker"],
                name=s["name"],
                sector=s["sector"],
                exchange="NSE",
                instrument_type="equity",
            )
            for s in results
        ]

    async def get_historical_candles(
        self,
        symbol: str,
        interval: str = "1d",
        period: str = "1y",
    ) -> list[Candle]:
        """Fetch historical OHLCV data from Yahoo Finance (non-blocking)."""
        start = time.time()
        try:
            raw_candles = await asyncio.to_thread(
                _sync_get_candles, symbol, interval, period
            )
            elapsed = time.time() - start

            if not raw_candles:
                log.debug(f"yfinance candles empty for {symbol} ({elapsed:.2f}s)")
                return []

            log.debug(f"yfinance candles {symbol}: {len(raw_candles)} points ({elapsed:.2f}s)")
            return [Candle(**c) for c in raw_candles]
        except Exception as e:
            elapsed = time.time() - start
            log.warning(f"yfinance candles failed for {symbol} ({elapsed:.2f}s): {e}")
            return []

    async def get_bulk_prices(self, tickers: list[str], period: str = "2y") -> pd.DataFrame:
        """
        Bulk download adjusted close prices for portfolio analysis (non-blocking).
        Returns a DataFrame with ticker columns and date index.
        """
        if not tickers:
            return pd.DataFrame()

        valid_tickers = [t for t in tickers if validate_ticker_format(t)]
        if not valid_tickers:
            log.warning("No valid tickers for bulk download")
            return pd.DataFrame()

        start = time.time()
        try:
            prices = await asyncio.to_thread(
                _sync_bulk_download, valid_tickers, period
            )
            elapsed = time.time() - start

            if prices.empty:
                log.warning(f"yfinance bulk download returned empty ({elapsed:.2f}s)")
            else:
                log.info(
                    f"yfinance bulk download: {len(prices)} days × "
                    f"{len(prices.columns)} tickers ({elapsed:.2f}s)"
                )

            return prices
        except Exception as e:
            elapsed = time.time() - start
            log.error(f"yfinance bulk download failed ({elapsed:.2f}s): {e}")
            return pd.DataFrame()
