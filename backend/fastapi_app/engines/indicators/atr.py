"""ATR — Average True Range (Wilder). Used for volatility-normalized stops."""

from __future__ import annotations

from typing import Optional

import numpy as np
import pandas as pd


def atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """
    Wilder's ATR from a DataFrame with High/Low/Close columns (any case).
    ATR expresses risk in a stock's own volatility units, so a stop of
    "1 ATR" is comparable across a ₹50 and a ₹5000 stock.
    """
    cols = {c.lower(): c for c in df.columns}
    high = pd.to_numeric(df[cols["high"]], errors="coerce")
    low = pd.to_numeric(df[cols["low"]], errors="coerce")
    close = pd.to_numeric(df[cols["close"]], errors="coerce")
    prev_close = close.shift(1)

    true_range = pd.concat(
        [(high - low), (high - prev_close).abs(), (low - prev_close).abs()],
        axis=1,
    ).max(axis=1)
    return true_range.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()


def atr_pct(atr_value: Optional[float], price: Optional[float]) -> Optional[float]:
    """ATR as a percentage of price (a clean volatility measure)."""
    if not atr_value or not price or price == 0 or np.isnan(atr_value):
        return None
    return atr_value / price * 100.0
