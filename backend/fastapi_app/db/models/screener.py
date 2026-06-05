"""
FinAI Edge — Screener Models
=============================
Pydantic schemas for the screener cache and smart watchlists.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

class IndicatorData(BaseModel):
    rsi_14: Optional[float] = None
    ema_20: Optional[float] = None
    ema_50: Optional[float] = None
    macd: Optional[float] = None
    macd_signal: Optional[float] = None
    macd_hist: Optional[float] = None

class FVGZone(BaseModel):
    low: Optional[float] = None
    high: Optional[float] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class FVGData(BaseModel):
    has_fvg_bullish: bool = False
    has_fvg_bearish: bool = False
    gap_range: Optional[List[float]] = None
    # Last 3 bullish FVG zones (most recent first)
    fvg1: Optional[FVGZone] = None
    fvg2: Optional[FVGZone] = None
    fvg3: Optional[FVGZone] = None

class ScreenerCacheItem(BaseModel):
    symbol: str
    company_name: Optional[str] = None
    price: Optional[float] = None
    volume: Optional[int] = None
    avg_volume_10d: Optional[int] = None
    indicators: IndicatorData = Field(default_factory=IndicatorData)
    fvg: FVGData = Field(default_factory=FVGData)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class WatchlistModel(BaseModel):
    name: str
    user_id: str
    filters: Dict[str, Any] = Field(default_factory=dict)
    is_custom: bool = True
