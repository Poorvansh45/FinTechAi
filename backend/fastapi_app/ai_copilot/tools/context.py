"""
Per-invocation context for tools.

The graph injects `user_id` and the Motor `db` handle into every tool call via
`RunnableConfig["configurable"]`. Tools read them through `get_ctx()` instead of
importing request/app state, so they stay pure and testable (tests inject a fake
db + user id through the same channel).
"""

from __future__ import annotations

from typing import Any

from langchain_core.runnables import RunnableConfig


class ToolContext:
    def __init__(self, user_id: str | None, db: Any | None):
        self.user_id = user_id
        self.db = db


def get_ctx(config: RunnableConfig | None) -> ToolContext:
    configurable = (config or {}).get("configurable", {}) if config else {}
    return ToolContext(
        user_id=configurable.get("user_id"),
        db=configurable.get("db"),
    )
