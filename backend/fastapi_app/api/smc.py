"""
FinAI Edge — SMC API (v2)
===========================
All SMC scanner endpoints with full filter support.
Includes zone proximity search (Search.py logic).
"""

from fastapi import APIRouter, Request, Query, HTTPException
from typing import Optional
import logging

router = APIRouter(prefix="/api/v2/scanner/smc", tags=["SMC Scanner"])
log = logging.getLogger("finai_edge.api.smc")


def _db(request: Request):
    if not hasattr(request.app.state, "db") or request.app.state.db is None:
        raise HTTPException(status_code=503, detail="Database not available")
    return request.app.state.db


# ── SMC Scanner Results ───────────────────────────────────────────────────────

@router.get("")
async def get_smc_results(
    request: Request,
    category:  Optional[str] = Query(None,
        description="Inside Zone|Near Zone (2%)|Near Zone (5%)|Fresh Zones|CHoCH Zones|BOS Zones|Premium|Discount|Unmitigated"),
    min_score: Optional[int] = Query(None, description="Minimum SMC Score 0-100"),
    event:     Optional[str] = Query(None, description="BOS|CHoCH"),
    direction: Optional[str] = Query(None, description="bullish|bearish"),
    limit:     int           = Query(50, ge=1, le=500),
):
    from services.smc_service import get_smc_service
    db      = _db(request)
    service = get_smc_service(db, request.app.state.market_service)
    filters = {}
    if category:               filters["category"]  = category
    if min_score is not None:  filters["min_score"] = min_score
    if event:                  filters["event"]     = event
    if direction:              filters["direction"] = direction

    results = await service.get_scanner_results(filters, limit=limit)
    return {"success": True, "count": len(results), "data": results}


@router.get("/stats")
async def get_smc_stats(request: Request):
    from services.smc_service import get_smc_service
    db      = _db(request)
    service = get_smc_service(db, request.app.state.market_service)
    stats   = await service.get_dashboard_stats()
    return {"success": True, "data": stats}


@router.get("/zone-proximity")
async def get_zone_proximity(
    request:           Request,
    distance_pct_max:  float = Query(10.0, description="Max distance % from zone edge (default 10%)"),
    limit:             int   = Query(200),
):
    """
    Returns stocks currently near their SMC demand zones.
    Implements the Search.py pipeline:
      - OLD  : in zone yesterday + today
      - NEW  : entered zone today
      - REMOVED: left zone since yesterday
    """
    from services.zone_search_service import get_zone_proximity_results
    db = _db(request)
    filters = {"distance_pct_max": distance_pct_max}
    result  = await get_zone_proximity_results(db, filters=filters, limit=limit)
    return {
        "success": True,
        "old":     result["old"],
        "new":     result["new"],
        "removed": result["removed"],
        "total":   result["total"],
        "scanned_at": str(result.get("scanned_at", "")),
    }


@router.get("/{symbol}/details")
async def get_zone_details(request: Request, symbol: str):
    from services.smc_service import get_smc_service
    db      = _db(request)
    service = get_smc_service(db, request.app.state.market_service)
    details = await service.get_zone_details(symbol.upper())
    return {"success": True, "data": details}


@router.post("/trigger-scan/{symbol}")
async def trigger_scan(request: Request, symbol: str):
    from services.smc_service import get_smc_service
    db      = _db(request)
    service = get_smc_service(db, request.app.state.market_service)
    result  = await service.run_scan_for_symbol(symbol.upper())
    return {"success": True, "message": f"Scan completed for {symbol.upper()}", "data": result}


@router.post("/run-zone-search")
async def run_zone_search(request: Request):
    """Manually trigger the zone proximity search (Search.py pipeline)."""
    from services.zone_search_service import run_zone_proximity_search
    db     = _db(request)
    result = await run_zone_proximity_search(db)
    return {"success": True, "data": result}
