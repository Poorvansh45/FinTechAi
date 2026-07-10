"""LangGraph state for the copilot workflow."""

from __future__ import annotations

from typing import Optional, TypedDict


class CopilotState(TypedDict, total=False):
    # Inputs
    message: str
    user_id: str
    session_id: str

    # Loaded by the memory node
    history: list[dict]      # [{role, content}] prior turns
    profile: dict            # long-term financial profile

    # Set by supervisor / agents
    route: str               # portfolio | market | planning | education
    agent_used: str
    tools_called: list[str]
    answer: str
    token_usage: dict

    # Set by finalize
    reasoning_summary: str
    suggestions: list[str]

    error: Optional[str]
