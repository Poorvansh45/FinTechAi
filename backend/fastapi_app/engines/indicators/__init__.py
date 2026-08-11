"""
Indicator Engine — the single source of truth for technical indicators.

All indicators use pandas `ewm`/Wilder smoothing, matching the math that
populated the existing Mongo caches (schedulers/daily_refresh.py). Extracting
that math here (verbatim) de-duplicates the previously inline EMA/RSI/MACD and
lets every scanner + the daily scan job share one implementation — without
changing any already-computed cache value (so no full re-scan is required).
"""

from .atr import atr, atr_pct
from .ema import ema, ema_distance_pct
from .engine import IndicatorEngine, IndicatorSet
from .macd import macd
from .rsi import rsi
from .volume import avg_volume, volume_ratio

__all__ = [
    "IndicatorEngine",
    "IndicatorSet",
    "atr",
    "atr_pct",
    "avg_volume",
    "ema",
    "ema_distance_pct",
    "macd",
    "rsi",
    "volume_ratio",
]
