"""
FinAI Edge — Market Data Provider: Finnhub
=============================================
Tertiary fallback provider via Finnhub REST API.
Requires FINNHUB_API_KEY in environment.
"""

import logging
import httpx
from datetime import datetime, timedelta
from typing import Optional
from .base import MarketDataProvider, StockQuote, Instrument, Candle

log = logging.getLogger("finai_edge.finnhub")

FINNHUB_BASE = "https://finnhub.io/api/v1"

# Period to seconds mapping for candle resolution
PERIOD_MAP = {
    "1mo": 30,
    "3mo": 90,
    "6mo": 180,
    "1y": 365,
    "2y": 730,
    "5y": 1825,
}


class FinnhubProvider(MarketDataProvider):
    """Market data via Finnhub REST API (requires API key)."""

    def __init__(self, api_key: str):
        self._api_key = api_key

    @property
    def name(self) -> str:
        return "finnhub"

    def _params(self, **kwargs) -> dict:
        """Add API token to request params."""
        return {"token": self._api_key, **kwargs}

    @staticmethod
    def _to_finnhub_symbol(symbol: str) -> str:
        """Convert yfinance-style symbol to Finnhub format.
        Finnhub uses 'RELIANCE.NS' as-is for NSE stocks.
        """
        sym = symbol.strip().upper()
        if "." not in sym:
            return f"{sym}.NS"
        return sym

    async def is_available(self) -> bool:
        """Ping Finnhub to check availability."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    f"{FINNHUB_BASE}/quote",
                    params=self._params(symbol="AAPL"),
                )
                return resp.status_code == 200
        except Exception:
            return False

    async def get_quote(self, symbol: str) -> StockQuote:
        """Fetch live quote from Finnhub."""
        try:
            fh_symbol = self._to_finnhub_symbol(symbol)

            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    f"{FINNHUB_BASE}/quote",
                    params=self._params(symbol=fh_symbol),
                )

                if resp.status_code == 200:
                    data = resp.json()
                    current = data.get("c", 0)
                    prev_close = data.get("pc", 0)

                    if current and current > 0:
                        change = current - prev_close if prev_close else 0
                        change_pct = (change / prev_close * 100) if prev_close else 0

                        return StockQuote(
                            ticker=symbol,
                            price=round(current, 2),
                            change=round(change, 2),
                            change_pct=round(change_pct, 2),
                            high=data.get("h"),
                            low=data.get("l"),
                            prev_close=round(prev_close, 2) if prev_close else None,
                            available=True,
                            source="finnhub",
                        )
        except Exception as e:
            log.warning(f"Finnhub quote failed for {symbol}: {e}")

        return StockQuote(ticker=symbol, available=False, source="finnhub")

    async def search_instruments(self, query: str, limit: int = 12) -> list[Instrument]:
        """Search instruments via Finnhub symbol lookup."""
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    f"{FINNHUB_BASE}/search",
                    params=self._params(q=query),
                )

                if resp.status_code == 200:
                    data = resp.json()
                    results = []
                    for item in data.get("result", [])[:limit]:
                        results.append(Instrument(
                            ticker=item.get("symbol", ""),
                            name=item.get("description", ""),
                            sector="Other",
                            exchange=item.get("displaySymbol", "NSE"),
                            instrument_type=item.get("type", "equity").lower(),
                        ))
                    return results
        except Exception as e:
            log.warning(f"Finnhub search failed: {e}")

        return []

    async def get_historical_candles(
        self,
        symbol: str,
        interval: str = "1d",
        period: str = "1y",
    ) -> list[Candle]:
        """Fetch historical candles from Finnhub stock/candle endpoint."""
        try:
            fh_symbol = self._to_finnhub_symbol(symbol)

            # Map period to from/to timestamps
            days = PERIOD_MAP.get(period, 365)
            to_ts = int(datetime.now().timestamp())
            from_ts = int((datetime.now() - timedelta(days=days)).timestamp())

            # Map interval to Finnhub resolution
            resolution_map = {
                "1m": "1", "5m": "5", "15m": "15", "30m": "30",
                "1h": "60", "1d": "D", "1wk": "W", "1mo": "M",
            }
            resolution = resolution_map.get(interval, "D")

            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{FINNHUB_BASE}/stock/candle",
                    params=self._params(
                        symbol=fh_symbol,
                        resolution=resolution,
                        **{"from": from_ts, "to": to_ts},
                    ),
                )

                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("s") != "ok":
                        return []

                    timestamps = data.get("t", [])
                    opens = data.get("o", [])
                    highs = data.get("h", [])
                    lows = data.get("l", [])
                    closes = data.get("c", [])
                    volumes = data.get("v", [])

                    candles = []
                    for i in range(len(timestamps)):
                        candles.append(Candle(
                            timestamp=datetime.fromtimestamp(timestamps[i]).isoformat(),
                            open=round(float(opens[i]), 2),
                            high=round(float(highs[i]), 2),
                            low=round(float(lows[i]), 2),
                            close=round(float(closes[i]), 2),
                            volume=int(volumes[i]) if i < len(volumes) else 0,
                        ))
                    return candles
        except Exception as e:
            log.warning(f"Finnhub candles failed for {symbol}: {e}")

        return []
