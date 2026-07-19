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
import logging
import math
import time
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Request, Query, BackgroundTasks, HTTPException
from services.scanner_service import get_scanner_service

router = APIRouter(prefix="/api/scanner", tags=["scanner"])

# Second router for v2-prefixed control endpoints
v2_router = APIRouter(prefix="/api/v2/scanner", tags=["scanner_control"])

log = logging.getLogger("finai_edge.api.screener")


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
    volume_ratio_min:         float = Query(None),
    price_min:                float = Query(None),
    price_max:                float = Query(None),
    avg_1d_min:               float = Query(None),
    win_rate_min:             float = Query(None),
    surges_min:               int   = Query(None),
    surges_3yr_min:           int   = Query(None),
    max_gain_min:             float = Query(None),
    day_return_min:           float = Query(None),
    day_return_max:           float = Query(None),
    positive_surge_pct_min:  float = Query(None),
    current_surge_only:       bool  = Query(False),
    include_history:          bool  = Query(True),
    limit:                    int   = Query(2500),
):
    db = _db(request)
    if db is None:
        return {"success": False, "error": "Database not connected"}
    # Merge surges_3yr_min into surges_min (frontend compat)
    effective_surges_min = surges_min or surges_3yr_min
    filters = {
        "volume_ratio_min": volume_ratio_min, "price_min": price_min, "price_max": price_max,
        "avg_1d_min": avg_1d_min, "win_rate_min": win_rate_min,
        "surges_min": effective_surges_min, "max_gain_min": max_gain_min,
        "day_return_min": day_return_min, "day_return_max": day_return_max,
        "positive_surge_pct_min": positive_surge_pct_min,
        "current_surge_only": current_surge_only,
        "include_history": include_history,
    }
    data = await get_scanner_service(db).get_volume_surges(filters, limit)
    return {"success": True, "count": len(data), "data": data}


@router.get("/volume-surge-summary")
async def volume_surge_summary(
    request: Request,
    volume_ratio_min:         float = Query(None),
    price_min:                float = Query(None),
    price_max:                float = Query(None),
    surges_min:               int   = Query(None),
    surges_3yr_min:           int   = Query(None),
    day_return_min:           float = Query(None),
    day_return_max:           float = Query(None),
    positive_surge_pct_min:  float = Query(None),
    current_surge_only:       bool  = Query(False),
    limit:                    int   = Query(2500),
):
    """Lightweight endpoint that excludes surge_history for fast page load."""
    db = _db(request)
    if db is None:
        return {"success": False, "error": "Database not connected"}
    effective_surges_min = surges_min or surges_3yr_min
    filters = {
        "volume_ratio_min": volume_ratio_min, "price_min": price_min, "price_max": price_max,
        "surges_min": effective_surges_min,
        "day_return_min": day_return_min, "day_return_max": day_return_max,
        "positive_surge_pct_min": positive_surge_pct_min,
        "current_surge_only": current_surge_only,
        "include_history": False,  # key difference: no surge_history
    }
    data = await get_scanner_service(db).get_volume_surges(filters, limit)
    return {"success": True, "count": len(data), "data": data}


# ── FVG Scanner ───────────────────────────────────────────────────────────────

@router.get("/fvg")
async def fvg(
    request: Request,
    distance_fvg_min:  float = Query(None),
    distance_fvg_max:  float = Query(None),
    price_min:         float = Query(None),
    price_max:         float = Query(None),
    distance_high_min: float = Query(None),
    distance_high_max: float = Query(None),
    distance_low_min:  float = Query(None),
    distance_low_max:  float = Query(None),
    near_52w_high:     bool  = Query(None),
    near_52w_low:      bool  = Query(None),
    symbol:            str   = Query(None),
    has_fvg_only:      bool  = Query(True),
    limit:             int   = Query(2500),
):
    db = _db(request)
    if db is None:
        return {"success": False, "error": "Database not connected"}
    filters = {
        "distance_fvg_min": distance_fvg_min,
        "distance_fvg_max": distance_fvg_max,
        "price_min": price_min,
        "price_max": price_max,
        "distance_high_min": distance_high_min,
        "distance_high_max": distance_high_max,
        "distance_low_min": distance_low_min,
        "distance_low_max": distance_low_max,
        "near_52w_high": near_52w_high,
        "near_52w_low": near_52w_low,
        "symbol": symbol,
        "has_fvg_only": has_fvg_only,
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


# ── Nifty Index Universes for Branded Strategies ──────────────────────────────

NIFTY_50 = {
    "ADANIENT", "ADANIPORTS", "APOLLOHOSP", "ASIANPAINT", "AXISBANK", "BAJAJ-AUTO",
    "BAJFINANCE", "BAJAJFINSV", "BEL", "BHARTIARTL", "BPCL", "BRITANNIA", "CIPLA",
    "COALINDIA", "DIVISLAB", "DRREDDY", "EICHERMOT", "GRASIM", "HCLTECH", "HDFCBANK",
    "HDFCLIFE", "HEROMOTOCO", "HINDALCO", "HINDUNILVR", "ICICIBANK", "INDUSINDBK",
    "INFY", "ITC", "JSWSTEEL", "KOTAKBANK", "LT", "LTIM", "M&M", "MARUTI", "NESTLEIND",
    "NTPC", "ONGC", "POWERGRID", "RELIANCE", "SBILIFE", "SBIN", "SUNPHARMA", "TATACONSUM",
    "TATAMOTORS", "TATASTEEL", "TCS", "TECHM", "TITAN", "ULTRACEMCO", "WIPRO"
}

NIFTY_NEXT_50 = {
    "ABB", "ACC", "ADANIENSOL", "ADANIGREEN", "ADANIPOWER", "AMBUJACEM", "COLPAL",
    "DLF", "DMART", "GAIL", "HAL", "HAVELLS", "INDIGO", "IOC", "IRCTC", "JIOFIN",
    "LICI", "MARICO", "MUTHOOTFIN", "NAUKRI", "PFC", "PIDILITIND", "PNB", "RECLTD",
    "SHREECEM", "SRF", "TATACOMM", "TATAPOWER", "TRENT", "TVSMOTOR", "UNITDSPR",
    "VBL", "SIEMENS", "BOSCHLTD", "ZOMATO", "BANKBARODA", "CANBK", "CHOLAFIN",
    "ICICIPRULI", "ICICIGI", "JINDALSTEL", "MAXHEALTH", "NHPC", "OBEROIRLTY",
    "POLYCAB", "SBICARD", "SHAFTLER", "SOLARINDS", "SJVN", "YESBANK"
}


# ── Proprietary: LaunchPad Strategy ───────────────────────────────────────────

def _risk_label(risk_pct) -> str:
    rp = risk_pct or 0.0
    if rp < 3.0:
        return "Low"
    if rp < 6.0:
        return "Medium"
    return "High"


def _launchpad_response(d: dict) -> dict:
    """Map a launchpad_cache doc → API row: keep the rich fields (signal_strength,
    confidence_breakdown, ATR-based trade) AND add legacy aliases the existing
    frontend consumes (risk label, expected_return, risk_reward string, rsi)."""
    entry = d.get("entry") or 0.0
    reward = d.get("reward_per_share") or 0.0
    expected_return = round(reward / entry * 100.0, 1) if entry else 0.0
    return {
        **d,
        "risk": _risk_label(d.get("risk_pct")),
        "expected_return": expected_return,
        "holding_period": "5-7",                       # renders as "5-7 Days"
        "risk_reward": f"1:{d.get('risk_reward', 2.0)}",
        "rsi": d.get("rsi_14"),
        "ema_200_dist": d.get("ema_200_dist_pct"),
        "nearest_fvg_dist": d.get("fvg_dist_pct"),
    }


@router.get("/launchpad")
async def get_launchpad(
    request: Request,
    market:          str   = Query("all"),
    price_min:       float = Query(None),
    price_max:       float = Query(None),
    min_return:      float = Query(None),
    min_confidence:  float = Query(None),
    limit:           int   = Query(100),
):
    """
    LaunchPad — momentum-swing continuation (5-7 day hold). Reads the
    precomputed `launchpad_cache` (built by the Strategy Engine): price holding
    just above a fresh unmitigated bullish FVG, inside the EMA200 band
    [-10%, +20%]. All trade/confidence values are engine-derived (no placeholders).
    """
    t_req0 = time.time()
    db = _db(request)
    if db is None:
        return {"success": False, "error": "Database not connected"}

    col = db.get_collection("launchpad_cache")
    # No lazy-build: rebuilding here would run the strategy against whatever
    # OHLCV happens to already be in the process's in-memory cache, which may
    # predate the last real download — silently serving stale results with no
    # signal to the caller. A full Run Full Scan (POST /trigger-scan) is the
    # only way this cache gets (re)built; an empty cache here means "no scan
    # has completed yet," which the frontend renders as an explicit empty state.
    documents_in_cache = await col.count_documents({})
    if documents_in_cache == 0:
        return {"success": True, "count": 0, "data": [], "cache_empty": True}

    query: dict = {}
    if min_confidence is not None:
        query["confidence"] = {"$gte": min_confidence}
    price_q: dict = {}
    if price_min is not None:
        price_q["$gte"] = price_min
    if price_max is not None:
        price_q["$lte"] = price_max
    if price_q:
        query["cmp"] = price_q

    docs = await col.find(query, {"_id": 0}).sort("confidence", -1).to_list(length=2000)

    out = []
    for d in docs:
        symbol = d.get("symbol", "")
        if market == "nifty50" and symbol not in NIFTY_50:
            continue
        if market == "nifty_next50" and symbol not in NIFTY_NEXT_50:
            continue
        if market == "nifty200" and symbol not in NIFTY_50 and symbol not in NIFTY_NEXT_50:
            continue
        row = _launchpad_response(d)
        if min_return is not None and row["expected_return"] < min_return:
            continue
        out.append(row)

    from engines.strategies.runner import _CACHE_META
    cache_meta = _CACHE_META.get("launchpad_cache", {})
    log.info(
        f"[GET /launchpad] scan_id={cache_meta.get('scan_id', 'n/a')} | "
        f"cache_timestamp={cache_meta.get('written_at', 'n/a')} | "
        f"documents_in_cache={documents_in_cache} | "
        f"filters={{market={market}, price=[{price_min}-{price_max}], "
        f"min_confidence={min_confidence}, min_return={min_return}}} | "
        f"documents_returned={len(out[:limit])} | "
        f"response_time={time.time() - t_req0:.3f}s"
    )

    return {"success": True, "count": len(out[:limit]), "data": _fmt(out[:limit])["data"]}


# ── Proprietary: Alpha Zone Strategy ──────────────────────────────────────────

@router.get("/alpha-zone")
async def get_alpha_zone(
    request: Request,
    freshness:       str   = Query("all"),
    distance:        str   = Query("all"),
    min_return:      float = Query(None),
    holding_period:  int   = Query(None),
    limit:           int   = Query(100),
):
    """
    Alpha Zone proprietary institutional swing strategy.
    Criteria:
      - Entry near or inside demand zone (unmitigated order blocks)
    """
    t_req0 = time.time()
    db = _db(request)
    if db is None:
        return {"success": False, "error": "Database not connected"}

    col = db.get_collection("alpha_zone_cache")
    # No lazy-build — see the matching comment on GET /launchpad above for why.
    documents_in_cache = await col.count_documents({})
    if documents_in_cache == 0:
        return {"success": True, "count": 0, "data": [], "cache_empty": True}

    query: dict = {}
    # Freshness filter (on the derived zone_type)
    if freshness == "fresh":
        query["zone_type"] = "Fresh"
    elif freshness == "retested":
        query["zone_type"] = {"$in": ["Retested Once", "Retested"]}
    # Distance filter
    if distance == "inside":
        query["distance_pct"] = {"$lte": 0.0}
    elif distance == "within_2":
        query["distance_pct"] = {"$lte": 2.0}
    elif distance == "within_5":
        query["distance_pct"] = {"$lte": 5.0}
    if min_return is not None:
        query["projected_return"] = {"$gte": min_return}

    docs = await col.find(query, {"_id": 0}).sort("institutional_score", -1).to_list(length=2000)

    out = []
    for d in docs:
        if holding_period is not None:
            eh = d.get("expected_holding", 0)
            if holding_period == 30 and eh > 40:
                continue
            if holding_period == 60 and (eh < 40 or eh > 75):
                continue
            if holding_period == 90 and eh < 75:
                continue
        out.append(d)

    from engines.strategies.runner import _CACHE_META
    cache_meta = _CACHE_META.get("alpha_zone_cache", {})
    log.info(
        f"[GET /alpha-zone] scan_id={cache_meta.get('scan_id', 'n/a')} | "
        f"cache_timestamp={cache_meta.get('written_at', 'n/a')} | "
        f"documents_in_cache={documents_in_cache} | "
        f"filters={{freshness={freshness}, distance={distance}, "
        f"min_return={min_return}, holding_period={holding_period}}} | "
        f"documents_returned={len(out[:limit])} | "
        f"response_time={time.time() - t_req0:.3f}s"
    )

    return {"success": True, "count": len(out[:limit]), "data": _fmt(out[:limit])["data"]}


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

    # `meta` already includes `stage`/`symbols_processed`/`total_symbols`/
    # `launchpad_processed`/`alpha_zone_processed` etc — this is what the
    # frontend's Run Full Scan stepper polls. active_scan_ids is logged (not
    # returned) purely for concurrency visibility.
    from schedulers.daily_refresh import _ACTIVE_SCANS
    active = list(_ACTIVE_SCANS.keys())
    log.info(
        f"[GET /scan-status] active_scan_ids={active or 'none'} | "
        f"overall_status={meta.get('overall_status', meta.get('status'))} | "
        f"stage={(meta.get('stages') or {}).keys()} | "
        f"updated_at={meta.get('last_ran')}"
    )
    if meta.get("overall_status") == "RUNNING" and not active:
        # Invariant violated: RUNNING with nothing active means an orphaned
        # scan slipped past startup reconciliation (e.g. it crashed AFTER
        # this process booted, not before) — surface it loudly rather than
        # let the frontend silently show a stuck progress bar forever.
        log.warning(
            f"[GET /scan-status] INVARIANT VIOLATION — overall_status=RUNNING but "
            f"active_scan_ids is empty (scan_id={meta.get('scan_id')})"
        )

    return {"success": True, "data": meta}


# ── Trigger Scan ──────────────────────────────────────────────────────────────

@v2_router.post("/trigger-scan")
async def trigger_scan(request: Request, background_tasks: BackgroundTasks):
    db = _db(request)
    if db is None:
        raise HTTPException(503, "Database not connected")

    try:
        from schedulers.daily_refresh import run_daily_scan, _ACTIVE_SCANS

        # Logged (not enforced) — there is currently no lock preventing a
        # second scan from starting while one is already running; see the
        # scanner pipeline audit's recommendations for adding one.
        already_active = list(_ACTIVE_SCANS.keys())
        req_id = f"REQ-{uuid.uuid4().hex[:6]}"
        log.info(
            f"[{req_id}] POST /trigger-scan received | "
            f"currently_active_scans={already_active or 'none'} | "
            f"no_lock_guard=True"
        )
        if already_active:
            log.warning(
                f"[{req_id}] POST /trigger-scan is about to queue ANOTHER scan while "
                f"{len(already_active)} scan(s) are already running: {already_active} "
                f"— nothing in this endpoint prevents that."
            )

        background_tasks.add_task(run_daily_scan, request.app.state, force=True, trigger="manual")
        return {
            "success": True,
            "message": "Scan triggered in background. Check /api/v2/scanner/scan-status for progress."
        }
    except Exception as e:
        raise HTTPException(500, f"Failed to trigger scan: {e}")
