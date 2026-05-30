"""
FinAI Edge — Market Data Provider: Abstract Base
===================================================
Provider pattern for pluggable market data sources.
"""

from abc import ABC, abstractmethod
from typing import Optional
from pydantic import BaseModel


class StockQuote(BaseModel):
    """Standardized stock quote across all providers."""
    ticker: str
    price: Optional[float] = None
    change: Optional[float] = None
    change_pct: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    prev_close: Optional[float] = None
    volume: Optional[int] = None
    available: bool = True
    source: str = "unknown"


class Instrument(BaseModel):
    """Standardized instrument search result."""
    ticker: str
    name: str
    sector: str = "Other"
    exchange: str = "NSE"
    instrument_type: str = "equity"


class Candle(BaseModel):
    """OHLCV candle data point."""
    timestamp: str
    open: float
    high: float
    low: float
    close: float
    volume: int = 0


class MarketDataProvider(ABC):
    """Abstract market data provider interface."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider name for logging."""
        ...

    @abstractmethod
    async def get_quote(self, symbol: str) -> StockQuote:
        """Get live quote for a symbol."""
        ...

    @abstractmethod
    async def search_instruments(self, query: str, limit: int = 12) -> list[Instrument]:
        """Search for instruments by name/ticker."""
        ...

    @abstractmethod
    async def get_historical_candles(
        self,
        symbol: str,
        interval: str = "1d",
        period: str = "1y",
    ) -> list[Candle]:
        """Get historical OHLCV candles."""
        ...

    async def is_available(self) -> bool:
        """Check if provider is configured and reachable."""
        return True
