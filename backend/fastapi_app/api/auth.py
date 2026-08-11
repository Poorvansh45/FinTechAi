"""
FinAI Edge — FastAPI Router: Auth
====================================
Login, logout, session (/me), username updates and the cookie->bearer token
bridge. Mounted at /api/auth in main.py — same paths Express used to serve,
so the frontend needed only a base-URL change (NEXT_PUBLIC_API_URL) to cut
over.

Password hashing is bcrypt, compatible with the hashes already written by
Express's bcryptjs (backend/models/User.js) — no re-hash / migration needed.
JWTs are HS256, payload {"id": userId}, signed with the same JWT_SECRET this
service already used to *verify* tokens (utils/auth.py) — existing sessions
issued while Express was still live keep working unchanged.

Accounts are still provisioned by backend/scripts/seedUsers.js — this router
only ever reads/updates the users collection, never creates accounts. Nivro
is a closed private beta; there is deliberately no /register route here
either.
"""

from __future__ import annotations

import logging
import time
from collections import deque
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

from config import get_settings
from utils.auth import get_current_user, get_raw_token

log = logging.getLogger("finai_edge.api.auth")
router = APIRouter()

JWT_ALGORITHM = "HS256"
COOKIE_NAME = "jwt"
COOKIE_MAX_AGE = 30 * 24 * 60 * 60  # 30 days, matches Express's JWT_EXPIRE=30d


# ── Brute-force guard for /login ─────────────────────────────────────────────
# Mirrors Express's loginLimiter (backend/routes/authRoutes.js): 5 FAILED
# attempts per 15 minutes, keyed by client IP. Only failures consume budget —
# a legitimate user signing in never spends their own allowance.
_LOGIN_WINDOW = 15 * 60
_LOGIN_MAX_FAILURES = 5
_login_failures: dict[str, deque[float]] = {}


def _client_ip(request: Request) -> str:
    # Mirrors Express's `trust proxy = 1`: trust only the nearest hop's
    # X-Forwarded-For entry (Render's own proxy), never the full chain — a
    # caller-forged header could otherwise mint a fresh bucket per request.
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _check_login_rate_limit(ip: str) -> None:
    now = time.time()
    calls = _login_failures.setdefault(ip, deque())
    cutoff = now - _LOGIN_WINDOW
    while calls and calls[0] < cutoff:
        calls.popleft()
    if len(calls) >= _LOGIN_MAX_FAILURES:
        retry_after = max(1, int(calls[0] + _LOGIN_WINDOW - now))
        raise HTTPException(
            status_code=429,
            detail="Too many failed login attempts. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )


def _record_login_failure(ip: str) -> None:
    _login_failures.setdefault(ip, deque()).append(time.time())


def reset_login_rate_limits() -> None:
    """Clear all buckets. Used by tests."""
    _login_failures.clear()


# ── Cookie attributes ────────────────────────────────────────────────────────
# Same reasoning as Express's jwtCookieOptions (backend/utils/generateToken.js):
# production is genuinely cross-site (frontend on Vercel, this API on Render),
# so `sameSite=None` + `secure=True` is required there for the cookie to be
# sent at all; local dev stays on `lax` + non-secure (plain HTTP).
def _set_auth_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        secure=settings.is_production,
        samesite="none" if settings.is_production else "lax",
        path="/",
    )


def _clear_auth_cookie(response: Response) -> None:
    # Same attributes as when it was set — a mismatch means the browser
    # rejects the clearing Set-Cookie and the session survives "logout".
    settings = get_settings()
    response.set_cookie(
        key=COOKIE_NAME,
        value="",
        max_age=0,
        httponly=True,
        secure=settings.is_production,
        samesite="none" if settings.is_production else "lax",
        path="/",
    )


def _issue_jwt(user_id: str) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {"id": user_id, "iat": now, "exp": now + timedelta(days=30)}
    return jwt.encode(payload, settings.jwt_secret, algorithm=JWT_ALGORITHM)


def _serialize_user(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "username": doc.get("username"),
        "email": doc.get("email"),
        "role": doc.get("role", "beta"),
        "createdAt": doc.get("createdAt").isoformat() if doc.get("createdAt") else None,
    }


def _users(request: Request):
    if not getattr(request.app.state, "mongo_connected", False):
        raise HTTPException(status_code=503, detail="Database not connected")
    return request.app.state.db["users"]


# ── Schemas ───────────────────────────────────────────────────────────────────
class LoginBody(BaseModel):
    email: str
    password: str


class UsernameBody(BaseModel):
    username: str = Field(min_length=3, max_length=20)


# ── Routes ────────────────────────────────────────────────────────────────────
# No /register: Nivro is a closed private beta — accounts are seeded via
# backend/scripts/seedUsers.js, never self-registered.


@router.post("/login")
async def login(body: LoginBody, request: Request, response: Response):
    ip = _client_ip(request)
    _check_login_rate_limit(ip)

    users = _users(request)
    email = body.email.lower().strip()
    doc = await users.find_one({"email": email})

    if not doc or not bcrypt.checkpw(
        body.password.encode("utf-8"), doc["password"].encode("utf-8")
    ):
        _record_login_failure(ip)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Revoked accounts are rejected AFTER the password check on purpose: a
    # different message for a wrong password vs. a deactivated account would
    # let an outsider enumerate which addresses exist on the beta.
    if doc.get("isActive") is False:
        _record_login_failure(ip)
        raise HTTPException(
            status_code=403,
            detail="This account is not active. Nivro is currently invite-only.",
        )

    token = _issue_jwt(str(doc["_id"]))
    _set_auth_cookie(response, token)

    return {"success": True, "user": _serialize_user(doc)}


@router.post("/logout")
async def logout(response: Response) -> dict:
    # Stateless JWTs — logout only clears the cookie client-side. Still
    # requires a valid token to reach this handler (AuthGuardMiddleware
    # already rejected anyone without one), matching Express's `protect` on
    # this route.
    _clear_auth_cookie(response)
    return {"success": True, "message": "Logged out successfully"}


@router.get("/me")
async def get_me(request: Request):
    user_id = await get_current_user(request)
    users = _users(request)
    doc = await users.find_one({"_id": ObjectId(user_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True, "user": _serialize_user(doc)}


@router.put("/username")
async def update_username(body: UsernameBody, request: Request):
    user_id = await get_current_user(request)
    users = _users(request)

    username = body.username.strip()
    existing = await users.find_one(
        {"username": username, "_id": {"$ne": ObjectId(user_id)}}
    )
    if existing:
        raise HTTPException(status_code=409, detail="This username is already taken")

    await users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"username": username, "updatedAt": datetime.utcnow()}},
    )
    doc = await users.find_one({"_id": ObjectId(user_id)})
    return {"success": True, "user": _serialize_user(doc)}


@router.get("/token")
async def get_token(request: Request):
    await get_current_user(request)  # 401s if the caller isn't authenticated
    return {"success": True, "token": get_raw_token(request)}
