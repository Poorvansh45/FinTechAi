"""
FinAI Edge — SMC Service (v2)
================================
Orchestrates the full SMC analysis pipeline:
  - BOS / CHoCH detection
  - Demand / Supply Order Blocks
  - Equal Highs / Equal Lows
  - Liquidity Sweeps
  - Premium / Discount / Equilibrium zones
  - SMC Score (0–100)

Queries and updates MongoDB smc_scanner_results collection.
"""

import logging
import asyncio
import pandas as pd
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase

from services.market_service import MarketDataService
from scanners.smc_scanner import (
    run_full_smc_analysis,
    process_smc_zones,
    calculate_zone_metrics,
)

log = logging.getLogger("finai_edge.smc_service")


def _serialize(obj):
    """Recursively make a dict JSON-safe (ObjectId, Timestamp, etc.)."""
    if isinstance(obj, dict):
        return {k: _serialize(v) for k, v in obj.items() if k != "_id" or True}
    if isinstance(obj, list):
        return [_serialize(i) for i in obj]
    if isinstance(obj, pd.Timestamp):
        return obj.strftime("%Y-%m-%d")
    if isinstance(obj, datetime):
        return obj.strftime("%Y-%m-%d")
    try:
        from bson import ObjectId
        if isinstance(obj, ObjectId):
            return str(obj)
    except ImportError:
        pass
    return obj


class SMCService:
    def __init__(self, db: AsyncIOMotorDatabase, market_service: MarketDataService):
        self.db             = db
        self.market_service = market_service
        self.zones_col      = db.get_collection("smc_zones")
        self.results_col    = db.get_collection("smc_scanner_results")
        self.history_col    = db.get_collection("smc_scanner_history")

    # ── Internal: run one symbol ──────────────────────────────────────────

    async def run_scan_for_symbol(self, symbol: str) -> Optional[Dict[str, Any]]:
        """
        Full SMC scan for one symbol.
        Fetches 2 years of daily candles, runs the full pipeline, persists to MongoDB.
        """
        try:
            candles = await self.market_service.get_historical(symbol, interval="1d", period="2y")
            if not candles:
                log.warning(f"[SMC] No candles for {symbol}")
                return None

            df = pd.DataFrame([c.model_dump() for c in candles])
            if df.empty:
                return None

            df.rename(columns={"timestamp": "Date", "date": "Date", "open": "Open", "high": "High",
                                "low": "Low", "close": "Close", "volume": "Volume"}, inplace=True)
            df["Date"] = pd.to_datetime(df["Date"])

            # Fetch last indicators from screener_cache for RSI/volume_ratio
            cache_doc = await self.db.screener_cache.find_one({"symbol": symbol})
            rsi          = cache_doc.get("indicators", {}).get("rsi_14")     if cache_doc else None
            volume_ratio = cache_doc.get("volume_ratio")                     if cache_doc else None

            result = await asyncio.to_thread(
                run_full_smc_analysis, df, symbol,
                swing_len=5, rsi=rsi, volume_ratio=volume_ratio
            )

            if not result:
                return None

            result["updated_at"] = datetime.now(timezone.utc)
            result_clean = _serialize(result)

            await self.results_col.update_one(
                {"symbol": symbol},
                {"$set": result_clean},
                upsert=True,
            )

            # Persist individual zones
            all_zones = (
                result.get("demand_zones", []) +
                result.get("supply_zones", []) +
                result.get("internal_demand_zones", []) +
                result.get("internal_supply_zones", [])
            )
            for zone in all_zones:
                zone_clean = _serialize(zone)
                zone_clean["symbol"] = symbol
                await self.zones_col.update_one(
                    {"symbol": symbol, "zone_high": zone["zone_high"], "zone_low": zone["zone_low"]},
                    {"$set": zone_clean},
                    upsert=True,
                )

            return result_clean

        except Exception as e:
            log.error(f"[SMC] Error scanning {symbol}: {e}", exc_info=True)
            return None

    # ── Public: scanner results ───────────────────────────────────────────

    async def get_scanner_results(
        self,
        filters: Dict[str, Any],
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """
        Return paginated/filtered SMC scanner results.

        Filter keys (all optional):
          category     : "Inside Zone"|"Near Zone (2%)"|"Near Zone (5%)"|
                         "Fresh Zones"|"CHoCH Zones"|"BOS Zones"|
                         "Premium"|"Discount"|"Unmitigated"
          min_score    : int  — minimum SMC score
          event        : "BOS"|"CHoCH"
          direction    : "bullish"|"bearish"
        """
        query: Dict[str, Any] = {}

        cat = filters.get("category", "")
        if cat == "Inside Zone":
            query["nearest_demand.distance_pct"] = 0.0
        elif cat == "Near Zone (2%)":
            query["nearest_demand.distance_pct"] = {"$gt": 0.0, "$lte": 2.0}
        elif cat == "Near Zone (5%)":
            query["nearest_demand.distance_pct"] = {"$gt": 0.0, "$lte": 5.0}
        elif cat == "Fresh Zones":
            query["nearest_demand.zone_age_days"] = {"$lte": 10}
        elif cat == "CHoCH Zones":
            query["structure.last_bullish_event"] = "CHoCH"
        elif cat == "BOS Zones":
            query["structure.last_bullish_event"] = "BOS"
        elif cat == "Premium":
            query["current_zone"] = "Premium"
        elif cat == "Discount":
            query["current_zone"] = "Discount"
        elif cat == "Unmitigated":
            query["nearest_demand.touch_count"] = 0

        if filters.get("min_score") is not None:
            query["smc_score"] = {"$gte": int(filters["min_score"])}

        if filters.get("event"):
            query["structure.last_bullish_event"] = filters["event"]

        cursor = self.results_col.find(query).sort("smc_score", -1).limit(limit)
        results = await cursor.to_list(length=limit)
        for r in results:
            r["_id"] = str(r["_id"])
        return results

    async def get_dashboard_stats(self) -> Dict[str, Any]:
        total      = await self.results_col.count_documents({})
        inside     = await self.results_col.count_documents({"nearest_demand.distance_pct": 0.0})
        within_2   = await self.results_col.count_documents({"nearest_demand.distance_pct": {"$gt": 0.0, "$lte": 2.0}})
        within_5   = await self.results_col.count_documents({"nearest_demand.distance_pct": {"$gt": 0.0, "$lte": 5.0}})
        bos_count  = await self.results_col.count_documents({"structure.last_bullish_event": "BOS"})
        choch_count = await self.results_col.count_documents({"structure.last_bullish_event": "CHoCH"})
        high_score = await self.results_col.count_documents({"smc_score": {"$gte": 70}})

        pipeline = [{"$group": {"_id": None, "avg_score": {"$avg": "$smc_score"}}}]
        agg = await self.results_col.aggregate(pipeline).to_list(length=1)
        avg_score = round(agg[0]["avg_score"], 1) if agg else 0.0

        return {
            "total_active_zones": total,
            "inside_zone":        inside,
            "within_2_pct":       within_2,
            "within_5_pct":       within_5,
            "bos_count":          bos_count,
            "choch_count":        choch_count,
            "high_score_count":   high_score,
            "avg_smc_score":      avg_score,
        }

    async def get_zone_details(self, symbol: str) -> Dict[str, Any]:
        """Full SMC data for a single symbol."""
        result = await self.results_col.find_one({"symbol": symbol})
        if result:
            result["_id"] = str(result["_id"])
            return result

        # Not cached — run live
        fresh = await self.run_scan_for_symbol(symbol)
        return fresh or {"symbol": symbol, "error": "No data available"}


def get_smc_service(db: AsyncIOMotorDatabase, market_service: MarketDataService) -> SMCService:
    return SMCService(db, market_service)
