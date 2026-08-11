"""
api/auth.py — the login/logout/me/username/token endpoints themselves.

Distinct from test_auth.py (which only covers token *verification* on
downstream routes). This covers issuance: that /login is the one public
auth path, that everything else here is deny-by-default like any other
route, and that the login rate limiter fires — all without a MongoDB
connection (TestClient used without a context manager, same pattern as
test_auth_guard.py, so the lifespan never runs and app.state.mongo_connected
stays False). Anything requiring an actual user document therefore fails
closed with 503, not 200 — the assertions below only ever check for that,
never for a successful login, since there is no database here to succeed
against.
"""

import pytest
from fastapi.testclient import TestClient

import main
from api.auth import reset_login_rate_limits
from utils.auth import invalidate_user_cache
from utils.rate_limit import reset_rate_limits

client = TestClient(main.app)


@pytest.fixture(autouse=True)
def _clean_state():
    invalidate_user_cache()
    reset_rate_limits()
    reset_login_rate_limits()
    yield
    invalidate_user_cache()
    reset_rate_limits()
    reset_login_rate_limits()


# ── /login is the one public auth path ───────────────────────────────────────


def test_login_is_reachable_without_a_token():
    """Public path — must not be rejected by AuthGuardMiddleware before the
    handler even runs. Fails closed with 503 (no DB here), never 401."""
    res = client.post(
        "/api/auth/login", json={"email": "nobody@example.com", "password": "x"}
    )
    assert res.status_code == 503


def test_login_rejects_malformed_body():
    res = client.post("/api/auth/login", json={"email": "nobody@example.com"})
    assert res.status_code == 422


def test_login_without_db_fails_closed_not_open():
    """No MongoDB in this test client — must never silently admit the caller."""
    res = client.post(
        "/api/auth/login", json={"email": "anyone@example.com", "password": "x"}
    )
    assert res.status_code == 503
    assert res.status_code != 200


# ── Everything else is deny-by-default, same as any other route ─────────────


def test_logout_rejects_anonymous():
    assert client.post("/api/auth/logout").status_code == 401


def test_me_rejects_anonymous():
    assert client.get("/api/auth/me").status_code == 401


def test_token_rejects_anonymous():
    assert client.get("/api/auth/token").status_code == 401


def test_username_update_rejects_anonymous():
    res = client.put("/api/auth/username", json={"username": "someone"})
    assert res.status_code == 401


def test_login_is_the_only_public_auth_path():
    """A regression here means someone accidentally widened PUBLIC_PATHS."""
    from middleware.auth_guard import PUBLIC_PATHS

    auth_public = {p for p in PUBLIC_PATHS if p.startswith("/api/auth")}
    assert auth_public == {"/api/auth/login"}


# ── Login rate limiter (mirrors Express's 5 failures / 15 min) ──────────────
#
# Exercised directly rather than through HTTP: without a MongoDB connection
# (this test client's lifespan never runs), every /login call 503s at the DB
# check BEFORE a failure would ever be recorded, so an HTTP-level loop can
# never actually trip the limiter here. Live behavior is covered instead by
# the auth migration's manual E2E pass (docs/TESTING-GUIDE.md).


def test_login_rate_limiter_trips_after_five_failures():
    from api.auth import _check_login_rate_limit, _record_login_failure

    ip = "203.0.113.9"
    for _ in range(5):
        _check_login_rate_limit(ip)  # must not raise yet
        _record_login_failure(ip)

    with pytest.raises(Exception):
        _check_login_rate_limit(ip)


def test_login_rate_limiter_is_scoped_and_resettable():
    from api.auth import _check_login_rate_limit, _record_login_failure

    ip = "203.0.113.5"
    for _ in range(5):
        _record_login_failure(ip)
    with pytest.raises(Exception):
        _check_login_rate_limit(ip)

    reset_login_rate_limits()
    _check_login_rate_limit(ip)  # must not raise — bucket was cleared
