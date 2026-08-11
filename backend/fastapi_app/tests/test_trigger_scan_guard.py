"""
Guards on POST /api/v2/scanner/trigger-scan.

A full scan pins the CPU for ~30-40 minutes, so this endpoint used to be a
trivial denial-of-service: no auth, no lock, no cooldown — it even logged
`no_lock_guard=True` while queueing a duplicate run. These tests lock in the
three protections added on top.

Offline: TestClient is used WITHOUT a context manager (same pattern as
test_auth.py / test_smoke.py) so the lifespan never runs and no MongoDB
connection is made. The auth rejections are therefore exercised purely at the
dependency layer, which is where they belong.
"""

import jwt
from fastapi.testclient import TestClient

import main
from config import get_settings

client = TestClient(main.app)

ENDPOINT = "/api/v2/scanner/trigger-scan"


def _token(payload: dict, secret: str | None = None) -> str:
    settings = get_settings()
    return jwt.encode(payload, secret or settings.jwt_secret, algorithm="HS256")


# ── Auth: the endpoint must never run for an unverified caller ───────────────


def test_anonymous_cannot_trigger_a_scan():
    """The original hole: anyone who knew the URL could start a full scan."""
    assert client.post(ENDPOINT).status_code == 401


def test_garbage_token_cannot_trigger_a_scan():
    res = client.post(ENDPOINT, headers={"Authorization": "Bearer not-a-real-token"})
    assert res.status_code == 401


def test_token_signed_with_wrong_secret_is_rejected():
    bad = _token({"id": "user-1"}, secret="wrong-secret")
    res = client.post(ENDPOINT, headers={"Authorization": f"Bearer {bad}"})
    assert res.status_code == 401


def test_token_without_user_id_is_rejected():
    """A validly-signed token still needs an identity claim."""
    res = client.post(
        ENDPOINT, headers={"Authorization": f"Bearer {_token({'foo': 'bar'})}"}
    )
    assert res.status_code == 401


def test_auth_runs_before_any_scan_work():
    """A rejected caller must not reach the DB check, the cooldown write, or
    the background task — 401, never 503/500."""
    assert client.post(ENDPOINT).status_code == 401


# ── The read endpoints stay public ───────────────────────────────────────────


def _route(path: str, method: str):
    for r in main.app.routes:
        if getattr(r, "path", None) == path and method in getattr(r, "methods", set()):
            return r
    raise AssertionError(f"route not found: {method} {path}")


def _depends_on_current_user(route) -> bool:
    from utils.auth import get_current_user

    return any(d.call is get_current_user for d in route.dependant.dependencies)


def test_trigger_scan_route_declares_the_auth_dependency():
    assert _depends_on_current_user(_route(ENDPOINT, "POST"))


def test_scan_status_remains_public():
    """Only the expensive WRITE is gated; the status read stays open so the
    Overview page still works for signed-out visitors.

    Asserted against the route's dependency graph rather than an HTTP call —
    other test modules install a fake DB on the shared app state, so calling it
    here would fail for reasons unrelated to auth."""
    assert not _depends_on_current_user(_route("/api/v2/scanner/scan-status", "GET"))


# ── Configuration invariants ────────────────────────────────────────────────


def test_cooldown_is_configured_and_meaningful():
    from api.screener import MANUAL_SCAN_COOLDOWN_MIN

    assert MANUAL_SCAN_COOLDOWN_MIN >= 5


def test_stale_lock_window_exceeds_a_real_scan():
    """A scan runs ~30-40 min. The orphan-reclaim window must be comfortably
    longer, or a slow-but-healthy scan could have its lock stolen mid-run."""
    from engines.orchestration.coordinator import STALE_SCAN_HOURS

    assert STALE_SCAN_HOURS >= 1


def test_scan_doc_replace_preserves_the_cooldown_timestamp():
    """Regression: starting a scan must not erase the manual-trigger audit
    trail. `_new_scan_doc` is a FULL document replace, so any field it forgets
    to carry forward is destroyed — which silently defeated the cooldown, since
    the rate limit reads exactly this timestamp back off the same document."""
    from datetime import datetime, timezone

    from engines.orchestration.coordinator import _new_scan_doc

    now = datetime.now(timezone.utc)
    prev = {
        "last_ran": now,
        "record_count": 2173,
        "last_manual_trigger_at": now,
        "last_manual_trigger_by": "user-42",
    }
    doc = _new_scan_doc("SCAN-X", "manual", now, prev=prev)

    assert doc["last_manual_trigger_at"] == now
    assert doc["last_manual_trigger_by"] == "user-42"
    # and the pre-existing carry-forwards still work
    assert doc["last_ran"] == now
    assert doc["record_count"] == 2173
    # while per-run progress always starts clean
    assert doc["overall_status"] == "RUNNING"
    assert all(s["processed"] == 0 for s in doc["stages"].values())
