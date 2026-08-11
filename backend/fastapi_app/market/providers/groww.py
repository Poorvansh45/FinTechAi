"""
FinAI Edge — Market Data Provider: Groww
==========================================
Primary provider for Indian market data (requires Groww Trading API access).
All blocking HTTP calls are wrapped in asyncio.to_thread().

If Groww credentials are not configured, this provider is not loaded.
The fallback chain then becomes:  yfinance → Finnhub

COPY TO: backend/fastapi_app/market/providers/groww.py
"""

import asyncio
import logging
import time

from .base import Candle, Instrument, MarketDataProvider, StockQuote

log = logging.getLogger("finai_edge.groww")

# Groww API base URL
GROWW_API_BASE = "https://groww.in/v1/api"

# Request timeout for individual Groww API calls
GROWW_TIMEOUT = 10.0


def _sync_groww_quote(symbol: str, api_key: str) -> dict | None:
    """
    Synchronous Groww quote fetch.
    Runs in thread pool via asyncio.to_thread().

    NOTE: The actual Groww Trading API endpoint and authentication
    flow depends on your specific API access level and credentials.
    This implementation uses the public Groww quote endpoint pattern.
    Replace with your actual endpoint if different.
    """
    try:
        import httpx

        # Convert NSE ticker to Groww format (remove .NS suffix)
        groww_symbol = symbol.upper().replace(".NS", "").replace(".BO", "")

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "FinAI-Edge/2.0",
        }

        with httpx.Client(timeout=GROWW_TIMEOUT) as client:
            resp = client.get(
                f"{GROWW_API_BASE}/stocks/instruments/search/nse/{groww_symbol}",
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

        if not data:
            return None

        # Parse Groww response format
        stock = data[0] if isinstance(data, list) else data
        ltp = stock.get("ltp") or stock.get("lastTradedPrice")
        if not ltp:
            return None

        prev_close = stock.get("previousClose", ltp)
        change = float(ltp) - float(prev_close)
        change_pct = (change / float(prev_close) * 100) if prev_close else 0

        return {
            "price": round(float(ltp), 2),
            "change": round(change, 2),
            "change_pct": round(change_pct, 2),
            "high": round(float(stock.get("dayHigh", ltp)), 2),
            "low": round(float(stock.get("dayLow", ltp)), 2),
            "prev_close": round(float(prev_close), 2),
            "volume": int(stock.get("volume", 0)),
            "available": True,
        }
    except Exception as e:
        log.warning(f"Groww quote sync call failed for {symbol}: {e}")
        return None


class GrowwProvider(MarketDataProvider):
    """
    Groww Trading API market data provider.
    Primary provider when credentials are configured.

    All network calls are non-blocking (asyncio.to_thread wrapper).
    """

    def __init__(self, api_key: str, api_secret: str):
        self._api_key = api_key
        self._api_secret = api_secret

    @property
    def name(self) -> str:
        return "groww"

    async def get_quote(self, symbol: str) -> StockQuote:
        """Fetch live quote from Groww (non-blocking)."""
        start = time.time()
        try:
            data = await asyncio.wait_for(
                asyncio.to_thread(_sync_groww_quote, symbol, self._api_key),
                timeout=GROWW_TIMEOUT + 2.0,
            )
            elapsed = time.time() - start

            if data and data.get("available"):
                log.debug(f"Groww quote {symbol}: ₹{data['price']} ({elapsed:.2f}s)")
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
                    source="groww",
                )
            else:
                log.debug(f"Groww quote unavailable for {symbol} ({elapsed:.2f}s)")
        except asyncio.TimeoutError:
            elapsed = time.time() - start
            log.warning(f"Groww quote timed out for {symbol} ({elapsed:.2f}s)")
        except Exception as e:
            elapsed = time.time() - start
            log.warning(f"Groww quote failed for {symbol} ({elapsed:.2f}s): {e}")

        return StockQuote(ticker=symbol, available=False, source="groww")

    async def search_instruments(self, query: str, limit: int = 12) -> list[Instrument]:
        """
        Search Groww instruments.
        Falls back to local NSE database (fast, offline).
        """
        from utils.helpers import search_stocks

        results = search_stocks(query, limit)
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
        """
        Historical candles from Groww.
        Falls back to empty list — yfinance handles candles better.
        """
        log.debug(f"Groww candles not implemented — use yfinance for {symbol}")
        return []
