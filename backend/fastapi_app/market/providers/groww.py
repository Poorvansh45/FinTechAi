"""
FinAI Edge — Market Data Provider: Groww
==========================================
Groww Trading API integration (requires paid subscription).
Activated only when GROWW_API_KEY is configured.
"""

import logging
import httpx
from typing import Optional
from .base import MarketDataProvider, StockQuote, Instrument, Candle

log = logging.getLogger("finai_edge.groww")

GROWW_BASE_URL = "https://api.groww.in"


class GrowwProvider(MarketDataProvider):
    """Market data via Groww Trading API."""

    def __init__(self, api_key: str, api_secret: str):
        self._api_key = api_key
        self._api_secret = api_secret
        self._access_token: Optional[str] = None

    @property
    def name(self) -> str:
        return "groww"

    def _headers(self) -> dict:
        """Build request headers with auth."""
        headers = {
            "Content-Type": "application/json",
            "x-api-key": self._api_key,
        }
        if self._access_token:
            headers["Authorization"] = f"Bearer {self._access_token}"
        return headers

    async def is_available(self) -> bool:
        """Check if Groww API is reachable."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    f"{GROWW_BASE_URL}/v1/health",
                    headers=self._headers(),
                )
                return resp.status_code == 200
        except Exception:
            return False

    async def get_quote(self, symbol: str) -> StockQuote:
        """Fetch LTP from Groww API."""
        try:
            # Map NSE ticker format to Groww format
            groww_symbol = self._to_groww_symbol(symbol)

            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    f"{GROWW_BASE_URL}/v1/quote/ltp",
                    params={"symbol": groww_symbol, "exchange": "NSE"},
                    headers=self._headers(),
                )

                if resp.status_code == 200:
                    data = resp.json()
                    return StockQuote(
                        ticker=symbol,
                        price=data.get("ltp"),
                        change=data.get("change"),
                        change_pct=data.get("changePct"),
                        high=data.get("high"),
                        low=data.get("low"),
                        prev_close=data.get("previousClose"),
                        volume=data.get("volume"),
                        available=True,
                        source="groww",
                    )
        except Exception as e:
            log.warning(f"Groww quote failed for {symbol}: {e}")

        return StockQuote(ticker=symbol, available=False, source="groww")

    async def search_instruments(self, query: str, limit: int = 12) -> list[Instrument]:
        """Search instruments via Groww API."""
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    f"{GROWW_BASE_URL}/v1/search/instruments",
                    params={"q": query, "limit": limit},
                    headers=self._headers(),
                )

                if resp.status_code == 200:
                    data = resp.json()
                    return [
                        Instrument(
                            ticker=item.get("tradingSymbol", ""),
                            name=item.get("companyName", ""),
                            sector=item.get("sector", "Other"),
                            exchange=item.get("exchange", "NSE"),
                            instrument_type=item.get("instrumentType", "equity"),
                        )
                        for item in data.get("results", [])[:limit]
                    ]
        except Exception as e:
            log.warning(f"Groww search failed: {e}")

        return []

    async def get_historical_candles(
        self,
        symbol: str,
        interval: str = "1d",
        period: str = "1y",
    ) -> list[Candle]:
        """Fetch historical candles from Groww."""
        try:
            groww_symbol = self._to_groww_symbol(symbol)

            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{GROWW_BASE_URL}/v1/historical/candles",
                    params={
                        "symbol": groww_symbol,
                        "exchange": "NSE",
                        "interval": interval,
                        "period": period,
                    },
                    headers=self._headers(),
                )

                if resp.status_code == 200:
                    data = resp.json()
                    return [
                        Candle(
                            timestamp=c.get("timestamp", ""),
                            open=c.get("open", 0),
                            high=c.get("high", 0),
                            low=c.get("low", 0),
                            close=c.get("close", 0),
                            volume=c.get("volume", 0),
                        )
                        for c in data.get("candles", [])
                    ]
        except Exception as e:
            log.warning(f"Groww candles failed for {symbol}: {e}")

        return []

    async def get_holdings(self) -> list[dict]:
        """Fetch user's holdings from Groww (requires user auth)."""
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    f"{GROWW_BASE_URL}/v1/holdings/user",
                    headers=self._headers(),
                )

                if resp.status_code == 200:
                    data = resp.json()
                    return data.get("holdings", [])
        except Exception as e:
            log.warning(f"Groww holdings fetch failed: {e}")

        return []

    @staticmethod
    def _to_groww_symbol(symbol: str) -> str:
        """Convert yfinance-style symbol (RELIANCE.NS) to Groww format (RELIANCE)."""
        return symbol.replace(".NS", "").replace(".BO", "").strip().upper()
