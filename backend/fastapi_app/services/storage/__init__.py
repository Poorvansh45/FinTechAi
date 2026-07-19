"""
Storage provider factory.

`get_storage()` returns the configured StorageProvider singleton. The choice is
driven by `settings.storage_backend` ("local" today; "r2"/"s3" later add a
branch here only). Callers depend on the abstract `StorageProvider`, never a
concrete class.
"""

from __future__ import annotations

import os
from functools import lru_cache

from config import get_settings
from .base import StorageProvider
from .local import LocalDiskStorage


@lru_cache()
def get_storage() -> StorageProvider:
    settings = get_settings()
    backend = (settings.storage_backend or "local").lower()

    if backend == "local":
        # Resolve uploads dir relative to the FastAPI app root (this file is
        # services/storage/__init__.py → parents[2] == app root).
        app_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        uploads = settings.workspace_uploads_dir
        root = uploads if os.path.isabs(uploads) else os.path.join(app_root, uploads)
        return LocalDiskStorage(root)

    # Future: "r2" / "s3" providers implement the same interface.
    raise ValueError(
        f"Unsupported storage_backend '{backend}'. "
        f"Add a StorageProvider for it in services/storage/."
    )


__all__ = ["StorageProvider", "get_storage"]
