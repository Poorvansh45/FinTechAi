"""
FinAI Edge — Market Data Provider Base
=========================================
Abstract base class and shared data models for all market data providers.

COPY TO: backend/fastapi_app/market/providers/base.py
"""

from abc import ABC, abstractmethod
from typing import Optional
from pydantic import BaseModel


# ── Data Models ────────────────────────────────────────────────────

class StockQuote(BaseModel):
    """Normalised quote across all providers."""
    ticker:     str
    price:      Optional[float] = None
    change:     Optional[float] = None
    change_pct: Optional[float] = None
    high:       Optional[float] = None
    low:        Optional[float] = None
    prev_close: Optional[float] = None
    volume:     Optional[int]   = None
    market_cap: Optional[float] = None
    pe_ratio:   Optional[float] = None
    available:  bool = False
    source:     str = "unknown"


class Instrument(BaseModel):
    """Search result instrument."""
    ticker:          str
    name:            str
    sector:          str = "Other"
    exchange:        str = "NSE"
    instrument_type: str = "equity"


class Candle(BaseModel):
    """OHLCV candle."""
    timestamp: str
    open:      float
    high:      float
    low:       float
    close:     float
    volume:    int = 0


# ── Abstract Provider ──────────────────────────────────────────────

class MarketDataProvider(ABC):
    """
    Abstract base class for all market data providers.
    Each concrete provider (yfinance, Groww, Finnhub) must implement these methods.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider identifier (used in logging and status reports)."""
        ...

    @abstractmethod
    async def get_quote(self, symbol: str) -> StockQuote:
        """Fetch live quote for a single symbol."""
        ...

    @abstractmethod
    async def search_instruments(self, query: str, limit: int = 12) -> list[Instrument]:
        """Search for instruments matching a query string."""
        ...

    @abstractmethod
    async def get_historical_candles(
        self,
        symbol: str,
        interval: str = "1d",
        period: str = "1y",
    ) -> list[Candle]:
        """Fetch historical OHLCV candles."""
        ...
