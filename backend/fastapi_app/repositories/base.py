"""
BaseRepository — user-scoped MongoDB access for Workspace collections.

Enforces `user_id` scoping on every query so ownership is impossible to bypass.
Concrete repositories (media, trades, theses, …) subclass this and add
collection-specific methods.
"""

from __future__ import annotations

from typing import Any

from bson import ObjectId
from bson.errors import InvalidId


def to_object_id(value: str) -> ObjectId | None:
    """Parse a Mongo ObjectId string, returning None if malformed (never raises)."""
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        return None


class BaseRepository:
    def __init__(self, db, collection: str):
        if db is None:
            raise RuntimeError("Database not connected")
        self.db = db
        self.col = db.get_collection(collection)

    def scope(self, user_id: str, extra: dict | None = None) -> dict:
        """Build a query filter that is ALWAYS constrained to `user_id`."""
        q: dict[str, Any] = {"user_id": user_id}
        if extra:
            q.update(extra)
        return q

    @staticmethod
    def serialize(doc: dict | None) -> dict | None:
        """Convert `_id` → string `id` for JSON responses."""
        if not doc:
            return doc
        doc = dict(doc)
        if "_id" in doc:
            doc["id"] = str(doc.pop("_id"))
        return doc
