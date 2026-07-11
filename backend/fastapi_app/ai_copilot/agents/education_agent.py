"""Education Agent — explains finance concepts, personalised via saved profile."""

from __future__ import annotations

from ..prompts.prompts import EDUCATION_AGENT_PROMPT
from ..tools import PROFILE_TOOLS
from .base import run_agent

NAME = "education"
TOOLS = list(PROFILE_TOOLS)  # only reads/writes profile; no market/portfolio data


async def run(llm_manager, history, user_message, config=None, extra_context=""):
    return await run_agent(
        agent_name=NAME,
        llm_manager=llm_manager,
        tools=TOOLS,
        system_prompt=EDUCATION_AGENT_PROMPT,
        history=history,
        user_message=user_message,
        config=config,
        extra_context=extra_context,
    )
