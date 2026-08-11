"""Strategy registry — the single place new scanners are registered."""

from __future__ import annotations

from .base import Strategy
from .launchpad import LaunchPadStrategy

# Register proprietary strategies here. Adding a scanner is one line.
STRATEGIES: dict[str, Strategy] = {
    LaunchPadStrategy.name: LaunchPadStrategy(),
}


def get_strategy(name: str) -> Strategy | None:
    return STRATEGIES.get((name or "").lower())
