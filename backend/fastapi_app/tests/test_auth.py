"""
Phase 6 — cross-service JWT verification tests.

Verifies get_current_user() actually rejects missing/invalid tokens and
accepts a validly-signed one, without touching MongoDB or any external
service (TestClient used without a context manager, same pattern as
test_smoke.py, so the lifespan never runs).
"""

import jwt
from fastapi.testclient import TestClient

import main
from config import get_settings

client = TestClient(main.app)


def _token(payload: dict, secret: str = None) -> str:
    settings = get_settings()
    return jwt.encode(payload, secret or settings.jwt_secret, algorithm="HS256")


def test_watchlists_reject_missing_token():
    res = client.get("/api/v2/watchlists")
    assert res.status_code == 401


def test_watchlists_reject_invalid_token():
    res = client.get(
        "/api/v2/watchlists",
        headers={"Authorization": "Bearer not-a-real-token"},
    )
    assert res.status_code == 401


def test_watchlists_reject_wrong_secret():
    bad_token = _token({"id": "user-1"}, secret="wrong-secret")
    res = client.get(
        "/api/v2/watchlists",
        headers={"Authorization": f"Bearer {bad_token}"},
    )
    assert res.status_code == 401


def test_watchlists_accept_valid_token_past_auth_layer():
    """
    A validly-signed token (matching Express's {id: userId} payload shape)
    must pass the auth dependency. Without a DB connection in this test
    client, the request will fail downstream (503/500) — the point is it
    must NOT be rejected with 401, proving the token was accepted.
    """
    good_token = _token({"id": "user-1"})
    res = client.get(
        "/api/v2/watchlists",
        headers={"Authorization": f"Bearer {good_token}"},
    )
    assert res.status_code != 401


def test_portfolio_save_rejects_missing_token():
    res = client.post("/api/v2/portfolio/save", json={"name": "x", "holdings": []})
    assert res.status_code == 401
