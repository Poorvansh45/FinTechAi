from fastapi import APIRouter, Request, Query, HTTPException
from typing import Optional
import logging
from services.smc_service import get_smc_service

router = APIRouter(prefix="/api/v2/scanner/smc", tags=["SMC Scanner"])
log = logging.getLogger("finai_edge.api.smc")

@router.get("")
async def get_smc_scanner_results(
    request: Request,
    category: Optional[str] = Query(None, description="Category filter e.g., 'Inside Zone', 'CHoCH Zones'"),
    limit: int = Query(50, ge=1, le=500)
):
    """
    Get paginated/filtered SMC scanner results.
    """
    if not hasattr(request.app.state, "db") or request.app.state.db is None:
        raise HTTPException(status_code=503, detail="Database not available")
        
    service = get_smc_service(request.app.state.db, request.app.state.market_service)
    filters = {}
    if category:
        filters["category"] = category
        
    results = await service.get_scanner_results(filters, limit=limit)
    return {"success": True, "count": len(results), "data": results}

@router.get("/stats")
async def get_smc_stats(request: Request):
    """
    Get stats for the dashboard cards.
    """
    if not hasattr(request.app.state, "db") or request.app.state.db is None:
        raise HTTPException(status_code=503, detail="Database not available")
        
    service = get_smc_service(request.app.state.db, request.app.state.market_service)
    stats = await service.get_dashboard_stats()
    return {"success": True, "data": stats}

@router.get("/{symbol}/details")
async def get_smc_zone_details(request: Request, symbol: str):
    """
    Get historical retests and zone details for a specific symbol.
    """
    if not hasattr(request.app.state, "db") or request.app.state.db is None:
        raise HTTPException(status_code=503, detail="Database not available")
        
    service = get_smc_service(request.app.state.db, request.app.state.market_service)
    details = await service.get_zone_details(symbol.upper())
    return {"success": True, "data": details}

@router.post("/trigger_scan/{symbol}")
async def trigger_smc_scan(request: Request, symbol: str):
    """
    Trigger a manual scan for a specific symbol.
    """
    if not hasattr(request.app.state, "db") or request.app.state.db is None:
        raise HTTPException(status_code=503, detail="Database not available")
        
    service = get_smc_service(request.app.state.db, request.app.state.market_service)
    # Fire and forget or await (awaiting for now for simple response)
    await service.run_scan_for_symbol(symbol.upper())
    return {"success": True, "message": f"Scan completed for {symbol.upper()}"}
