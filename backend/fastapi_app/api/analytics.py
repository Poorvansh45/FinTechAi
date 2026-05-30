"""
FinAI Edge — FastAPI Router: Analytics
========================================
Dedicated analytics endpoints for risk, sector, diversification, concentration.

Each endpoint delegates to a *targeted* analysis path instead of running the
entire holdings pipeline, so we avoid computing all metrics when only one is
needed.
"""

import logging
from fastapi import APIRouter, HTTPException
from schemas.portfolio import AnalyzeHoldingsRequest
from portfolio.calculator import compute_all_holdings
from analytics import (
    compute_sector_exposure,
    compute_sector_concentration,
    detect_sector_bias,
    compute_concentration_score,
    compute_portfolio_health,
    estimate_risk_level,
)

log = logging.getLogger("finai_edge.api.analytics")
router = APIRouter()


# ── Shared helper ──────────────────────────────────────────────────────

def _base_analytics(holdings_raw: list[dict]) -> dict:
    """
    Compute cheap, synchronous analytics that don’t require market data.
    Used by /risk, /sector, /diversification, /concentration so we avoid
    running the full portfolio service pipeline (which fetches historical
    prices and runs MPT optimisation) when only one metric is needed.
    """
    enriched, totals = compute_all_holdings(holdings_raw)

    sector_exposure = compute_sector_exposure(enriched)
    sector_concentration = compute_sector_concentration(sector_exposure)

    allocations = [h["allocation"] for h in enriched]
    concentration = compute_concentration_score(allocations)

    # Cheap diversification estimate (no covariance matrix needed)
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

    return {
        "sector_exposure": sector_exposure,
        "sector_concentration": sector_concentration,
        "concentration": concentration,
        "diversification_score": diversification_score,
        "risk": {"risk_level": risk_level, "data_source": "estimated"},
        "health": health,
    }


@router.post("/risk")
async def risk_analysis(req: AnalyzeHoldingsRequest):
    """Concentration + estimated risk metrics for given holdings."""
    try:
        holdings = [h.model_dump() for h in req.holdings]
        result = _base_analytics(holdings)
        return {
            "success": True,
            "risk": result["risk"],
            "concentration": result["concentration"],
            "diversification_score": result["diversification_score"],
        }
    except Exception as e:
        log.error(f"Risk analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sector")
async def sector_analysis(req: AnalyzeHoldingsRequest):
    """Sector exposure, concentration, and bias analysis."""
    try:
        holdings = [h.model_dump() for h in req.holdings]
        result = _base_analytics(holdings)
        return {
            "success": True,
            "sector_exposure": result["sector_exposure"],
            "sector_concentration": result["sector_concentration"],
            "sector_bias": detect_sector_bias(result["sector_exposure"]),
        }
    except Exception as e:
        log.error(f"Sector analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/diversification")
async def diversification_analysis(req: AnalyzeHoldingsRequest):
    """Diversification metrics analysis."""
    try:
        holdings = [h.model_dump() for h in req.holdings]
        result = _base_analytics(holdings)
        return {
            "success": True,
            "diversification_score": result["diversification_score"],
            "concentration": result["concentration"],
            "health": result["health"],
        }
    except Exception as e:
        log.error(f"Diversification analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/concentration")
async def concentration_analysis(req: AnalyzeHoldingsRequest):
    """Concentration risk analysis with rebalance hints."""
    try:
        from analytics import generate_rebalance_suggestions
        holdings = [h.model_dump() for h in req.holdings]
        result = _base_analytics(holdings)
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
        }
    except Exception as e:
        log.error(f"Concentration analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
