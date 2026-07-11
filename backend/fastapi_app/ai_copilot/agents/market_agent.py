"""Market Agent — stock/company/sector questions via the market data service."""

from __future__ import annotations

from ..prompts.prompts import MARKET_AGENT_PROMPT
from ..tools import MARKET_TOOLS
from .base import run_agent

NAME = "market"
TOOLS = list(MARKET_TOOLS)


async def run(llm_manager, history, user_message, config=None, extra_context=""):
    return await run_agent(
        agent_name=NAME,
        llm_manager=llm_manager,
        tools=TOOLS,
        system_prompt=MARKET_AGENT_PROMPT,
        history=history,
        user_message=user_message,
        config=config,
        extra_context=extra_context,
    )
