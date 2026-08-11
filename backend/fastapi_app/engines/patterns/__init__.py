"""
Pattern Engine — price-structure pattern detection (pure OHLCV).

Wraps the existing, battle-tested FVG detection in `scanners/fvg.py` (not a
reimplementation) and adds helpers the LaunchPad continuation strategy needs:
the latest bullish FVG regardless of mitigation, and continuation classification
(is price holding just above a fresh gap that now acts as support?).
"""

from .fvg import (
    FVG,
    classify_continuation,
    detect_bullish_fvgs,
    fvg_backtest,
    latest_bullish_fvg,
    launchpad_valid_fvgs,
    nearest_active_fvg,
    nearest_launchpad_fvg,
)

__all__ = [
    "FVG",
    "classify_continuation",
    "detect_bullish_fvgs",
    "fvg_backtest",
    "latest_bullish_fvg",
    "launchpad_valid_fvgs",
    "nearest_active_fvg",
    "nearest_launchpad_fvg",
]
