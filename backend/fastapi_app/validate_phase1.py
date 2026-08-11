#!/usr/bin/env python3
"""
FinAI Edge - Phase 1 Validation Script
=========================================
Run from  backend/fastapi_app/  to verify the full stack is wired correctly.

    cd backend/fastapi_app
    python validate_phase1.py

Checks:
  1. Python imports (all analytics modules)
  2. Analytics calculations (deterministic unit tests)
  3. FastAPI routes (requires server running on port 8000)
  4. Environment variables
"""

import json
import sys
import traceback

PASS = "[PASS]"
FAIL = "[FAIL]"
SKIP = "[SKIP]"
WARN = "[WARN]"

results: list[dict] = []


def record(category: str, name: str, status: str, detail: str = ""):
    results.append(
        {"category": category, "name": name, "status": status, "detail": detail}
    )
    symbol = {PASS: "v", FAIL: "X", SKIP: "-", WARN: "!"}.get(status, "?")
    msg = f"  [{symbol}] {name}"
    if detail:
        msg += f" | {detail}"
    print(msg)


# ============================================================
# 1. Python import checks
# ============================================================

print("\n" + "=" * 55)
print("1. PYTHON IMPORTS")
print("=" * 55)

module_checks = [
    ("config", "get_settings"),
    ("analytics.risk_engine", "compute_portfolio_volatility"),
    ("analytics.diversification", "compute_diversification_score"),
    ("analytics.health_score", "compute_portfolio_health"),
    ("analytics.sector_analysis", "compute_sector_exposure"),
    ("analytics.rebalancer", "generate_rebalance_suggestions"),
    ("portfolio.calculator", "compute_all_holdings"),
    ("utils.helpers", "search_stocks"),
    ("utils.cache", "quote_cache"),
    ("market.providers.base", "StockQuote"),
    ("market.providers.yfinance_provider", "YFinanceProvider"),
    ("services.market_service", "MarketDataService"),
    ("services.portfolio_service", "PortfolioService"),
    ("schemas.portfolio", "AnalyzeHoldingsRequest"),
    ("schemas.ai", "OnboardingRequest"),
]

for module, attr in module_checks:
    try:
        mod = __import__(module, fromlist=[attr])
        getattr(mod, attr)
        record("imports", f"{module}.{attr}", PASS)
    except ImportError as e:
        record("imports", f"{module}.{attr}", FAIL, str(e))
    except AttributeError as e:
        record(
            "imports", f"{module}.{attr}", WARN, f"module loaded but attr missing: {e}"
        )


# ============================================================
# 2. Analytics Calculation Tests
# ============================================================

print("\n" + "=" * 55)
print("2. ANALYTICS CALCULATIONS")
print("=" * 55)

try:
    import numpy as np
    import pandas as pd

    from analytics import (
        compute_concentration_score,
        compute_max_drawdown,
        compute_portfolio_health,
        compute_portfolio_return,
        compute_portfolio_volatility,
        compute_safe_covariance,
        compute_sector_exposure,
        compute_sharpe_ratio,
        compute_var,
    )
    from portfolio.calculator import compute_all_holdings

    np.random.seed(42)
    weights = np.array([0.4, 0.35, 0.25])
    returns_data = {
        "RELIANCE.NS": np.random.normal(0.0008, 0.015, 500),
        "TCS.NS": np.random.normal(0.0007, 0.012, 500),
        "HDFCBANK.NS": np.random.normal(0.0006, 0.010, 500),
    }
    returns_df = pd.DataFrame(returns_data)

    cov = compute_safe_covariance(returns_df)
    vol = compute_portfolio_volatility(weights, cov)
    ret = compute_portfolio_return(weights, returns_df)
    sharpe = compute_sharpe_ratio(ret, vol)
    var_s = compute_var(returns_df, weights)
    dd = compute_max_drawdown(returns_df, weights)

    assert 0.0 <= vol <= 1.0, f"Volatility out of range: {vol}"
    record("analytics", "compute_portfolio_volatility", PASS, f"vol={vol:.4f}")

    assert isinstance(ret, float), "Return not float"
    record("analytics", "compute_portfolio_return", PASS, f"ret={ret:.4f}")

    assert isinstance(sharpe, float), "Sharpe not float"
    record("analytics", "compute_sharpe_ratio", PASS, f"sharpe={sharpe:.3f}")

    assert "var_95" in var_s and "var_99" in var_s, "VaR keys missing"
    record("analytics", "compute_var", PASS, f"var95={var_s['var_95']:.5f}")

    assert isinstance(dd, float) and dd <= 0, f"Drawdown should be <=0: {dd}"
    record("analytics", "compute_max_drawdown", PASS, f"dd={dd:.4f}")

    allocs = [40.0, 35.0, 25.0]
    conc = compute_concentration_score(allocs)
    assert "hhi" in conc and "score" in conc
    record("analytics", "compute_concentration_score", PASS, f"score={conc['score']}")

    health = compute_portfolio_health(
        diversification_score=65.0,
        risk_score=40.0,
        concentration_score=conc["score"],
        sector_balance_score=60.0,
        stock_count=3,
    )
    assert 0 <= health["score"] <= 100
    record(
        "analytics",
        "compute_portfolio_health",
        PASS,
        f"score={health['score']} label={health['label']}",
    )

    holdings_sample = [
        {"ticker": "RELIANCE.NS", "value": 40000, "allocation": 40},
        {"ticker": "TCS.NS", "value": 35000, "allocation": 35},
        {"ticker": "HDFCBANK.NS", "value": 25000, "allocation": 25},
    ]
    exposure = compute_sector_exposure(holdings_sample)
    assert len(exposure) > 0
    record(
        "analytics",
        "compute_sector_exposure",
        PASS,
        f"sectors={[e['sector'] for e in exposure]}",
    )

    raw = [
        {
            "ticker": "RELIANCE.NS",
            "name": "Reliance",
            "quantity": 10,
            "avg_buy_price": 2800,
            "current_price": 3000,
        },
        {
            "ticker": "TCS.NS",
            "name": "TCS",
            "quantity": 5,
            "avg_buy_price": 3500,
            "current_price": 3700,
        },
    ]
    enriched, totals = compute_all_holdings(raw)
    assert len(enriched) == 2
    assert totals["total_value"] > 0
    assert abs(sum(h["allocation"] for h in enriched) - 100.0) < 0.5
    record(
        "analytics",
        "compute_all_holdings",
        PASS,
        f"total_value={totals['total_value']} pnl={totals['total_pnl']}",
    )

    # Verify allocation percentages sum correctly
    alloc_sum = sum(h["allocation"] for h in enriched)
    assert abs(alloc_sum - 100.0) < 0.5, f"Allocations don't sum to 100: {alloc_sum}"
    record("analytics", "allocation_sum_check", PASS, f"sum={alloc_sum:.1f}%")

    # Verify P&L direction
    expected_pnl = (10 * 3000 - 10 * 2800) + (5 * 3700 - 5 * 3500)
    assert abs(totals["total_pnl"] - expected_pnl) < 0.01
    record(
        "analytics",
        "pnl_calculation_accuracy",
        PASS,
        f"expected={expected_pnl} got={totals['total_pnl']}",
    )

except Exception:
    record("analytics", "ANALYTICS BLOCK", FAIL, traceback.format_exc(limit=3))


# ============================================================
# 3. Environment Variables
# ============================================================

print("\n" + "=" * 55)
print("3. ENVIRONMENT VARIABLES")
print("=" * 55)

try:
    from config import get_settings

    s = get_settings()

    record("env", "FASTAPI_PORT", PASS, str(s.fastapi_port))
    record("env", "MONGODB_URI", PASS, s.mongodb_uri[:40] + "...")
    record("env", "LOG_LEVEL", PASS, s.log_level)
    record(
        "env",
        "GEMINI_API_KEY",
        PASS if s.gemini_available else WARN,
        "configured" if s.gemini_available else "NOT SET - rule-based fallback active",
    )
    record(
        "env",
        "GROWW_API_KEY",
        PASS if s.groww_available else WARN,
        "configured" if s.groww_available else "NOT SET - yfinance is primary",
    )
    record(
        "env",
        "FINNHUB_API_KEY",
        PASS if s.finnhub_available else WARN,
        "configured" if s.finnhub_available else "NOT SET - only yfinance available",
    )
except Exception as e:
    record("env", "config load", FAIL, str(e))


# ============================================================
# 4. FastAPI Route Verification (requires running server)
# ============================================================

print("\n" + "=" * 55)
print("4. FASTAPI ROUTES (requires server on port 8000)")
print("=" * 55)

try:
    import urllib.error
    import urllib.request

    BASE = "http://localhost:8000"

    def http_get(path: str, timeout: int = 5) -> tuple:
        url = BASE + path
        req = urllib.request.Request(url)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.status, json.loads(resp.read())
        except urllib.error.HTTPError as e:
            return e.code, {}
        except Exception as e:
            return 0, {"error": str(e)}

    def http_post(path: str, body: dict, timeout: int = 10) -> tuple:
        url = BASE + path
        data = json.dumps(body).encode()
        req = urllib.request.Request(
            url, data=data, headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.status, json.loads(resp.read())
        except urllib.error.HTTPError as e:
            return e.code, {}
        except Exception as e:
            return 0, {"error": str(e)}

    # Health check first - skip all routes if server not running
    code, body = http_get("/health")
    if code == 200:
        record("routes", "GET /health", PASS, f"status={body.get('status')}")
    elif code == 0:
        record("routes", "GET /health", SKIP, "Server not running on port 8000")
        print(
            "  (Skipping all route checks - start server with: uvicorn main:app --port 8000)"
        )
    else:
        record("routes", "GET /health", FAIL, f"HTTP {code}")

    if code == 200:
        holdings_payload = {
            "holdings": [
                {
                    "ticker": "RELIANCE.NS",
                    "name": "Reliance",
                    "quantity": 10,
                    "avg_buy_price": 2800,
                    "current_price": 3000,
                    "sector": "Energy",
                },
                {
                    "ticker": "TCS.NS",
                    "name": "TCS",
                    "quantity": 5,
                    "avg_buy_price": 3500,
                    "current_price": 3700,
                    "sector": "IT",
                },
                {
                    "ticker": "HDFCBANK.NS",
                    "name": "HDFC Bank",
                    "quantity": 8,
                    "avg_buy_price": 1600,
                    "current_price": 1750,
                    "sector": "Banking",
                },
            ]
        }

        # Market routes
        code2, b2 = http_get("/api/v2/market/search?q=hdfc")
        record(
            "routes",
            "GET /api/v2/market/search",
            PASS if code2 == 200 else FAIL,
            f"HTTP {code2} results={len(b2.get('results', []))}",
        )

        code2, b2 = http_get("/api/v2/market/provider-status")
        record(
            "routes",
            "GET /api/v2/market/provider-status",
            PASS if code2 == 200 else FAIL,
            f"HTTP {code2}",
        )

        code2, b2 = http_get("/api/v2/market/quote/RELIANCE.NS", timeout=15)
        record(
            "routes",
            "GET /api/v2/market/quote/{symbol}",
            PASS if code2 == 200 else WARN,
            f"HTTP {code2} available={b2.get('data', {}).get('available', '?')}",
        )

        code2, b2 = http_get(
            "/api/v2/market/bulk-quotes?symbols=TCS.NS,INFY.NS", timeout=20
        )
        record(
            "routes",
            "GET /api/v2/market/bulk-quotes",
            PASS if code2 == 200 else WARN,
            f"HTTP {code2}",
        )

        # Portfolio routes
        code2, b2 = http_post(
            "/api/v2/portfolio/analyze-holdings", holdings_payload, timeout=90
        )
        record(
            "routes",
            "POST /api/v2/portfolio/analyze-holdings",
            PASS if code2 == 200 else FAIL,
            f"HTTP {code2} health={b2.get('health', {}).get('score', '?')}/100",
        )

        code2, b2 = http_post("/api/v2/portfolio/health", holdings_payload, timeout=30)
        record(
            "routes",
            "POST /api/v2/portfolio/health",
            PASS if code2 == 200 else FAIL,
            f"HTTP {code2}",
        )

        code2, b2 = http_post(
            "/api/v2/portfolio/rebalance", holdings_payload, timeout=30
        )
        record(
            "routes",
            "POST /api/v2/portfolio/rebalance",
            PASS if code2 == 200 else FAIL,
            f"HTTP {code2} suggestions={len(b2.get('suggestions', []))}",
        )

        # Analytics routes (should be fast now - no market data fetch)
        for endpoint in ["risk", "sector", "diversification", "concentration"]:
            code2, b2 = http_post(
                f"/api/v2/analytics/{endpoint}", holdings_payload, timeout=10
            )
            record(
                "routes",
                f"POST /api/v2/analytics/{endpoint}",
                PASS if code2 == 200 else FAIL,
                f"HTTP {code2}",
            )

        # AI generate
        ai_payload = {
            "goal": "wealth_creation",
            "horizon": "7y+",
            "risk": "balanced",
            "monthly_investment": 10000,
        }
        code2, b2 = http_post("/api/v2/ai/generate-portfolio", ai_payload, timeout=45)
        method = b2.get("generation_method", "?")
        allocs = len(b2.get("allocations", []))
        record(
            "routes",
            "POST /api/v2/ai/generate-portfolio",
            PASS if code2 == 200 else FAIL,
            f"HTTP {code2} method={method} allocations={allocs}",
        )

except Exception:
    record("routes", "ROUTE BLOCK", FAIL, traceback.format_exc(limit=3))


# ============================================================
# 5. Summary
# ============================================================

print("\n" + "=" * 55)
print("SUMMARY")
print("=" * 55)

passes = sum(1 for r in results if r["status"] == PASS)
fails = sum(1 for r in results if r["status"] == FAIL)
warns = sum(1 for r in results if r["status"] == WARN)
skips = sum(1 for r in results if r["status"] == SKIP)
total = len(results)

print(f"  Total checks : {total}")
print(f"  Passed       : {passes}")
print(f"  Warnings     : {warns}  (non-blocking)")
print(f"  Skipped      : {skips}  (server not running)")
print(f"  FAILED       : {fails}")

if fails:
    print("\nFailed checks:")
    for r in results:
        if r["status"] == FAIL:
            print(f"  - [{r['category']}] {r['name']}: {r['detail'][:150]}")

if warns:
    print("\nWarnings (non-blocking):")
    for r in results:
        if r["status"] == WARN:
            print(f"  ! [{r['category']}] {r['name']}: {r['detail']}")

print()
if fails == 0:
    print("Phase 1 validation PASSED - all critical checks are green.")
else:
    print(f"Phase 1 validation has {fails} failure(s). Fix them before deployment.")
    sys.exit(1)
