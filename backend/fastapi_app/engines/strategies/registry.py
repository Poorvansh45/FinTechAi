"""Strategy registry — the single place new scanners are registered."""

from __future__ import annotations

from typing import Optional

from .base import Strategy
from .launchpad import LaunchPadStrategy

# Register proprietary strategies here. Adding a scanner is one line.
STRATEGIES: dict[str, Strategy] = {
    LaunchPadStrategy.name: LaunchPadStrategy(),
}


def get_strategy(name: str) -> Optional[Strategy]:
    return STRATEGIES.get((name or "").lower())
