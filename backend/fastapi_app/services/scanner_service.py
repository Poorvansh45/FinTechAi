"""
FinAI Edge — Scanner Service (v2)
====================================
Queries the pre-calculated MongoDB screener caches.
Supports all scanner types:
  - Technical Screener (EMA% distance, RSI, MACD, Volume)
  - Volume Surge (per-surge history + aggregate stats)
  - FVG Scanner (ICT-style with scoring)
  - Momentum Scanner (Momentum Score 0-100)
"""

import logging
from typing import List, Dict, Any, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase

log = logging.getLogger("finai_edge.scanner_service")


class ScannerService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db         = db
        self.screener   = db.get_collection("screener_cache")
        self.fvg_cache  = db.get_collection("fvg_cache")
        self.surge_cache = db.get_collection("volume_surge_cache")
        self.momentum   = db.get_collection("momentum_cache")

    # ── helpers ──────────────────────────────────────────────────────────

    @staticmethod
    def _range(query: dict, field: str, mn=None, mx=None):
        q: dict = {}
        if mn is not None: q["$gte"] = mn
        if mx is not None: q["$lte"] = mx
        if q:
            query[field] = q

    # ── Technical Screener ────────────────────────────────────────────────

    async def get_technical_screener(
        self,
        filters: Dict[str, Any],
        limit: int = 2500,
    ) -> List[Dict[str, Any]]:
        """
        Dynamic technical filter using EMA % distance (cross-stock comparable).
        """
        query: dict = {}
        r = self._range

        r(query, "indicators.rsi_14",           filters.get("rsi_min"),          filters.get("rsi_max"))
        r(query, "indicators.ema_50_dist_pct",  filters.get("ema50_dist_min"),   filters.get("ema50_dist_max"))
        r(query, "indicators.ema_200_dist_pct", filters.get("ema200_dist_min"),  filters.get("ema200_dist_max"))
        r(query, "indicators.macd",             filters.get("macd_min"),         filters.get("macd_max"))
        r(query, "volume",                      filters.get("volume_min"),       filters.get("volume_max"))

        sort_key = filters.get("sort_by", "volume")
        sort_dir = -1 if filters.get("sort_dir", "desc") == "desc" else 1

        cursor = self.screener.find(query, {"_id": 0}).sort(sort_key, sort_dir).limit(limit)
        return await cursor.to_list(length=limit)

    # ── Volume Breakout (simple) ──────────────────────────────────────────

    async def get_volume_breakouts(self, limit: int = 50) -> List[Dict[str, Any]]:
        cursor = self.screener.find({
            "$expr": {"$gt": ["$volume", {"$multiply": ["$avg_volume_10d", 3]}]}
        }, {"_id": 0}).sort("volume", -1).limit(limit)
        return await cursor.to_list(length=limit)

    # ── Volume Surge (full per-surge history) ─────────────────────────────

    async def get_volume_surges(
        self,
        filters: Dict[str, Any],
        limit: int = 2500,
    ) -> List[Dict[str, Any]]:
        """
        Full volume surge scanner with per-surge history.
        Supports projection to exclude surge_history for fast page loads.
        """
        query: dict = {}
        r = self._range

        r(query, "volume_ratio",                      filters.get("volume_ratio_min"))
        r(query, "surge_stats.avg_1d_return",         filters.get("avg_1d_min"))
        r(query, "surge_stats.win_rate_1d",           filters.get("win_rate_min"))
        r(query, "surge_stats.total_surges",          filters.get("surges_min"))
        r(query, "surge_stats.max_gain_ever",         filters.get("max_gain_min"))
        r(query, "day_return_pct",                    filters.get("day_return_min"), filters.get("day_return_max"))
        r(query, "surge_stats.positive_surge_pct",    filters.get("positive_surge_pct_min"))

        if filters.get("current_surge_only"):
            query["has_current_surge"] = True

        r(query, "ltp", filters.get("price_min"), filters.get("price_max"))

        # Projection: exclude heavy fields when not needed
        projection = {"_id": 0}
        include_history = filters.get("include_history", True)
        if not include_history:
            projection["surge_history"] = 0

        cursor = self.surge_cache.find(query, projection).sort("volume_ratio", -1).limit(limit)
        return await cursor.to_list(length=limit)

    # ── FVG Scanner (ICT Rebuild) ────────────────────────────────────────

    async def get_fvg_stocks(
        self,
        filters: Dict[str, Any],
        limit: int = 2500,
    ) -> List[Dict[str, Any]]:
        """
        Trader-focused Active FVG scanner querying fvg_scan_results cache.
        """
        col = self.db.get_collection("fvg_scan_results")
        query: dict = {}
        r = self._range

        # Filter ranges
        r(query, "ltp",                      filters.get("price_min"),        filters.get("price_max"))
        r(query, "nearest_fvg_dist_pct",     filters.get("distance_fvg_min"), filters.get("distance_fvg_max"))
        
        # 52W Distance ranges
        r(query, "distance_high_pct",        filters.get("distance_high_min"), filters.get("distance_high_max"))
        r(query, "distance_low_pct",         filters.get("distance_low_min"),  filters.get("distance_low_max"))

        # Boolean switches for 52W proximity
        if filters.get("near_52w_high"):
            query["distance_high_pct"] = {"$gte": -5.0}
            
        if filters.get("near_52w_low"):
            query["distance_low_pct"] = {"$lte": 5.0}

        # Single symbol query support (for details sidebar panel)
        symbol = filters.get("symbol")
        if symbol:
            query["symbol"] = symbol.strip().upper()

        # Require at least one active FVG unless explicitly disabled
        if filters.get("has_fvg_only", True):
            query["nearest_fvg_dist_pct"] = {"$ne": None}

        cursor = col.find(query, {"_id": 0}).sort([("nearest_fvg_dist_pct", 1)]).limit(limit)
        return await cursor.to_list(length=limit)

    # ── Momentum Scanner ──────────────────────────────────────────────────

    async def get_momentum_stocks(
        self,
        filters: Dict[str, Any] = {},
        limit: int = 200,
    ) -> List[Dict[str, Any]]:
        """
        Momentum scanner using pre-computed momentum scores.
        """
        col   = self.momentum
        count = await col.count_documents({})

        if count == 0:
            # Fallback to screener_cache while momentum cache builds
            query_fb = {"indicators.rsi_14": {"$gte": 55}}
            cursor = self.screener.find(query_fb, {"_id": 0}).sort("indicators.rsi_14", -1).limit(limit)
            return await cursor.to_list(length=limit)

        query: dict = {}
        r = self._range

        r(query, "momentum_score",     filters.get("score_min"), filters.get("score_max"))
        r(query, "rsi",                filters.get("rsi_min"),   filters.get("rsi_max"))
        r(query, "ema_50_dist_pct",    filters.get("ema50_dist_min"))
        r(query, "ema_200_dist_pct",   filters.get("ema200_dist_min"))
        r(query, "ltp",                filters.get("price_min"), filters.get("price_max"))
        r(query, "volume_ratio",       filters.get("volume_ratio_min"))
        r(query, "week52_high_dist_pct", None, filters.get("week52_dist_max"))

        cat = filters.get("category")
        if cat and cat != "All":
            query["category"] = cat

        if filters.get("above_ema50"):
            query["above_ema50"] = True
        if filters.get("above_ema200"):
            query["above_ema200"] = True

        cursor = col.find(query, {"_id": 0}).sort("momentum_score", -1).limit(limit)
        return await cursor.to_list(length=limit)


def get_scanner_service(db: AsyncIOMotorDatabase) -> ScannerService:
    return ScannerService(db)
