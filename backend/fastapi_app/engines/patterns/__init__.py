"""
Pattern Engine — price-structure pattern detection (pure OHLCV).

Wraps the existing, battle-tested FVG detection in `scanners/fvg.py` (not a
reimplementation) and adds helpers the LaunchPad continuation strategy needs:
the latest bullish FVG regardless of mitigation, and continuation classification
(is price holding just above a fresh gap that now acts as support?).
"""

from .fvg import (
    FVG,
    detect_bullish_fvgs,
    latest_bullish_fvg,
    nearest_active_fvg,
    launchpad_valid_fvgs,
    nearest_launchpad_fvg,
    classify_continuation,
    fvg_backtest,
)

__all__ = [
    "FVG",
    "detect_bullish_fvgs",
    "latest_bullish_fvg",
    "nearest_active_fvg",
    "launchpad_valid_fvgs",
    "nearest_launchpad_fvg",
    "classify_continuation",
    "fvg_backtest",
]
