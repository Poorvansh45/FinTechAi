"""
FinAI Edge — Zone Proximity Search Service
============================================
Implements the Search.py logic from the screener pipeline:
  - Load all SMC zones from MongoDB (smc_zones collection)
  - Join with latest price (LTP) from screener_cache
  - Filter: LTP within ±ZONE_THRESHOLD of zone
  - Filter: LTP in price range (e.g. ₹300–₹10,000)
  - Keep only ONE zone per stock (nearest)
  - Compare today's scan vs yesterday's to find:
      → OLD  : stocks that were in zone yesterday AND today
      → NEW  : stocks that entered zone today (weren't yesterday)
      → REMOVED: stocks that left the zone since yesterday

This runs after the daily SMC scan and produces a
"zone_proximity" collection for the screener to query.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase

log = logging.getLogger("finai_edge.zone_search")

ZONE_THRESHOLD = 0.10   # ±10% zone proximity window
PRICE_MIN      = 300.0
PRICE_MAX      = 10_000.0


def _calc_distance(ltp: float, zone_low: float, zone_high: float) -> float:
    """Distance % from LTP to the nearest zone edge."""
    if ltp < zone_low:
        return round((zone_low - ltp) / zone_low * 100, 2)
    elif ltp > zone_high:
        return round((ltp - zone_high) / zone_high * 100, 2)
    else:
        return 0.0   # inside zone


async def run_zone_proximity_search(db: AsyncIOMotorDatabase) -> Dict[str, Any]:
    """
    Main entry point. Runs the full zone-proximity search pipeline.
    Reads from: smc_zones, screener_cache
    Writes to:  zone_proximity_results

    Returns summary dict.
    """
    zones_col    = db.get_collection("smc_zones")
    screener_col = db.get_collection("screener_cache")
    results_col  = db.get_collection("zone_proximity_results")

    # ── 1. Load all active zones ──────────────────────────────────
    zones: List[Dict] = []
    async for z in zones_col.find({"status": "Active"}):
        zones.append(z)

    if not zones:
        log.warning("[ZoneSearch] No active zones in smc_zones collection")
        return {"total_zones": 0, "matched": 0, "new": 0, "removed": 0}

    # ── 2. Build LTP lookup from screener_cache ───────────────────
    ltp_map: Dict[str, float] = {}
    async for doc in screener_col.find({}, {"symbol": 1, "price": 1}):
        sym = doc.get("symbol")
        px  = doc.get("price")
        if sym and px:
            ltp_map[sym] = float(px)

    # ── 3. Merge zones with LTP and apply filters ─────────────────
    matched: List[Dict[str, Any]] = []

    for zone in zones:
        symbol    = zone.get("symbol", "")
        zone_high = float(zone.get("zone_high", 0))
        zone_low  = float(zone.get("zone_low", 0))
        zone_id   = str(zone.get("_id", ""))
        status    = zone.get("status", "Active")
        event     = zone.get("event", "")
        direction = zone.get("direction", "bullish")

        ltp = ltp_map.get(symbol)
        if not ltp:
            continue

        # Price range filter
        if not (PRICE_MIN <= ltp <= PRICE_MAX):
            continue

        # Zone proximity filter (±10%)
        lower_bound = zone_low  * (1 - ZONE_THRESHOLD)
        upper_bound = zone_high * (1 + ZONE_THRESHOLD)

        if not (lower_bound <= ltp <= upper_bound):
            continue

        distance_pct = _calc_distance(ltp, zone_low, zone_high)

        matched.append({
            "symbol":       symbol,
            "ltp":          ltp,
            "zone_id":      zone_id,
            "zone_high":    zone_high,
            "zone_low":     zone_low,
            "zone_mid":     round((zone_high + zone_low) / 2, 2),
            "status":       status,
            "event":        event,
            "direction":    direction,
            "distance_pct": distance_pct,
        })

    # ── 4. Keep only ONE zone per stock (nearest) ─────────────────
    by_symbol: Dict[str, Dict] = {}
    for m in sorted(matched, key=lambda x: x["distance_pct"]):
        if m["symbol"] not in by_symbol:
            by_symbol[m["symbol"]] = m

    final_results = list(by_symbol.values())
    final_results.sort(key=lambda x: x["distance_pct"])

    # ── 5. Load yesterday's results for delta detection ───────────
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    prev_doc  = await results_col.find_one({"_id": f"scan:{yesterday}"})
    prev_symbols = set(prev_doc.get("symbols", [])) if prev_doc else set()

    current_symbols = {r["symbol"] for r in final_results}
    new_symbols     = current_symbols - prev_symbols
    removed_symbols = prev_symbols  - current_symbols

    # ── 6. Persist results ────────────────────────────────────────
    today_key = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    await results_col.update_one(
        {"_id": f"scan:{today_key}"},
        {"$set": {
            "scanned_at":       datetime.now(timezone.utc),
            "symbols":          list(current_symbols),
            "new_symbols":      list(new_symbols),
            "removed_symbols":  list(removed_symbols),
            "total":            len(final_results),
            "results":          final_results,
        }},
        upsert=True,
    )

    # Upsert each result individually for fast symbol lookups
    for r in final_results:
        await results_col.update_one(
            {"symbol": r["symbol"]},
            {"$set": {**r, "updated_at": datetime.now(timezone.utc)}},
            upsert=True,
        )

    # Delete stale per-symbol documents (those not in the current scan results)
    await results_col.delete_many({
        "symbol": {"$exists": True, "$nin": list(current_symbols)}
    })

    log.info(
        f"[ZoneSearch] Done — {len(final_results)} near zone · "
        f"{len(new_symbols)} new · {len(removed_symbols)} removed"
    )

    return {
        "total_zones":   len(zones),
        "matched":       len(final_results),
        "new":           len(new_symbols),
        "removed":       len(removed_symbols),
        "new_symbols":   list(new_symbols),
        "removed_symbols": list(removed_symbols),
    }


async def get_zone_proximity_results(
    db: AsyncIOMotorDatabase,
    filters: Optional[Dict[str, Any]] = None,
    limit: int = 200,
) -> Dict[str, Any]:
    """
    Return zone proximity results from the last scan,
    split into OLD (existing), NEW, and REMOVED sheets —
    matching the Search.py output structure.
    """
    results_col = db.get_collection("zone_proximity_results")

    # Get the latest daily summary
    today_key = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    summary   = await results_col.find_one({"_id": f"scan:{today_key}"})

    if not summary:
        # Try yesterday
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
        summary   = await results_col.find_one({"_id": f"scan:{yesterday}"})

    if not summary:
        return {
            "old":     [],
            "new":     [],
            "removed": [],
            "scanned_at": None,
            "total": 0,
        }

    all_results     = summary.get("results", [])
    new_syms        = set(summary.get("new_symbols", []))
    removed_syms    = set(summary.get("removed_symbols", []))

    # Apply distance/price filters if requested
    if filters:
        min_dist = filters.get("distance_pct_max")
        if min_dist is not None:
            all_results = [r for r in all_results if r.get("distance_pct", 999) <= min_dist]

    old_sheet     = [r for r in all_results if r["symbol"] not in new_syms]
    new_sheet     = [r for r in all_results if r["symbol"] in new_syms]

    # Removed sheet from prev scan
    removed_sheet: List[Dict] = []
    for sym in removed_syms:
        removed_sheet.append({"symbol": sym, "status": "Removed"})

    return {
        "old":        old_sheet[:limit],
        "new":        new_sheet[:limit],
        "removed":    removed_sheet[:limit],
        "scanned_at": summary.get("scanned_at"),
        "total":      summary.get("total", 0),
    }
