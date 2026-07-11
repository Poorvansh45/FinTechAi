"""
Supervisor node + conditional-edge router.

`supervisor_node` classifies the message into a route and stores it on state.
`route_selector` is the conditional-edge function LangGraph uses to pick the
next agent node.
"""

from __future__ import annotations

import logging

from ..agents import supervisor_agent
from ..models.llm_provider import get_llm_manager
from .state import CopilotState

log = logging.getLogger("finai_edge.copilot.router")

VALID_ROUTES = ["portfolio", "market", "planning", "education"]


async def supervisor_node(state: CopilotState, config=None) -> dict:
    llm_manager = get_llm_manager()
    route = await supervisor_agent.classify(llm_manager, state.get("message", ""), config)
    if route not in VALID_ROUTES:
        route = "education"
    return {"route": route}


def route_selector(state: CopilotState) -> str:
    return state.get("route", "education")
