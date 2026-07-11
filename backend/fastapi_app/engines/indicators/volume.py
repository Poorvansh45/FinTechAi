"""Volume indicators — rolling average and surge ratio."""

from __future__ import annotations

from typing import Optional

import pandas as pd


def avg_volume(values, window: int = 20, min_periods: int = 5) -> pd.Series:
    """Rolling average volume."""
    s = values if isinstance(values, pd.Series) else pd.Series(values, dtype="float64")
    return s.rolling(window, min_periods=min_periods).mean()


def volume_ratio(current_volume: Optional[float], avg: Optional[float]) -> Optional[float]:
    """Current volume relative to its rolling average (surge factor)."""
    if not avg or avg <= 0 or current_volume is None:
        return None
    return current_volume / avg
