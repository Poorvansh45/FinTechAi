"""
MediaRepository — `ws_media` collection (metadata only; no binaries).

Stores the storage_key, resolved url, mime, size, kind and the entity a media
item is linked to (trade / note / thesis). Binaries live in the StorageProvider.
"""

from __future__ import annotations

from typing import Optional

from .base import BaseRepository, to_object_id


class MediaRepository(BaseRepository):
    def __init__(self, db):
        super().__init__(db, "ws_media")

    async def create(self, doc: dict) -> str:
        res = await self.col.insert_one(doc)
        return str(res.inserted_id)

    async def set_url(self, user_id: str, media_id: str, url: str) -> None:
        oid = to_object_id(media_id)
        if oid:
            await self.col.update_one(self.scope(user_id, {"_id": oid}), {"$set": {"url": url}})

    async def get(self, user_id: str, media_id: str) -> Optional[dict]:
        oid = to_object_id(media_id)
        if not oid:
            return None
        return await self.col.find_one(self.scope(user_id, {"_id": oid}))

    async def list_for(self, user_id: str, linked_type: str, linked_id: str) -> list[dict]:
        cur = self.col.find(
            self.scope(user_id, {"linked_type": linked_type, "linked_id": linked_id}),
        ).sort("created_at", 1)
        return [self.serialize(d) for d in await cur.to_list(length=200)]

    async def delete(self, user_id: str, media_id: str) -> Optional[dict]:
        """Delete the doc and return it (so the caller can remove the blob too)."""
        oid = to_object_id(media_id)
        if not oid:
            return None
        return await self.col.find_one_and_delete(self.scope(user_id, {"_id": oid}))
