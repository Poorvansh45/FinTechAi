"""
MediaService — Workspace media orchestration.

Ties the pluggable StorageProvider (binary bytes) to the MediaRepository
(metadata in Mongo). Nothing here references a concrete storage backend, so the
dev local-disk store swaps to R2/B2/S3 with zero changes to this file.
"""

from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone

from repositories.media_repo import MediaRepository
from services.storage import get_storage

log = logging.getLogger("finai_edge.media_service")

# Allowed upload kinds and a conservative mime allowlist (images + PDF).
ALLOWED_KINDS = {"screenshot", "before", "after", "chart", "pdf", "attachment"}
ALLOWED_MIME_PREFIXES = ("image/",)
ALLOWED_MIME_EXACT = {"application/pdf"}
_EXT = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "application/pdf": ".pdf",
}


class MediaError(ValueError):
    """Raised for validation failures (bad mime, oversized, unknown kind)."""


class MediaService:
    def __init__(self, db, max_mb: int = 15):
        self.repo = MediaRepository(db)
        self.storage = get_storage()
        self.max_bytes = max_mb * 1024 * 1024

    @staticmethod
    def _is_allowed_mime(mime: str) -> bool:
        return mime in ALLOWED_MIME_EXACT or mime.startswith(ALLOWED_MIME_PREFIXES)

    async def upload(
        self,
        *,
        user_id: str,
        filename: str,
        data: bytes,
        content_type: str,
        kind: str = "screenshot",
        linked_type: str | None = None,
        linked_id: str | None = None,
    ) -> dict:
        if kind not in ALLOWED_KINDS:
            raise MediaError(f"Unsupported kind '{kind}'")
        mime = (
            (content_type or "application/octet-stream").split(";")[0].strip().lower()
        )
        if not self._is_allowed_mime(mime):
            raise MediaError(f"Unsupported file type '{mime}' (images and PDF only)")
        if not data:
            raise MediaError("Empty file")
        if len(data) > self.max_bytes:
            raise MediaError(f"File exceeds {self.max_bytes // (1024 * 1024)}MB limit")

        ext = _EXT.get(mime) or os.path.splitext(filename or "")[1] or ""
        key = f"{user_id}/{uuid.uuid4().hex}{ext}"
        await self.storage.save(key, data, mime)

        doc = {
            "user_id": user_id,
            "storage_key": key,
            "url": None,
            "mime": mime,
            "size": len(data),
            "kind": kind,
            "filename": filename,
            "linked_type": linked_type,
            "linked_id": linked_id,
            "created_at": datetime.now(timezone.utc),
        }
        media_id = await self.repo.create(doc)

        # Public bucket → stable URL; local dev → authenticated serve endpoint.
        url = self.storage.public_url(key) or f"/api/v2/workspace/media/{media_id}/raw"
        await self.repo.set_url(user_id, media_id, url)

        return {
            "id": media_id,
            "url": url,
            "storage_key": key,
            "mime": mime,
            "size": len(data),
            "kind": kind,
        }

    async def open(self, user_id: str, media_id: str) -> tuple[bytes, str] | None:
        doc = await self.repo.get(user_id, media_id)
        if not doc:
            return None
        data = await self.storage.open(doc["storage_key"])
        return data, doc.get("mime", "application/octet-stream")

    async def list_for(
        self, user_id: str, linked_type: str, linked_id: str
    ) -> list[dict]:
        return await self.repo.list_for(user_id, linked_type, linked_id)

    async def delete(self, user_id: str, media_id: str) -> bool:
        doc = await self.repo.delete(user_id, media_id)
        if not doc:
            return False
        try:
            await self.storage.delete(doc["storage_key"])
        except Exception as e:
            # metadata already gone; orphaned blob is harmless, just noted for cleanup
            log.debug(f"orphaned blob {doc['storage_key']}: delete failed: {e}")
        return True
