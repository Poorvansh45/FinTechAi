"""MACD — moving average convergence divergence."""

from __future__ import annotations

from typing import NamedTuple

import pandas as pd

from .ema import ema


class MACDResult(NamedTuple):
    macd: pd.Series
    signal: pd.Series
    hist: pd.Series


def macd(values, fast: int = 12, slow: int = 26, signal: int = 9) -> MACDResult:
    """
    MACD(12, 26, 9) built from the canonical `ema()` — matches the MACD stored
    in `screener_cache`. Returns (macd_line, signal_line, histogram) Series.
    """
    s = values if isinstance(values, pd.Series) else pd.Series(values, dtype="float64")
    macd_line = ema(s, fast) - ema(s, slow)
    signal_line = ema(macd_line, signal)
    hist = macd_line - signal_line
    return MACDResult(macd_line, signal_line, hist)
