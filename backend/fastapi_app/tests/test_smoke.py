"""
FastAPI smoke tests — "does the app import and boot?"

Deliberately minimal: verifies the app imports and the /health endpoint
responds. Does NOT exercise the lifespan (no MongoDB connection) and never
calls external services (Groww / Finnhub / Gemini / yfinance).
"""

from fastapi.testclient import TestClient

import main


def test_app_imports():
    """The FastAPI application object is constructed on import."""
    assert main.app is not None
    assert main.app.title


def test_health_endpoint():
    """
    GET /health returns 200 with a healthy status.

    TestClient is used WITHOUT a context manager on purpose so the lifespan
    (MongoDB connect, scheduler, universe cache) does not run — the route
    itself only reads settings, so no external I/O occurs.
    """
    client = TestClient(main.app)
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "healthy"
    assert body["service"] == "finai-edge-fastapi"
