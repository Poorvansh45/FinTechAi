"""
FinAI Edge — Screener Models
=============================
Pydantic schemas for the screener cache and smart watchlists.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class IndicatorData(BaseModel):
    rsi_14: float | None = None
    ema_20: float | None = None
    ema_50: float | None = None
    macd: float | None = None
    macd_signal: float | None = None
    macd_hist: float | None = None


class FVGZone(BaseModel):
    low: float | None = None
    high: float | None = None
    start_date: str | None = None
    end_date: str | None = None


class FVGData(BaseModel):
    has_fvg_bullish: bool = False
    has_fvg_bearish: bool = False
    gap_range: list[float] | None = None
    # Last 3 bullish FVG zones (most recent first)
    fvg1: FVGZone | None = None
    fvg2: FVGZone | None = None
    fvg3: FVGZone | None = None


class ScreenerCacheItem(BaseModel):
    symbol: str
    company_name: str | None = None
    price: float | None = None
    volume: int | None = None
    avg_volume_10d: int | None = None
    indicators: IndicatorData = Field(default_factory=IndicatorData)
    fvg: FVGData = Field(default_factory=FVGData)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class WatchlistModel(BaseModel):
    name: str
    user_id: str
    filters: dict[str, Any] = Field(default_factory=dict)
    is_custom: bool = True
