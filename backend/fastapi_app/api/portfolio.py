"""
FinAI Edge — FastAPI Router: Portfolio
========================================
Portfolio analysis, health check, rebalancing, and persistence endpoints.
"""

import logging
from fastapi import APIRouter, Request, HTTPException
from schemas.portfolio import (
    AnalyzeHoldingsRequest,
    AnalyzePortfolioRequest,
    HealthCheckRequest,
    RebalanceRequest,
)
from services.portfolio_service import get_portfolio_service

log = logging.getLogger("finai_edge.api.portfolio")
router = APIRouter()


@router.post("/analyze-holdings")
async def analyze_holdings(req: AnalyzeHoldingsRequest):
    """
    Full holdings-based portfolio analysis.

    Computes: P&L, sectors, risk metrics, health score, diversification,
    rebalance suggestions, CAGR, Sharpe, Sortino, VaR, drawdown.
    """
    try:
        service = get_portfolio_service()
        holdings = [h.model_dump() for h in req.holdings]
        result = await service.analyze_holdings(holdings)
        return {"success": True, **result}
    except Exception as e:
        log.error(f"Holdings analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze")
async def analyze_portfolio(req: AnalyzePortfolioRequest):
    """
    MPT-based portfolio optimization.

    Computes: efficient frontier, max-Sharpe portfolio, min-volatility portfolio,
    correlation matrix, individual stock metrics, VaR, drawdown.
    """
    try:
        service = get_portfolio_service()
        result = await service.analyze_portfolio(
            tickers=req.tickers,
            weights=req.weights,
            risk_profile=req.risk_profile,
        )

        if result.get("error"):
            raise HTTPException(status_code=422, detail=result["error"])

        return result
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Portfolio analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/health")
async def portfolio_health(req: HealthCheckRequest):
    """Quick portfolio health check."""
    try:
        service = get_portfolio_service()
        holdings = [h.model_dump() for h in req.holdings]
        result = await service.analyze_holdings(holdings)
        return {
            "success": True,
            "health": result.get("health", {}),
            "risk": result.get("risk", {}),
            "concentration": result.get("concentration", {}),
        }
    except Exception as e:
        log.error(f"Health check failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rebalance")
async def rebalance_suggestions(req: RebalanceRequest):
    """Get rebalance suggestions for a portfolio."""
    try:
        service = get_portfolio_service()
        holdings = [h.model_dump() for h in req.holdings]
        result = await service.analyze_holdings(holdings)
        return {
            "success": True,
            "suggestions": result.get("rebalance_suggestions", []),
            "health": result.get("health", {}),
        }
    except Exception as e:
        log.error(f"Rebalance failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/save")
async def save_portfolio(request: Request):
    """Save portfolio to MongoDB."""
    try:
        from models.portfolio import save_portfolio as db_save

        body = await request.json()
        user_id = body.get("user_id", "anonymous")
        name = body.get("name", "My Portfolio")
        holdings = body.get("holdings", [])

        if not holdings:
            raise HTTPException(status_code=400, detail="Holdings list is required.")

        db = request.app.state.db
        doc_id = await db_save(
            db=db,
            user_id=user_id,
            name=name,
            holdings=holdings,
            analysis_snapshot=body.get("analysis_snapshot"),
        )

        return {"success": True, "portfolio_id": doc_id}
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Save portfolio failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/saved")
async def list_saved_portfolios(request: Request, user_id: str = "anonymous"):
    """List saved portfolios for a user."""
    try:
        from models.portfolio import get_portfolios

        db = request.app.state.db
        portfolios = await get_portfolios(db, user_id)
        return {"success": True, "portfolios": portfolios}
    except Exception as e:
        log.error(f"List portfolios failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
