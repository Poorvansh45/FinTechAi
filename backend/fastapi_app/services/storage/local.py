"""
LocalDiskStorage — development StorageProvider.

Writes objects under `<app_root>/<uploads_dir>/<key>` and streams them back
through an authenticated API endpoint (so files stay private, exactly like a
private cloud bucket). Keys are provider-opaque (`{user_id}/{uuid}.ext`); path
traversal is rejected. Swapping to R2/B2/S3 later means adding a sibling
provider — this class and its callers are untouched.
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

from .base import StorageProvider


class LocalDiskStorage(StorageProvider):
    public_urls = False

    def __init__(self, root: str):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        # Resolve and confine to root — reject traversal (`..`, absolute keys).
        p = (self.root / key).resolve()
        if os.path.commonpath([self.root, p]) != str(self.root):
            raise ValueError("Invalid storage key (path traversal)")
        return p

    async def save(self, key: str, data: bytes, content_type: str) -> None:
        def _write():
            p = self._path(key)
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(data)

        await asyncio.to_thread(_write)

    async def open(self, key: str) -> bytes:
        def _read() -> bytes:
            return self._path(key).read_bytes()

        return await asyncio.to_thread(_read)

    async def delete(self, key: str) -> None:
        def _rm():
            p = self._path(key)
            if p.exists():
                p.unlink()

        await asyncio.to_thread(_rm)
