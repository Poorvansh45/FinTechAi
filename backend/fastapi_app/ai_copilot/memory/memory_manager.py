"""
Memory Manager
==============
Short-term and long-term memory for the copilot, backed by MongoDB.

Collections (created lazily; no schema migration needed):
  - ai_sessions        : one doc per (user_id, session_id) with metadata
  - ai_messages        : one doc per turn message (role, content, agent, ts)
  - financial_profiles : one doc per user — long-term preferences the copilot
                         learns (risk appetite, horizon, goals, notes)

Design:
- `MemoryManager(db)` accepts either a real Motor database (`request.app.state.db`)
  or None. When None (Mongo unavailable, or in unit tests without a real DB),
  every method degrades gracefully to a no-op / empty result instead of raising —
  matching how the rest of the FastAPI app behaves without Mongo.
- The DB handle is duck-typed (`db[collection_name]` → async collection), so a
  lightweight in-memory fake can be injected in tests.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

log = logging.getLogger("finai_edge.copilot.memory")

SESSIONS = "ai_sessions"
MESSAGES = "ai_messages"
PROFILES = "financial_profiles"

# Fields the copilot is allowed to learn/persist about a user.
PROFILE_FIELDS = {"risk_appetite", "investment_horizon", "goals", "preferences", "notes"}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class MemoryManager:
    def __init__(self, db: Any | None):
        self.db = db

    @property
    def available(self) -> bool:
        return self.db is not None

    # ── Short-term: conversation history ────────────────────────────────────
    async def load_history(self, session_id: str, limit: int = 12) -> list[dict]:
        """Return the last `limit` messages for a session, oldest-first."""
        if not self.available or not session_id:
            return []
        try:
            # _id tiebreak makes ordering deterministic when two messages share
            # the same created_at timestamp (same-millisecond inserts).
            cursor = (
                self.db[MESSAGES]
                .find({"session_id": session_id})
                .sort([("created_at", -1), ("_id", -1)])
                .limit(limit)
            )
            docs = [d async for d in cursor]
            docs.reverse()  # chronological order for the LLM
            return [{"role": d.get("role"), "content": d.get("content", "")} for d in docs]
        except Exception as e:
            log.warning(f"[memory] load_history failed: {e}")
            return []

    async def append_message(
        self,
        user_id: str,
        session_id: str,
        role: str,
        content: str,
        agent: Optional[str] = None,
    ) -> None:
        """Persist one message and touch the session record."""
        if not self.available or not session_id:
            return
        try:
            now = _utcnow()
            await self.db[MESSAGES].insert_one(
                {
                    "user_id": user_id,
                    "session_id": session_id,
                    "role": role,
                    "content": content,
                    "agent": agent,
                    "created_at": now,
                }
            )
            await self.db[SESSIONS].update_one(
                {"user_id": user_id, "session_id": session_id},
                {
                    "$set": {"updated_at": now},
                    "$setOnInsert": {"created_at": now},
                    "$inc": {"message_count": 1},
                },
                upsert=True,
            )
        except Exception as e:
            log.warning(f"[memory] append_message failed: {e}")

    async def list_sessions(self, user_id: str) -> list[dict]:
        if not self.available:
            return []
        try:
            cursor = self.db[SESSIONS].find({"user_id": user_id}).sort("updated_at", -1)
            out = []
            async for d in cursor:
                d["_id"] = str(d.get("_id"))
                out.append(d)
            return out
        except Exception as e:
            log.warning(f"[memory] list_sessions failed: {e}")
            return []

    async def get_session_messages(self, user_id: str, session_id: str) -> list[dict]:
        if not self.available:
            return []
        try:
            cursor = (
                self.db[MESSAGES]
                .find({"user_id": user_id, "session_id": session_id})
                .sort([("created_at", 1), ("_id", 1)])
            )
            out = []
            async for d in cursor:
                d["_id"] = str(d.get("_id"))
                out.append(d)
            return out
        except Exception as e:
            log.warning(f"[memory] get_session_messages failed: {e}")
            return []

    async def delete_session(self, user_id: str, session_id: str) -> int:
        """Delete a session and its messages. Returns count of messages removed."""
        if not self.available:
            return 0
        try:
            res = await self.db[MESSAGES].delete_many(
                {"user_id": user_id, "session_id": session_id}
            )
            await self.db[SESSIONS].delete_one(
                {"user_id": user_id, "session_id": session_id}
            )
            return int(getattr(res, "deleted_count", 0))
        except Exception as e:
            log.warning(f"[memory] delete_session failed: {e}")
            return 0

    # ── Long-term: financial profile ────────────────────────────────────────
    async def get_profile(self, user_id: str) -> dict:
        if not self.available or not user_id:
            return {}
        try:
            doc = await self.db[PROFILES].find_one({"user_id": user_id})
            if not doc:
                return {}
            doc.pop("_id", None)
            return doc
        except Exception as e:
            log.warning(f"[memory] get_profile failed: {e}")
            return {}

    async def upsert_profile(self, user_id: str, updates: dict) -> dict:
        """
        Merge allowed profile fields for a user. Only whitelisted keys
        (PROFILE_FIELDS) are written — the model cannot persist arbitrary data.
        Returns the applied subset (useful for logging / tool output).
        """
        if not user_id:
            return {}
        applied = {k: v for k, v in (updates or {}).items() if k in PROFILE_FIELDS and v is not None}
        if not applied:
            return {}
        if not self.available:
            return applied  # accepted, but not persisted (degraded mode)
        try:
            await self.db[PROFILES].update_one(
                {"user_id": user_id},
                {
                    "$set": {**applied, "updated_at": _utcnow()},
                    "$setOnInsert": {"user_id": user_id, "created_at": _utcnow()},
                },
                upsert=True,
            )
            return applied
        except Exception as e:
            log.warning(f"[memory] upsert_profile failed: {e}")
            return {}
