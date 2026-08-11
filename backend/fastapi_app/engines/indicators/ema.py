"""EMA — exponential moving average (pandas ewm, adjust=False)."""

from __future__ import annotations

import numpy as np
import pandas as pd


def ema(values, period: int) -> pd.Series:
    """
    Exponential moving average using span=period, adjust=False.

    This matches the EMA that populated `screener_cache` (daily_refresh) — i.e.
    TradingView-style EMA — so it is the canonical implementation for the whole
    codebase. Accepts a Series, ndarray, or list; returns a pandas Series.
    """
    s = values if isinstance(values, pd.Series) else pd.Series(values, dtype="float64")
    return s.ewm(span=period, adjust=False).mean()


def ema_distance_pct(price: float, ema_value: float | None) -> float | None:
    """
    Percentage distance of price from an EMA:  (price - ema) / ema * 100.

    Distance % (not the raw EMA) is what makes a ₹50 and a ₹5000 stock
    comparable across a 2000-stock universe.
    """
    if ema_value is None or ema_value == 0 or np.isnan(ema_value):
        return None
    return (price - ema_value) / ema_value * 100.0
