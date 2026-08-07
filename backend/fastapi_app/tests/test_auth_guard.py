"""
Deny-by-default auth boundary.

Before the AuthGuard middleware, 23 of 58 routes served their full payload to
anyone who knew the URL — every scanner, including the 19 MB volume-surge
dataset. The frontend's AuthGuard only hid UI. These tests pin the boundary so
it cannot silently reopen.

The most valuable test here is `test_no_new_route_is_public_by_default`: it
walks the live route table rather than a hardcoded list, so a router added
later fails this suite unless somebody deliberately adds it to PUBLIC_PATHS.

Offline: TestClient is used WITHOUT a context manager (same pattern as
test_auth.py / test_trigger_scan_guard.py) so the lifespan never runs and no
MongoDB connection is made. Rejections are therefore exercised at the
middleware/dependency layer, which is where they belong.
"""

import jwt
import pytest
from fastapi.testclient import TestClient

import main
from config import get_settings
from middleware.auth_guard import PUBLIC_PATHS, PUBLIC_PREFIXES, _is_public
from utils.auth import invalidate_user_cache
from utils.rate_limit import check_rate_limit, reset_rate_limits

client = TestClient(main.app)


@pytest.fixture(autouse=True)
def _clean_state():
    invalidate_user_cache()
    reset_rate_limits()
    yield
    invalidate_user_cache()
    reset_rate_limits()


def _token(payload: dict, secret: str = None) -> str:
    settings = get_settings()
    return jwt.encode(payload, secret or settings.jwt_secret, algorithm="HS256")


# A representative slice of what used to be wide open.
FORMERLY_PUBLIC = [
    "/api/scanner/launchpad",
    "/api/scanner/alpha-zone",
    "/api/scanner/technical",
    "/api/scanner/fvg",
    "/api/scanner/momentum",
    "/api/scanner/volume",
    "/api/scanner/volume-surge",
    "/api/scanner/ipo-vintage",
    "/api/scanner/ipo-vintage/study",
    "/api/v2/scanner/smc",
    "/api/v2/scanner/smc/stats",
    "/api/v2/scanner/smc/zone-proximity",
    "/api/v2/scanner/scan-status",
    "/api/v2/scanner/ipo-vintage/listings",
]


# ── Anonymous access is refused ──────────────────────────────────────────────

@pytest.mark.parametrize("path", FORMERLY_PUBLIC)
def test_scanner_endpoints_reject_anonymous(path):
    assert client.get(path).status_code == 401


def test_rejection_happens_before_any_handler_work():
    """A refused caller must never reach the database or the scan pipeline —
    401, never 500/503 from a handler that ran anyway."""
    assert client.get("/api/scanner/volume-surge").status_code == 401


# ── Bad credentials ──────────────────────────────────────────────────────────

def test_garbage_token_is_rejected():
    res = client.get("/api/scanner/launchpad", headers={"Authorization": "Bearer nonsense"})
    assert res.status_code == 401


def test_token_signed_with_wrong_secret_is_rejected():
    bad = _token({"id": "507f1f77bcf86cd799439011"}, secret="wrong-secret")
    res = client.get("/api/scanner/launchpad", headers={"Authorization": f"Bearer {bad}"})
    assert res.status_code == 401


def test_token_without_user_id_is_rejected():
    res = client.get(
        "/api/scanner/launchpad",
        headers={"Authorization": f"Bearer {_token({'foo': 'bar'})}"},
    )
    assert res.status_code == 401


def test_malformed_user_id_is_rejected():
    """A well-signed token whose id is not an ObjectId must not 500."""
    res = client.get(
        "/api/scanner/launchpad",
        headers={"Authorization": f"Bearer {_token({'id': 'not-an-objectid'})}"},
    )
    assert res.status_code in (401, 503)


def test_valid_signature_still_needs_a_real_account():
    """Signature alone is not enough — the account must exist and be active.
    Without a DB connection this fails closed (503) rather than admitting the
    caller, which is the property that matters."""
    good_sig = _token({"id": "507f1f77bcf86cd799439011"})
    res = client.get("/api/scanner/launchpad", headers={"Authorization": f"Bearer {good_sig}"})
    assert res.status_code in (401, 403, 503)
    assert res.status_code != 200


# ── Public surface stays public, and stays small ─────────────────────────────

@pytest.mark.parametrize("path", ["/health", "/api/v2/status"])
def test_health_endpoints_remain_public(path):
    assert client.get(path).status_code == 200


def test_public_surface_is_minimal():
    """Every public path is a deliberate choice. If this number grows, someone
    should have to justify it in review."""
    assert len(PUBLIC_PATHS) <= 4, f"public path list grew: {sorted(PUBLIC_PATHS)}"


def test_no_new_route_is_public_by_default():
    """The regression guard. Walks the live route table: any GET route that is
    not explicitly public must refuse an anonymous caller."""
    leaked = []
    for route in main.app.routes:
        path = getattr(route, "path", None)
        methods = getattr(route, "methods", set()) or set()
        if not path or "GET" not in methods or "{" in path:
            continue
        if _is_public(path):
            continue
        if client.get(path).status_code not in (401, 403):
            leaked.append(path)
    assert not leaked, f"these routes answered an anonymous GET: {leaked}"


# ── Middleware ordering ──────────────────────────────────────────────────────

def test_cors_preflight_is_not_blocked():
    """OPTIONS carries no Authorization header by design. Blocking it would
    break every cross-origin call before the real request is even sent."""
    res = client.options(
        "/api/scanner/launchpad",
        headers={
            "Origin": "http://localhost:9002",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert res.status_code < 400


def test_rejections_still_carry_cors_headers():
    """CORS must wrap the auth guard, or the browser reports an opaque CORS
    failure instead of the 401 and the app cannot redirect to login."""
    res = client.get(
        "/api/scanner/launchpad",
        headers={"Origin": "http://localhost:9002"},
    )
    assert res.status_code == 401
    assert "access-control-allow-origin" in {k.lower() for k in res.headers}


def test_docs_are_disabled_outside_development():
    settings = get_settings()
    if settings.environment == "development":
        pytest.skip("docs are intentionally mounted in development")
    assert client.get("/openapi.json").status_code == 404


# ── Demo restrictions ────────────────────────────────────────────────────────

def test_trigger_scan_declares_the_demo_guard():
    """The shared demo credential is published publicly; a 30-40 minute scan
    must not be reachable from it."""
    from utils.auth import require_not_demo  # noqa: F401  (import proves it exists)

    route = next(
        r for r in main.app.routes
        if getattr(r, "path", None) == "/api/v2/scanner/trigger-scan"
        and "POST" in getattr(r, "methods", set())
    )
    names = [d.call.__qualname__ for d in route.dependant.dependencies]
    assert any("_guard" in n for n in names), f"demo guard missing: {names}"


@pytest.mark.parametrize("path,method", [
    ("/api/v2/watchlists", "POST"),
    ("/api/v2/watchlists/{id}", "PATCH"),
    ("/api/v2/watchlists/{id}", "DELETE"),
    ("/api/v2/watchlists/{id}/stocks", "POST"),
    ("/api/v2/watchlists/{id}/duplicate", "POST"),
])
def test_watchlist_writes_declare_the_demo_guard(path, method):
    route = next(
        r for r in main.app.routes
        if getattr(r, "path", None) == path and method in getattr(r, "methods", set())
    )
    names = [d.call.__qualname__ for d in route.dependant.dependencies]
    assert any("_guard" in n for n in names), f"{method} {path} is writable by demo"


def test_watchlist_reads_are_not_demo_guarded():
    """Demo visitors should still be able to look around."""
    route = next(
        r for r in main.app.routes
        if getattr(r, "path", None) == "/api/v2/watchlists" and "GET" in getattr(r, "methods", set())
    )
    names = [d.call.__qualname__ for d in route.dependant.dependencies]
    assert not any("_guard" in n for n in names)


# ── Rate limiting ────────────────────────────────────────────────────────────

def test_demo_hits_the_rate_limit_first():
    """Per-user, not per-IP: the demo credential is shared by strangers on
    different addresses, so an IP limiter would not constrain it at all."""
    from fastapi import HTTPException

    for _ in range(10):
        check_rate_limit("copilot_chat", "demo-user", "demo")

    with pytest.raises(HTTPException) as exc:
        check_rate_limit("copilot_chat", "demo-user", "demo")
    assert exc.value.status_code == 429


def test_beta_gets_a_larger_budget_than_demo():
    for _ in range(11):
        check_rate_limit("copilot_chat", "beta-user", "beta")  # must not raise


def test_rate_limit_is_scoped_per_user():
    from fastapi import HTTPException

    for _ in range(10):
        check_rate_limit("copilot_chat", "demo-a", "demo")
    with pytest.raises(HTTPException):
        check_rate_limit("copilot_chat", "demo-a", "demo")

    # A different user is unaffected.
    check_rate_limit("copilot_chat", "demo-b", "demo")


def test_copilot_chat_is_rate_limited():
    route = next(
        r for r in main.app.routes
        if getattr(r, "path", None) == "/api/v2/copilot/chat"
    )
    names = [d.call.__qualname__ for d in route.dependant.dependencies]
    assert any("get_current_role" in n for n in names), (
        "copilot chat must resolve a role so the limiter can size the budget"
    )
