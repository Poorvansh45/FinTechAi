"""
Workspace media — pluggable storage provider interface.

Business logic (media_service) depends ONLY on this abstraction. Swapping the
dev `LocalDiskStorage` for Cloudflare R2 / Backblaze B2 / S3 later requires a new
provider class and an env flag — no change to services, routers, or the DB schema.
MongoDB only ever stores the `storage_key` (+ a resolved `url`), never binaries.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional


class StorageProvider(ABC):
    """Abstract binary object store keyed by an opaque `storage_key`."""

    #: True when objects are reachable at a stable public URL (cloud buckets).
    #: False for local dev, where bytes are streamed back through an
    #: authenticated API endpoint instead.
    public_urls: bool = False

    @abstractmethod
    async def save(self, key: str, data: bytes, content_type: str) -> None:
        """Persist `data` under `key` (overwrites if present)."""

    @abstractmethod
    async def open(self, key: str) -> bytes:
        """Return the stored bytes for `key`. Raises FileNotFoundError if absent."""

    @abstractmethod
    async def delete(self, key: str) -> None:
        """Remove `key`. Idempotent — absence is not an error."""

    def public_url(self, key: str) -> Optional[str]:
        """Stable public URL for `key`, or None when the provider is not public
        (local dev). Callers fall back to the authenticated serve endpoint."""
        return None

    def presigned_put(self, key: str, content_type: str) -> Optional[str]:
        """Presigned direct-upload URL (cloud only). None when unsupported."""
        return None
