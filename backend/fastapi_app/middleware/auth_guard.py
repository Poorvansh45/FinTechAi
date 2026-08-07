"""
Deny-by-default authentication guard.
=====================================

FinTechAI runs as a closed private beta, so the API must be shut by default and
opened deliberately — not the other way round. Before this guard existed, 23 of
58 routes (every scanner: technical, launchpad, alpha-zone, fvg, smc,
volume-surge, ipo-vintage …) served their full payload to anyone who knew the
URL. The frontend's AuthGuard only ever hid UI; it protected no data.

Why middleware rather than `Depends(get_current_user)` on each route:
a dependency has to be remembered on every new endpoint, and the one that gets
forgotten is silently public. A middleware inverts that — a route added tomorrow
is protected unless somebody deliberately adds it to PUBLIC_PATHS below.

Identity resolution (verify token → load user → check active) lives in
`utils.auth`, so the middleware and the `Depends()` path can never disagree
about who the caller is.
"""

from __future__ import annotations

import logging

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from utils.auth import AuthError, resolve_user

log = logging.getLogger("finai_edge.auth_guard")

# Exact paths reachable with no credentials. Keep this list as short as it can
# possibly be — every entry is public API surface.
PUBLIC_PATHS: frozenset[str] = frozenset({
    "/health",              # container / uptime probes
    "/api/v2/status",       # service status board
    "/api/v2/copilot/health",
})

# Prefixes served without auth. Only interactive docs, and only when the app
# chooses to mount them at all (disabled outside development — see main.py).
PUBLIC_PREFIXES: tuple[str, ...] = (
    "/docs",
    "/redoc",
    "/openapi.json",
)


def _is_public(path: str) -> bool:
    if path in PUBLIC_PATHS:
        return True
    return path.startswith(PUBLIC_PREFIXES)


class AuthGuardMiddleware(BaseHTTPMiddleware):
    """Rejects unauthenticated requests to anything not explicitly public."""

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # CORS preflight carries no Authorization header by design — rejecting it
        # would break every cross-origin call from the browser before the real
        # request is ever sent.
        if request.method == "OPTIONS":
            return await call_next(request)

        if _is_public(path):
            return await call_next(request)

        try:
            user = await resolve_user(request)
        except AuthError as exc:
            return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

        # Downstream handlers read identity from here instead of re-decoding.
        request.state.user = user
        request.state.user_id = user["id"]
        request.state.role = user["role"]

        return await call_next(request)
