"""
LangChain tools for the copilot agents.

Each tool is a thin, async wrapper over an existing Phase 1 function (portfolio
service, analytics engines, market service) or a pure financial calculator.
Tools never reach into globals for request state — the DB handle and the
authenticated user id are injected per-invocation through the LangGraph
`RunnableConfig` `configurable` dict (see `context.py`), which keeps them pure
and unit-testable.
"""

from .analytics_tools import ANALYTICS_TOOLS
from .calculator_tools import CALCULATOR_TOOLS
from .market_tools import MARKET_TOOLS
from .portfolio_tools import PORTFOLIO_TOOLS
from .profile_tools import PROFILE_TOOLS

ALL_TOOLS = [
    *PORTFOLIO_TOOLS,
    *ANALYTICS_TOOLS,
    *MARKET_TOOLS,
    *CALCULATOR_TOOLS,
    *PROFILE_TOOLS,
]

__all__ = [
    "ALL_TOOLS",
    "ANALYTICS_TOOLS",
    "CALCULATOR_TOOLS",
    "MARKET_TOOLS",
    "PORTFOLIO_TOOLS",
    "PROFILE_TOOLS",
]
