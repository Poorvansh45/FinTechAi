"""
FinAI Edge — Cross-service JWT verification
===============================================
FastAPI does not issue tokens — Express does (backend/utils/generateToken.js,
payload: {id: userId}, HS256). This module verifies that same token so
user-owned data (portfolio, watchlists) can be scoped to the real caller
instead of a client-supplied or hardcoded user id.

Beyond signature checking, it also confirms the account still EXISTS and is
ACTIVE. Verifying only the signature meant a token belonging to a deleted or
revoked user kept working for the rest of its 30-day life, and it left the two
services disagreeing — Express's `protect` middleware has always re-loaded the
user from Mongo. Both sides now enforce the same rule.

The lookup is cached briefly (see _TTL_SECONDS) so a hot path like the scanner
pages does not hit Mongo on every request. The cache is small and per-process,
which is right for a beta with a handful of users; revocation therefore takes
effect within one TTL window rather than instantly.
"""

from __future__ import annotations

import time
from typing import Any, Optional, TypedDict

import jwt
from fastapi import Request, HTTPException

from config import get_settings

ALGORITHM = "HS256"

# How long a resolved identity may be reused before Mongo is consulted again.
# Short enough that deactivating an account takes effect promptly; long enough
# that a page issuing a dozen parallel scanner calls does one lookup, not twelve.
_TTL_SECONDS = 30


class AuthError(Exception):
    """Raised instead of HTTPException so plain ASGI middleware can catch it."""

    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


class AuthUser(TypedDict):
    id: str
    role: str
    email: Optional[str]


# user_id -> (expires_at, AuthUser)
_cache: dict[str, tuple[float, AuthUser]] = {}


def _extract_token(request: Request) -> str:
    """
    Read the JWT from (in order):
      1. Authorization: Bearer <token>  — primary; used for all cross-origin
         calls from the browser (frontend, portfolio/watchlist services).
      2. Cookie "jwt"                   — fallback for same-origin deployments.
    """
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[len("Bearer "):]

    cookie_token = request.cookies.get("jwt")
    if cookie_token:
        return cookie_token

    raise AuthError(401, "Not authorized — no token provided")


def _decode(token: str) -> str:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise AuthError(401, "Not authorized — token is invalid or expired")
    except jwt.InvalidTokenError:
        raise AuthError(401, "Not authorized — token is invalid or expired")

    user_id = payload.get("id")
    if not user_id:
        raise AuthError(401, "Not authorized — token payload missing user id")
    return str(user_id)


def _db(request: Request):
    if getattr(request.app.state, "mongo_connected", False):
        return request.app.state.db
    return None


async def _load_user(request: Request, user_id: str) -> AuthUser:
    """Fetch the account and confirm it may still sign in."""
    now = time.time()
    hit = _cache.get(user_id)
    if hit and hit[0] > now:
        return hit[1]

    db = _db(request)
    if db is None:
        # Fail closed. Without the database we cannot confirm the account is
        # still active, and guessing "probably fine" is how revoked users get in.
        raise AuthError(503, "Authentication unavailable — database not connected")

    try:
        from bson import ObjectId
        oid: Any = ObjectId(user_id)
    except Exception:
        raise AuthError(401, "Not authorized — malformed user id")

    # `db["users"]` rather than `db.get_collection("users")`: both work on Motor,
    # but the subscript form is what test doubles implement.
    doc = await db["users"].find_one({"_id": oid}, {"role": 1, "isActive": 1, "email": 1})
    if not doc:
        raise AuthError(401, "Not authorized — user no longer exists")
    if doc.get("isActive") is False:
        raise AuthError(403, "Account is not active")

    user: AuthUser = {
        "id": user_id,
        "role": doc.get("role") or "beta",
        "email": doc.get("email"),
    }
    _cache[user_id] = (now + _TTL_SECONDS, user)
    return user


def invalidate_user_cache(user_id: Optional[str] = None) -> None:
    """Drop cached identities — all of them, or one. Used by tests."""
    if user_id is None:
        _cache.clear()
    else:
        _cache.pop(user_id, None)


async def resolve_user(request: Request) -> AuthUser:
    """Verify the token and load the account. Raises AuthError on failure."""
    token = _extract_token(request)
    user_id = _decode(token)
    return await _load_user(request, user_id)


async def get_current_user(request: Request) -> str:
    """
    FastAPI dependency. Returns the authenticated user id.

    The AuthGuard middleware normally resolves identity before a handler runs,
    so this reuses `request.state` when present and only re-resolves when the
    dependency is used outside that path (e.g. in tests hitting a route
    directly). Signature and return type are unchanged, so every existing
    `Depends(get_current_user)` call site keeps working.
    """
    cached = getattr(request.state, "user", None)
    if cached:
        return str(cached["id"])

    try:
        user = await resolve_user(request)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)
    request.state.user = user
    return user["id"]


async def get_current_role(request: Request) -> str:
    """Dependency returning the caller's role ('owner' | 'beta' | 'demo')."""
    cached = getattr(request.state, "user", None)
    if cached:
        return str(cached["role"])
    try:
        user = await resolve_user(request)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)
    request.state.user = user
    return user["role"]


def require_not_demo(action: str = "This action"):
    """
    Dependency factory blocking the shared demo account.

    The demo credential is published deliberately (LinkedIn), so it must be
    treated as untrusted: anyone can use it, and several strangers share the one
    account. It is kept away from anything expensive or destructive.
    """

    async def _guard(request: Request) -> str:
        role = await get_current_role(request)
        if role == "demo":
            raise HTTPException(
                status_code=403,
                detail=f"{action} is not available on the shared demo account.",
            )
        return role

    return _guard
