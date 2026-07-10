"""
LangGraph workflow assembly.

    START → load_memory → supervisor → {portfolio|market|planning|education} → finalize → END

- load_memory : pulls conversation history + long-term profile from Mongo.
- supervisor  : classifies intent → route (see router.py).
- agent nodes : run the chosen specialist agent (tool-calling loop).
- finalize    : deterministic reasoning summary + suggestions, heuristic profile
                learning, and persistence of the turn.

The compiled graph is cached (lazy) so importing this module needs no API key —
the model is only constructed when a request actually runs.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from langgraph.graph import END, START, StateGraph

from ..agents import (
    education_agent,
    market_agent,
    planning_agent,
    portfolio_agent,
)
from ..memory.memory_manager import MemoryManager
from ..models.llm_provider import get_chat_model
from .router import route_selector, supervisor_node
from .state import CopilotState

log = logging.getLogger("finai_edge.copilot.workflow")

HISTORY_LIMIT = 10

AGENTS = {
    "portfolio": portfolio_agent,
    "market": market_agent,
    "planning": planning_agent,
    "education": education_agent,
}

_SUGGESTIONS = {
    "portfolio": [
        "Why is my health score what it is?",
        "Should I rebalance my portfolio?",
        "What's my biggest concentration risk?",
    ],
    "market": [
        "Compare this with a sector peer",
        "What sector does it belong to?",
        "How does this fit my portfolio?",
    ],
    "planning": [
        "How much monthly for ₹1 crore in 15 years?",
        "What SIP suits my risk profile?",
        "Show a conservative vs aggressive plan",
    ],
    "education": [
        "How does this apply to my portfolio?",
        "Give me a simple example",
        "What's a related concept to learn?",
    ],
}


def _db(config: Optional[dict]) -> Any | None:
    return ((config or {}).get("configurable", {}) or {}).get("db")


def _profile_context(profile: dict) -> str:
    fields = {
        k: profile.get(k)
        for k in ("risk_appetite", "investment_horizon", "goals", "preferences")
        if profile.get(k)
    }
    if not fields:
        return ""
    joined = ", ".join(f"{k}={v}" for k, v in fields.items())
    return f"Known user profile (personalise accordingly): {joined}."


def _heuristic_profile(message: str) -> dict:
    """Cheap, high-precision preference capture to complement the explicit tool."""
    m = (message or "").lower()
    out: dict = {}
    triggers = ("prefer", "risk", "invest", "appetite", "i am ", "i'm ", "comfortable")
    if any(t in m for t in triggers):
        for level in ("aggressive", "conservative", "balanced", "moderate"):
            if level in m:
                out["risk_appetite"] = "balanced" if level == "moderate" else level
                break
    return out


def _reasoning_summary(state: CopilotState) -> str:
    agent = state.get("agent_used", "?")
    tools = list(dict.fromkeys(state.get("tools_called", []) or []))
    if tools:
        return f"Routed to the {agent} agent, which used: {', '.join(tools)}."
    return f"Routed to the {agent} agent (answered directly — no tools needed)."


# ── Nodes ───────────────────────────────────────────────────────────────────────
async def load_memory_node(state: CopilotState, config=None) -> dict:
    mm = MemoryManager(_db(config))
    history = await mm.load_history(state.get("session_id", ""), limit=HISTORY_LIMIT)
    profile = await mm.get_profile(state.get("user_id", ""))
    return {"history": history, "profile": profile}


def _make_agent_node(agent_module):
    async def node(state: CopilotState, config=None) -> dict:
        model = get_chat_model()
        extra = _profile_context(state.get("profile") or {})
        result = await agent_module.run(
            model,
            state.get("history", []),
            state.get("message", ""),
            config,
            extra_context=extra,
        )
        return {
            "agent_used": agent_module.NAME,
            "tools_called": result.get("tools_called", []),
            "answer": result.get("answer", ""),
            "token_usage": result.get("token_usage", {}),
            "error": result.get("error"),
        }

    return node


async def finalize_node(state: CopilotState, config=None) -> dict:
    mm = MemoryManager(_db(config))
    user_id = state.get("user_id", "")
    session_id = state.get("session_id", "")
    message = state.get("message", "")

    answer = (state.get("answer") or "").strip()
    if not answer:
        answer = (
            "Sorry — I couldn't complete that analysis just now. "
            "Please try rephrasing your question."
        )

    # Heuristic long-term learning (complements the explicit update tool)
    learned = _heuristic_profile(message)
    if learned:
        await mm.upsert_profile(user_id, learned)

    # Persist the turn (user message + assistant answer)
    await mm.append_message(user_id, session_id, "user", message)
    await mm.append_message(user_id, session_id, "assistant", answer, agent=state.get("agent_used"))

    return {
        "answer": answer,
        "reasoning_summary": _reasoning_summary(state),
        "suggestions": _SUGGESTIONS.get(state.get("route", "education"), []),
    }


# ── Graph assembly (lazy singleton) ─────────────────────────────────────────────
_compiled = None


def build_graph():
    g = StateGraph(CopilotState)
    g.add_node("load_memory", load_memory_node)
    g.add_node("supervisor", supervisor_node)
    for name, module in AGENTS.items():
        g.add_node(name, _make_agent_node(module))
    g.add_node("finalize", finalize_node)

    g.add_edge(START, "load_memory")
    g.add_edge("load_memory", "supervisor")
    g.add_conditional_edges("supervisor", route_selector, {n: n for n in AGENTS})
    for name in AGENTS:
        g.add_edge(name, "finalize")
    g.add_edge("finalize", END)
    return g.compile()


def get_graph():
    global _compiled
    if _compiled is None:
        _compiled = build_graph()
        log.info("[copilot] LangGraph workflow compiled")
    return _compiled


async def run_copilot(
    *, message: str, user_id: str, session_id: str, db: Any | None
) -> dict:
    """Execute one copilot turn end-to-end and return the final state."""
    graph = get_graph()
    initial: CopilotState = {
        "message": message,
        "user_id": user_id,
        "session_id": session_id,
        "tools_called": [],
    }
    config = {"configurable": {"db": db, "user_id": user_id, "session_id": session_id}}
    return await graph.ainvoke(initial, config=config)
