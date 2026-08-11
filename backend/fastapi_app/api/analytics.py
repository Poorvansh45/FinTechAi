"""
FinAI Edge — FastAPI Router: Analytics
========================================
Dedicated analytics endpoints for risk, sector, diversification, concentration.

Each endpoint uses a targeted fast computation path (no market data fetch,
< 500ms response). The full pipeline is only used via /portfolio/analyze-holdings.

COPY TO: backend/fastapi_app/api/analytics.py
"""

import logging
import time

from fastapi import APIRouter, HTTPException

from analytics import (
    compute_concentration_score,
    compute_portfolio_health,
    compute_sector_concentration,
    compute_sector_exposure,
    detect_sector_bias,
    estimate_risk_level,
)
from portfolio.calculator import compute_all_holdings
from schemas.portfolio import AnalyzeHoldingsRequest

log = logging.getLogger("finai_edge.api.analytics")
router = APIRouter()


# ── Shared fast helper ─────────────────────────────────────────────


def _fast_analytics(holdings_raw: list[dict]) -> dict:
    """
    Synchronous local-only analytics (no I/O, no market data fetch).
    All four analytics endpoints share this computation path.
    Typical latency: < 50ms.
    """
    t0 = time.perf_counter()

    enriched, _totals = compute_all_holdings(holdings_raw)

    sector_exposure = compute_sector_exposure(enriched)
    sector_concentration = compute_sector_concentration(sector_exposure)

    allocations = [h["allocation"] for h in enriched]
    concentration = compute_concentration_score(allocations)

    # Cheap diversification estimate: no covariance matrix needed
    n = len(enriched)
    diversification_score = round(min(85.0, n * 12.0), 1) if n > 0 else 0.0

    risk_level = estimate_risk_level(
        volatility=0.0,
        concentration_score=concentration.get("hhi", 50),
        sector_concentration=sector_concentration.get("top_sector_pct", 0),
    )

    health = compute_portfolio_health(
        diversification_score=diversification_score,
        risk_score=risk_level["score"],
        concentration_score=concentration.get("score", 50),
        sector_balance_score=sector_concentration.get("score", 50),
        stock_count=n,
    )

    elapsed = time.perf_counter() - t0
    log.debug(f"[analytics] fast_analytics: {n} holdings in {elapsed * 1000:.1f}ms")

    return {
        "sector_exposure": sector_exposure,
        "sector_concentration": sector_concentration,
        "concentration": concentration,
        "diversification_score": diversification_score,
        "risk": {"risk_level": risk_level, "data_source": "estimated"},
        "health": health,
    }


# ── Endpoints ──────────────────────────────────────────────────────


@router.post("/risk")
async def risk_analysis(req: AnalyzeHoldingsRequest):
    """
    Fast concentration + estimated risk metrics.
    Does NOT fetch market data — uses local computation only.
    Response time: < 200ms.
    """
    if not req.holdings:
        raise HTTPException(status_code=400, detail="Holdings list cannot be empty.")
    try:
        holdings = [h.model_dump() for h in req.holdings]
        result = _fast_analytics(holdings)
        return {
            "success": True,
            "risk": result["risk"],
            "concentration": result["concentration"],
            "diversification_score": result["diversification_score"],
            "data_source": "estimated",
        }
    except Exception as e:
        log.exception(f"Risk analysis failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sector")
async def sector_analysis(req: AnalyzeHoldingsRequest):
    """
    Sector exposure, concentration, and aggressive/defensive bias.
    Response time: < 200ms.
    """
    if not req.holdings:
        raise HTTPException(status_code=400, detail="Holdings list cannot be empty.")
    try:
        holdings = [h.model_dump() for h in req.holdings]
        result = _fast_analytics(holdings)
        exposure = result["sector_exposure"]
        return {
            "success": True,
            "sector_exposure": exposure,
            "sector_concentration": result["sector_concentration"],
            "sector_bias": detect_sector_bias(exposure),
        }
    except Exception as e:
        log.exception(f"Sector analysis failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/diversification")
async def diversification_analysis(req: AnalyzeHoldingsRequest):
    """
    Diversification score, concentration metrics, and health score.
    Response time: < 200ms.
    """
    if not req.holdings:
        raise HTTPException(status_code=400, detail="Holdings list cannot be empty.")
    try:
        holdings = [h.model_dump() for h in req.holdings]
        result = _fast_analytics(holdings)
        return {
            "success": True,
            "diversification_score": result["diversification_score"],
            "concentration": result["concentration"],
            "health": result["health"],
        }
    except Exception as e:
        log.exception(f"Diversification analysis failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/concentration")
async def concentration_analysis(req: AnalyzeHoldingsRequest):
    """
    Concentration risk with rebalance hints.
    Response time: < 200ms.
    """
    if not req.holdings:
        raise HTTPException(status_code=400, detail="Holdings list cannot be empty.")
    try:
        from analytics.rebalancer import generate_rebalance_suggestions

        holdings = [h.model_dump() for h in req.holdings]
        result = _fast_analytics(holdings)

        enriched, _ = compute_all_holdings(holdings)
        current_weights = {h["ticker"]: h["allocation"] for h in enriched}

        rebalance = generate_rebalance_suggestions(
            current_weights=current_weights,
            sector_exposure=result["sector_exposure"],
            health_data=result["health"],
        )
        return {
            "success": True,
            "concentration": result["concentration"],
            "rebalance_suggestions": rebalance,
            "health": result["health"],
        }
    except Exception as e:
        log.exception(f"Concentration analysis failed")
        raise HTTPException(status_code=500, detail=str(e))
