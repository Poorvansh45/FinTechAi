"""
Per-user sliding-window rate limiting.
======================================

Scoped per authenticated user rather than per IP: the shared demo credential is
published deliberately, so several unrelated visitors arrive from different
addresses on the same account. An IP limiter would not constrain that at all,
while a per-user limiter caps the account as a whole — which is the thing that
actually costs money (every copilot turn is a paid LLM call).

In-process and unsynchronised, which is the right trade for a beta with a
handful of users and a single API process. It would need Redis to hold across
multiple replicas.
"""

from __future__ import annotations

import time
from collections import deque

from fastapi import HTTPException

# role -> (max_requests, window_seconds)
_LIMITS: dict[str, tuple[int, int]] = {
    "demo": (10, 300),  # shared public credential — tightest
    "beta": (40, 300),
    "owner": (80, 300),
}
_DEFAULT_LIMIT = (20, 300)

# (bucket, user_id) -> timestamps of recent calls
_hits: dict[tuple[str, str], deque[float]] = {}


def check_rate_limit(bucket: str, user_id: str, role: str) -> None:
    """Record a call and raise 429 if the caller is over budget."""
    max_requests, window = _LIMITS.get(role, _DEFAULT_LIMIT)
    now = time.time()
    key = (bucket, user_id)

    calls = _hits.setdefault(key, deque())
    cutoff = now - window
    while calls and calls[0] < cutoff:
        calls.popleft()

    if len(calls) >= max_requests:
        retry_after = max(1, int(calls[0] + window - now))
        raise HTTPException(
            status_code=429,
            detail=(
                f"Rate limit reached ({max_requests} requests per "
                f"{window // 60} minutes). Try again in {retry_after}s."
            ),
            headers={"Retry-After": str(retry_after)},
        )

    calls.append(now)


def reset_rate_limits() -> None:
    """Clear all buckets. Used by tests."""
    _hits.clear()
