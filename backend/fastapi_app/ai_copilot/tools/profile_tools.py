"""
Profile tools — long-term memory writes.

`update_financial_profile` is how an agent persists a preference the user
explicitly states ("I prefer aggressive investing", "my horizon is 10 years").
Only whitelisted fields are written (enforced again in MemoryManager). This is
the deterministic, tool-driven half of profile learning; a light keyword
heuristic in the graph complements it.
"""

from __future__ import annotations

import logging
from typing import Optional

from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool

from .context import get_ctx

log = logging.getLogger("finai_edge.copilot.tools.profile")


@tool
async def update_financial_profile(
    config: RunnableConfig,
    risk_appetite: Optional[str] = None,
    investment_horizon: Optional[str] = None,
    goals: Optional[str] = None,
    preferences: Optional[str] = None,
) -> str:
    """Persist a financial preference the user has EXPLICITLY stated, so future
    conversations remember it. Only call this when the user clearly expresses a
    lasting preference (e.g. 'I prefer aggressive investing', 'my goal is
    retirement', 'my horizon is 10 years'). Fields: risk_appetite
    (conservative/balanced/aggressive), investment_horizon (e.g. '10 years'),
    goals (free text), preferences (free text). Do not invent values."""
    ctx = get_ctx(config)
    from ai_copilot.memory.memory_manager import MemoryManager

    updates = {
        "risk_appetite": risk_appetite,
        "investment_horizon": investment_horizon,
        "goals": goals,
        "preferences": preferences,
    }
    applied = await MemoryManager(ctx.db).upsert_profile(ctx.user_id, updates)
    if not applied:
        return "Nothing to update (no clear preference provided)."
    return "Saved to your profile: " + ", ".join(f"{k}={v}" for k, v in applied.items())


@tool
async def get_financial_profile(config: RunnableConfig) -> str:
    """Return what the copilot remembers about the user's financial preferences
    (risk appetite, horizon, goals). Use to personalise an answer."""
    ctx = get_ctx(config)
    from ai_copilot.memory.memory_manager import MemoryManager

    profile = await MemoryManager(ctx.db).get_profile(ctx.user_id)
    fields = {k: profile.get(k) for k in ("risk_appetite", "investment_horizon", "goals", "preferences") if profile.get(k)}
    if not fields:
        return "No saved financial preferences yet for this user."
    return "Known preferences: " + ", ".join(f"{k}={v}" for k, v in fields.items())


PROFILE_TOOLS = [update_financial_profile, get_financial_profile]
