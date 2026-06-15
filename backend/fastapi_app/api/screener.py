"""
FinAI Edge — Screener API (v2)
================================
Endpoints:
  GET  /api/scanner/technical      — EMA %, RSI, MACD, Volume
  GET  /api/scanner/volume         — Simple volume breakout
  GET  /api/scanner/volume-surge   — Full per-surge history
  GET  /api/scanner/fvg            — ICT FVG with scoring
  GET  /api/scanner/momentum       — Momentum score scanner
  GET  /api/v2/scanner/scan-status — Last scan timestamp + stats
  POST /api/v2/scanner/trigger-scan — Manually trigger full scan
"""

import asyncio
import math
from fastapi import APIRouter, Request, Query, BackgroundTasks, HTTPException
from services.scanner_service import get_scanner_service

router = APIRouter(prefix="/api/scanner", tags=["scanner"])

# Second router for v2-prefixed control endpoints
v2_router = APIRouter(prefix="/api/v2/scanner", tags=["scanner_control"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _san(val):
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    return val


def _san_item(item: dict) -> dict:
    clean = {}
    for k, v in item.items():
        if k == "_id":
            clean[k] = str(v)
        elif isinstance(v, dict):
            clean[k] = _san_item(v)
        elif isinstance(v, list):
            clean[k] = [
                _san_item(i) if isinstance(i, dict)
                else _san(i) if isinstance(i, float)
                else i
                for i in v
            ]
        elif isinstance(v, float):
            clean[k] = _san(v)
        else:
            clean[k] = v
    return clean


def _fmt(data):
    cleaned = [_san_item(item) for item in data]
    return {"success": True, "count": len(cleaned), "data": cleaned}


def _db(request: Request):
    if not hasattr(request.app.state, "db") or request.app.state.db is None:
        return None
    return request.app.state.db


# ── Technical ─────────────────────────────────────────────────────────────────

@router.get("/technical")
async def technical(
    request: Request,
    rsi_min:         float = Query(None),
    rsi_max:         float = Query(None),
    ema50_dist_min:  float = Query(None, description="+5 = 5% above EMA50"),
    ema50_dist_max:  float = Query(None),
    ema200_dist_min: float = Query(None, description="+10 = 10% above EMA200"),
    ema200_dist_max: float = Query(None),
    macd_min:        float = Query(None),
    macd_max:        float = Query(None),
    volume_min:      int   = Query(None),
    volume_max:      int   = Query(None),
    sort_by:         str   = Query("volume"),
    sort_dir:        str   = Query("desc"),
    limit:           int   = Query(2500),
):
    db = _db(request)
    if db is None:
        return {"success": False, "error": "Database not connected"}
    filters = {
        "rsi_min": rsi_min, "rsi_max": rsi_max,
        "ema50_dist_min": ema50_dist_min, "ema50_dist_max": ema50_dist_max,
        "ema200_dist_min": ema200_dist_min, "ema200_dist_max": ema200_dist_max,
        "macd_min": macd_min, "macd_max": macd_max,
        "volume_min": volume_min, "volume_max": volume_max,
        "sort_by": sort_by, "sort_dir": sort_dir,
    }
    data = await get_scanner_service(db).get_technical_screener(filters, limit)
    return {"success": True, "count": len(data), "data": data}


# ── Volume (simple) ───────────────────────────────────────────────────────────

@router.get("/volume")
async def volume(request: Request, limit: int = Query(50)):
    db = _db(request)
    if db is None:
        return {"success": False, "error": "Database not connected"}
    data = await get_scanner_service(db).get_volume_breakouts(limit)
    return {"success": True, "count": len(data), "data": data}


# ── Volume Surge ──────────────────────────────────────────────────────────────

@router.get("/volume-surge")
async def volume_surge(
    request: Request,
    volume_ratio_min:   float = Query(None),
    price_min:          float = Query(300),
    price_max:          float = Query(10000),
    avg_1d_min:         float = Query(None),
    win_rate_min:       float = Query(None),
    surges_min:         int   = Query(None),
    max_gain_min:       float = Query(None),
    current_surge_only: bool  = Query(False),
    limit:              int   = Query(100),
):
    db = _db(request)
    if db is None:
        return {"success": False, "error": "Database not connected"}
    filters = {
        "volume_ratio_min": volume_ratio_min, "price_min": price_min, "price_max": price_max,
        "avg_1d_min": avg_1d_min, "win_rate_min": win_rate_min,
        "surges_min": surges_min, "max_gain_min": max_gain_min,
        "current_surge_only": current_surge_only,
    }
    data = await get_scanner_service(db).get_volume_surges(filters, limit)
    return {"success": True, "count": len(data), "data": data}


# ── FVG Scanner ───────────────────────────────────────────────────────────────

@router.get("/fvg")
async def fvg(
    request: Request,
    rsi_min:       float = Query(None),
    rsi_max:       float = Query(None),
    score_min:     int   = Query(None),
    min_fvg_count: int   = Query(None),
    price_min:     float = Query(None),
    price_max:     float = Query(None),
    has_fvg_only:  bool  = Query(True),
    fvg_status:    str   = Query(None),
    fvg_strength:  str   = Query(None),
    limit:         int   = Query(2500),
):
    db = _db(request)
    if db is None:
        return {"success": False, "error": "Database not connected"}
    filters = {
        "rsi_min": rsi_min, "rsi_max": rsi_max,
        "score_min": score_min, "min_fvg_count": min_fvg_count,
        "price_min": price_min, "price_max": price_max,
        "has_fvg_only": has_fvg_only, "fvg_status": fvg_status, "fvg_strength": fvg_strength,
    }
    data = await get_scanner_service(db).get_fvg_stocks(filters, limit)
    return {"success": True, "count": len(data), "data": data}


# ── Momentum Scanner ──────────────────────────────────────────────────────────

@router.get("/momentum")
async def momentum(
    request: Request,
    score_min:        int   = Query(None),
    score_max:        int   = Query(None),
    rsi_min:          float = Query(None),
    rsi_max:          float = Query(None),
    ema50_dist_min:   float = Query(None),
    ema200_dist_min:  float = Query(None),
    price_min:        float = Query(None),
    price_max:        float = Query(None),
    volume_ratio_min: float = Query(None),
    week52_dist_max:  float = Query(None),
    category:         str   = Query(None),
    above_ema50:      bool  = Query(None),
    above_ema200:     bool  = Query(None),
    limit:            int   = Query(200),
):
    db = _db(request)
    if db is None:
        return {"success": False, "error": "Database not connected"}
    filters = {
        "score_min": score_min, "score_max": score_max,
        "rsi_min": rsi_min, "rsi_max": rsi_max,
        "ema50_dist_min": ema50_dist_min, "ema200_dist_min": ema200_dist_min,
        "price_min": price_min, "price_max": price_max,
        "volume_ratio_min": volume_ratio_min, "week52_dist_max": week52_dist_max,
        "category": category, "above_ema50": above_ema50, "above_ema200": above_ema200,
    }
    data = await get_scanner_service(db).get_momentum_stocks(filters, limit)
    return {"success": True, "count": len(data), "data": data}


# ── Scan Status ───────────────────────────────────────────────────────────────

@v2_router.get("/scan-status")
async def scan_status(request: Request):
    db = _db(request)
    if db is None:
        return {"success": False, "error": "Database not connected"}

    meta = await db.get_collection("scan_meta").find_one({"_id": "daily_scan"})
    if not meta:
        return {"success": True, "data": {"status": "never_run", "last_ran": None}}

    meta.pop("_id", None)
    return {"success": True, "data": meta}


# ── Trigger Scan ──────────────────────────────────────────────────────────────

@v2_router.post("/trigger-scan")
async def trigger_scan(request: Request, background_tasks: BackgroundTasks):
    db = _db(request)
    if db is None:
        raise HTTPException(503, "Database not connected")

    try:
        from schedulers.daily_refresh import run_daily_scan
        background_tasks.add_task(run_daily_scan, request.app.state, force=True)
        return {
            "success": True,
            "message": "Scan triggered in background. Check /api/v2/scanner/scan-status for progress."
        }
    except Exception as e:
        raise HTTPException(500, f"Failed to trigger scan: {e}")
