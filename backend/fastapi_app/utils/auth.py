"""
FinAI Edge — Cross-service JWT verification
===============================================
FastAPI does not issue tokens — Express does (backend/utils/generateToken.js,
payload: {id: userId}, HS256). This module verifies that same token so
user-owned data (portfolio, watchlists) can be scoped to the real caller
instead of a client-supplied or hardcoded user id.
"""

import jwt
from fastapi import Request, HTTPException

from config import get_settings

ALGORITHM = "HS256"


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

    raise HTTPException(status_code=401, detail="Not authorized — no token provided")


async def get_current_user(request: Request) -> str:
    """
    FastAPI dependency. Verifies the Express-issued JWT and returns the
    authenticated user id (the "id" claim — matches jwt.sign({id: userId}, ...)
    on the Express side exactly; no payload change).
    """
    token = _extract_token(request)
    settings = get_settings()

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Not authorized — token is invalid or expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Not authorized — token is invalid or expired")

    user_id = payload.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authorized — token payload missing user id")

    return str(user_id)
