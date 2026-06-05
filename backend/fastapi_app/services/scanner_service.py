"""
FinAI Edge — Scanner Service
=============================
Queries the pre-calculated MongoDB screener cache.
"""

import logging
from typing import List, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase

log = logging.getLogger("finai_edge.scanner_service")

class ScannerService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.get_collection("screener_cache")

    async def get_momentum_stocks(self, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Momentum logic: RSI > 70 and Price > EMA20
        """
        cursor = self.collection.find({
            "indicators.rsi_14": {"$gte": 70},
            "$expr": { "$gt": ["$price", "$indicators.ema_20"] }
        }).sort("indicators.rsi_14", -1).limit(limit)
        
        return await cursor.to_list(length=limit)

    async def get_volume_breakouts(self, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Volume Breakout: Current volume > 3x of average 10d volume
        """
        # Assuming avg_volume_10d is populated (we can update cron to populate it)
        cursor = self.collection.find({
            "$expr": { "$gt": ["$volume", { "$multiply": ["$avg_volume_10d", 3] }] }
        }).sort("volume", -1).limit(limit)
        
        return await cursor.to_list(length=limit)

    async def get_technical_screener(self, filters: Dict[str, Any], limit: int = 2500) -> List[Dict[str, Any]]:
        """
        Custom technical filters built dynamically.
        EMA filters use % distance from price to EMA (cross-stock comparable).
        """
        query = {}

        def add_range(field, mn, mx):
            q = {}
            if mn is not None: q["$gte"] = mn
            if mx is not None: q["$lte"] = mx
            if q: query[field] = q

        add_range("indicators.rsi_14",           filters.get("rsi_min"),          filters.get("rsi_max"))
        add_range("indicators.ema_50_dist_pct",  filters.get("ema50_dist_min"),   filters.get("ema50_dist_max"))
        add_range("indicators.ema_200_dist_pct", filters.get("ema200_dist_min"),  filters.get("ema200_dist_max"))
        add_range("indicators.macd",             filters.get("macd_min"),         filters.get("macd_max"))
        add_range("volume",                      filters.get("volume_min"),       filters.get("volume_max"))

        cursor = self.collection.find(query).sort("volume", -1).limit(limit)
        return await cursor.to_list(length=limit)


    async def get_fvg_stocks(self, filters: Dict[str, Any] = {}, limit: int = 2500) -> List[Dict[str, Any]]:
        """
        FVG Scanner — queries fvg_cache collection with dynamic filters.
        Falls back to screener_cache if fvg_cache is empty.
        """
        col   = self.db.get_collection("fvg_cache")
        count = await col.count_documents({})

        if count == 0:
            # Fallback: screener_cache while fvg_cache is being populated
            cursor = self.collection.find({"fvg.has_fvg_bullish": True}).limit(limit)
            return await cursor.to_list(length=limit)

        query: Dict[str, Any] = {}

        def add_gte(field, val):
            if val is not None:
                query.setdefault(field, {})["$gte"] = val

        def add_lte(field, val):
            if val is not None:
                query.setdefault(field, {})["$lte"] = val

        # RSI filter
        add_gte("indicators.rsi_14", filters.get("rsi_min"))
        add_lte("indicators.rsi_14", filters.get("rsi_max"))

        # FVG filter
        if filters.get("has_fvg_only", True):
            query["fvg.has_fvg_bullish"] = True

        # Min number of FVGs detected
        add_gte("fvg.total_fvgs_detected", filters.get("min_fvg_count"))

        # Price vs EMA filter
        add_gte("price", filters.get("price_min"))
        add_lte("price", filters.get("price_max"))

        cursor = col.find(query).sort("fvg.total_fvgs_detected", -1).limit(limit)
        return await cursor.to_list(length=limit)

    async def get_volume_surges(self, filters: Dict[str, Any], limit: int = 100) -> List[Dict[str, Any]]:
        """
        Volume Surge Scanner — queries volume_surge_cache collection.
        Dynamically filters by volume_ratio, day_return, 3yr surge stats.
        """
        col   = self.db.get_collection("volume_surge_cache")
        query: Dict[str, Any] = {}

        def add_gte(field, val):
            if val is not None:
                query.setdefault(field, {})["$gte"] = val

        def add_lte(field, val):
            if val is not None:
                query.setdefault(field, {})["$lte"] = val

        add_gte("volume_ratio",                      filters.get("volume_ratio_min"))
        add_gte("day_return_pct",                    filters.get("day_return_min"))
        add_lte("day_return_pct",                    filters.get("day_return_max"))
        add_gte("surge_stats.total_surge_days_3yr",  filters.get("surges_3yr_min"))
        add_gte("surge_stats.positive_surge_pct",    filters.get("positive_surge_pct_min"))

        if filters.get("current_surge_only"):
            query["has_current_surge"] = True

        cursor = col.find(query).sort("volume_ratio", -1).limit(limit)
        return await cursor.to_list(length=limit)

def get_scanner_service(db: AsyncIOMotorDatabase) -> ScannerService:
    return ScannerService(db)
