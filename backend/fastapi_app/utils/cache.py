"""
FinAI Edge — Async TTL Cache
===============================
In-memory cache with configurable TTL per namespace.
Thread-safe via asyncio.Lock. Designed for market data & analytics caching.
"""

import asyncio
import time
import logging
from typing import Any, Optional

log = logging.getLogger("finai_edge.cache")


class AsyncTTLCache:
    """
    Simple async-safe in-memory cache with per-key TTL.

    Usage:
        cache = AsyncTTLCache(default_ttl=300)  # 5 min default
        await cache.set("RELIANCE.NS:quote", data)
        result = await cache.get("RELIANCE.NS:quote")
    """

    def __init__(self, default_ttl: int = 300, max_size: int = 2000):
        self._store: dict[str, tuple[Any, float]] = {}
        self._default_ttl = default_ttl
        self._max_size = max_size
        self._lock = asyncio.Lock()
        self._hits = 0
        self._misses = 0

    async def get(self, key: str) -> Optional[Any]:
        """Retrieve a cached value. Returns None if expired or missing."""
        async with self._lock:
            entry = self._store.get(key)
            if entry is None:
                self._misses += 1
                return None

            value, expires_at = entry
            if time.time() > expires_at:
                del self._store[key]
                self._misses += 1
                return None

            self._hits += 1
            return value

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Store a value with optional custom TTL."""
        async with self._lock:
            # Evict oldest if at capacity
            if len(self._store) >= self._max_size:
                self._evict_expired()
                if len(self._store) >= self._max_size:
                    # Remove oldest entry
                    oldest_key = min(self._store, key=lambda k: self._store[k][1])
                    del self._store[oldest_key]

            ttl_seconds = ttl if ttl is not None else self._default_ttl
            self._store[key] = (value, time.time() + ttl_seconds)

    async def invalidate(self, key: str) -> bool:
        """Remove a specific key. Returns True if key existed."""
        async with self._lock:
            if key in self._store:
                del self._store[key]
                return True
            return False

    async def invalidate_pattern(self, prefix: str) -> int:
        """Remove all keys matching a prefix. Returns count removed."""
        async with self._lock:
            keys_to_remove = [k for k in self._store if k.startswith(prefix)]
            for k in keys_to_remove:
                del self._store[k]
            return len(keys_to_remove)

    async def clear(self) -> None:
        """Clear all cached entries."""
        async with self._lock:
            self._store.clear()
            self._hits = 0
            self._misses = 0

    def _evict_expired(self) -> None:
        """Remove all expired entries (called under lock)."""
        now = time.time()
        expired = [k for k, (_, exp) in self._store.items() if now > exp]
        for k in expired:
            del self._store[k]

    @property
    def stats(self) -> dict:
        """Cache statistics."""
        total = self._hits + self._misses
        return {
            "size": len(self._store),
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": round(self._hits / total * 100, 1) if total > 0 else 0,
        }


# ── Pre-configured cache instances ──────────────────────────────────
# These are module-level singletons, shared across the app

quote_cache = AsyncTTLCache(default_ttl=300, max_size=500)       # 5 min
candle_cache = AsyncTTLCache(default_ttl=3600, max_size=200)     # 1 hour
analytics_cache = AsyncTTLCache(default_ttl=600, max_size=100)   # 10 min
search_cache = AsyncTTLCache(default_ttl=1800, max_size=300)     # 30 min
