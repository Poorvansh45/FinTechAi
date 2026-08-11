"""
Supervisor Agent — intent classification.

Uses the LLM to map the user's message to exactly one route
(portfolio | market | planning | education). Falls back to a keyword heuristic
if the model returns something unexpected, so routing never hard-fails.
"""

from __future__ import annotations

import logging

from langchain_core.messages import HumanMessage, SystemMessage

from ..prompts.prompts import SUPERVISOR_PROMPT
from .base import extract_answer_text

log = logging.getLogger("finai_edge.copilot.supervisor")

ROUTES = {"portfolio", "market", "planning", "education"}

# Keyword fallback if the LLM answer isn't one of the routes.
_HEURISTICS = [
    (
        "portfolio",
        (
            "my portfolio",
            "my holdings",
            "my risk",
            "health score",
            "rebalance",
            "diversif",
            "my stocks",
        ),
    ),
    (
        "planning",
        (
            "sip",
            "retire",
            "crore",
            "lakh a month",
            "monthly invest",
            "goal",
            "how much should i invest",
            "wealth",
        ),
    ),
    (
        "market",
        (
            "price of",
            " vs ",
            "compare",
            "sector",
            "analyze ",
            "analyse ",
            "stock",
            "nifty",
            "share",
        ),
    ),
    ("education", ("what is", "explain", "define", "how does", "meaning of")),
]


def _heuristic_route(message: str) -> str:
    m = (message or "").lower()
    for route, keys in _HEURISTICS:
        if any(k in m for k in keys):
            return route
    return "education"


async def classify(llm_manager, user_message: str, config=None) -> str:
    """Return one of ROUTES for the given message. `llm_manager` is an
    LLMManager — Gemini -> Groq failover is handled transparently inside it."""
    try:
        resp, _provider = await llm_manager.ainvoke(
            [
                SystemMessage(content=SUPERVISOR_PROMPT),
                HumanMessage(content=user_message),
            ],
            config=config,
        )
        raw = extract_answer_text(resp.content).strip().lower()
        for route in ROUTES:
            if route in raw:
                log.info(f"[copilot] supervisor route='{route}' (llm)")
                return route
    except Exception as e:
        log.warning(f"[copilot] supervisor LLM classify failed, using heuristic: {e}")

    route = _heuristic_route(user_message)
    log.info(f"[copilot] supervisor route='{route}' (heuristic)")
    return route
