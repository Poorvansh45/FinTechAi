"""Portfolio Agent — analyses the user's own portfolio via the Phase 1 engine."""

from __future__ import annotations

from ..prompts.prompts import PORTFOLIO_AGENT_PROMPT
from ..tools import PORTFOLIO_TOOLS, ANALYTICS_TOOLS, PROFILE_TOOLS
from .base import run_agent

NAME = "portfolio"
TOOLS = [*PORTFOLIO_TOOLS, *ANALYTICS_TOOLS, *PROFILE_TOOLS]


async def run(llm_manager, history, user_message, config=None, extra_context=""):
    return await run_agent(
        agent_name=NAME,
        llm_manager=llm_manager,
        tools=TOOLS,
        system_prompt=PORTFOLIO_AGENT_PROMPT,
        history=history,
        user_message=user_message,
        config=config,
        extra_context=extra_context,
    )
