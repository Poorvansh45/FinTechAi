"""
Strategy Engine — proprietary scanners as composable Strategy classes.

Each strategy consumes the Indicator + Pattern engines (it never computes an
EMA or detects an FVG itself) and returns a fully-derived, explainable result —
no fabricated/placeholder numbers. Adding a new scanner = one Strategy subclass
registered in `registry.py`; no API, engine, or data-layer changes.
"""

from .base import Strategy, StrategyResult, SymbolContext, TradePlan
from .launchpad import LaunchPadStrategy
from .registry import STRATEGIES, get_strategy

__all__ = [
    "STRATEGIES",
    "LaunchPadStrategy",
    "Strategy",
    "StrategyResult",
    "SymbolContext",
    "TradePlan",
    "get_strategy",
]
