"""RSI — Wilder's smoothing (matches TradingView / TA-Lib)."""

from __future__ import annotations

import numpy as np
import pandas as pd


def rsi(values, period: int = 14) -> pd.Series:
    """
    Relative Strength Index using Wilder's smoothing (ewm alpha=1/period),
    identical to the RSI already stored in `screener_cache` for real data.

    Zero-loss handling: when there are no losses in the window (a pure uptrend),
    RSI is defined as 100 (standard convention / TA-Lib behaviour), rather than
    NaN. Real stocks always have down days, so this only affects degenerate
    inputs and leaves every cached value unchanged.
    """
    s = values if isinstance(values, pd.Series) else pd.Series(values, dtype="float64")
    delta = s.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    out = 100 - (100 / (1 + rs))
    # avg_loss == 0 with positive gains → RSI 100 (no losses to divide by)
    out = out.mask((avg_loss == 0) & (avg_gain > 0), 100.0)
    return out
