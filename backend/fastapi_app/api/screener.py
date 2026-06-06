import math
from fastapi import APIRouter, Request, Query
from services.scanner_service import get_scanner_service

router = APIRouter(prefix="/api/scanner", tags=["scanner"])


def sanitize(val):
    """Convert NaN/Inf floats to None for JSON safety."""
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    return val

def sanitize_item(item: dict) -> dict:
    """Recursively sanitize a dict for JSON compliance."""
    clean = {}
    for k, v in item.items():
        if k == "_id":
            clean[k] = str(v)
        elif isinstance(v, dict):
            clean[k] = sanitize_item(v)
        elif isinstance(v, float):
            clean[k] = sanitize(v)
        else:
            clean[k] = v
    return clean

def format_response(data):
    cleaned = [sanitize_item(item) for item in data]
    return {"success": True, "count": len(cleaned), "data": cleaned}


@router.get("/volume")
async def volume(request: Request, limit: int = Query(50)):
    if not hasattr(request.app.state, "db") or request.app.state.db is None:
        return {"success": False, "error": "Database not connected"}
    
    svc = get_scanner_service(request.app.state.db)
    data = await svc.get_volume_breakouts(limit)
    return format_response(data)

@router.get("/fvg")
async def fvg(
    request: Request,
    rsi_min:       float = Query(None),
    rsi_max:       float = Query(None),
    min_fvg_count: int   = Query(None),
    price_min:     float = Query(None),
    price_max:     float = Query(None),
    has_fvg_only:  bool  = Query(True),
    limit:         int   = Query(2500),
):
    if not hasattr(request.app.state, "db") or request.app.state.db is None:
        return {"success": False, "error": "Database not connected"}

    filters = {
        "rsi_min":       rsi_min,
        "rsi_max":       rsi_max,
        "min_fvg_count": min_fvg_count,
        "price_min":     price_min,
        "price_max":     price_max,
        "has_fvg_only":  has_fvg_only,
    }
    svc  = get_scanner_service(request.app.state.db)
    data = await svc.get_fvg_stocks(filters, limit)
    return format_response(data)

@router.get("/technical")
async def technical(
    request: Request,
    rsi_min:         float = Query(None),
    rsi_max:         float = Query(None),
    ema50_dist_min:  float = Query(None, description="EMA50 distance % min (e.g. +2 = price 2% above EMA50)"),
    ema50_dist_max:  float = Query(None),
    ema200_dist_min: float = Query(None, description="EMA200 distance % min (e.g. +5 = price 5% above EMA200)"),
    ema200_dist_max: float = Query(None),
    macd_min:        float = Query(None),
    macd_max:        float = Query(None),
    volume_min:      int   = Query(None),
    volume_max:      int   = Query(None),
    limit:           int   = Query(2500),
):
    if not hasattr(request.app.state, "db") or request.app.state.db is None:
        return {"success": False, "error": "Database not connected"}

    filters = {
        "rsi_min": rsi_min, "rsi_max": rsi_max,
        "ema50_dist_min": ema50_dist_min, "ema50_dist_max": ema50_dist_max,
        "ema200_dist_min": ema200_dist_min, "ema200_dist_max": ema200_dist_max,
        "macd_min": macd_min, "macd_max": macd_max,
        "volume_min": volume_min, "volume_max": volume_max,
    }

    svc  = get_scanner_service(request.app.state.db)
    data = await svc.get_technical_screener(filters, limit)
    return format_response(data)


@router.get("/volume-surge")
async def volume_surge(
    request: Request,
    volume_ratio_min: float = Query(None),
    day_return_min: float = Query(None),
    day_return_max: float = Query(None),
    surges_3yr_min: int = Query(None),
    positive_surge_pct_min: float = Query(None),
    current_surge_only: bool = Query(False),
    limit: int = Query(100),
):
    """
    Volume Surge Scanner: Detects stocks with sudden volume spikes
    correlated with significant price moves over 3 years of history.
    """
    if not hasattr(request.app.state, "db") or request.app.state.db is None:
        return {"success": False, "error": "Database not connected"}

    svc = get_scanner_service(request.app.state.db)
    filters = {
        "volume_ratio_min":        volume_ratio_min,
        "day_return_min":          day_return_min,
        "day_return_max":          day_return_max,
        "surges_3yr_min":          surges_3yr_min,
        "positive_surge_pct_min":  positive_surge_pct_min,
        "current_surge_only":      current_surge_only,
    }
    data = await svc.get_volume_surges(filters, limit)
    return format_response(data)