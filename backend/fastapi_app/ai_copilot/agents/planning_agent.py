"""Financial Planning Agent — SIP, goals, retirement via calculator tools."""

from __future__ import annotations

from ..prompts.prompts import PLANNING_AGENT_PROMPT
from ..tools import CALCULATOR_TOOLS, PROFILE_TOOLS
from .base import run_agent

NAME = "planning"
TOOLS = [*CALCULATOR_TOOLS, *PROFILE_TOOLS]


async def run(model, history, user_message, config=None, extra_context=""):
    return await run_agent(
        agent_name=NAME,
        model=model,
        tools=TOOLS,
        system_prompt=PLANNING_AGENT_PROMPT,
        history=history,
        user_message=user_message,
        config=config,
        extra_context=extra_context,
    )
