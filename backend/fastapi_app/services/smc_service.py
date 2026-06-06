import logging
import asyncio
import pandas as pd
from typing import List, Dict, Any
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase
from services.market_service import MarketDataService
from scanners.smc_scanner import process_smc_zones, calculate_zone_metrics
from models.smc import SMCZone, SMCScannerResult, SMCHistoryEvent

log = logging.getLogger("finai_edge.smc_service")

class SMCService:
    def __init__(self, db: AsyncIOMotorDatabase, market_service: MarketDataService):
        self.db = db
        self.market_service = market_service
        self.zones_col = db.get_collection("smc_zones")
        self.results_col = db.get_collection("smc_scanner_results")
        self.history_col = db.get_collection("smc_scanner_history")

    async def run_scan_for_symbol(self, symbol: str) -> None:
        """
        Runs the SMC logic for a single symbol, fetching data from the market service,
        and updating the MongoDB collections.
        """
        try:
            candles = await self.market_service.get_historical(symbol, interval="1d", period="1y")
            if not candles:
                return

            df = pd.DataFrame([c.model_dump() for c in candles])
            if df.empty:
                return

            # Rename columns to match pandas script expectations
            df.rename(columns={'date': 'Date', 'high': 'High', 'low': 'Low', 'close': 'Close'}, inplace=True)
            df['Date'] = pd.to_datetime(df['Date'])

            zones = process_smc_zones(df, symbol)
            if not zones:
                return
                
            ltp = float(df.iloc[-1]['Close'])

            # Persist raw zones
            for z in zones:
                z['created_date'] = z['created_date'].to_pydatetime()
                if z['invalidated_date']:
                    z['invalidated_date'] = z['invalidated_date'].to_pydatetime()
                    
                await self.zones_col.update_one(
                    {"symbol": symbol, "zone_id": z['zone_id']},
                    {"$set": z},
                    upsert=True
                )

            # Filter for active zones and calculate metrics
            active_zones = [z for z in zones if z['status'] == 'Active']
            if not active_zones:
                return
                
            # Pick the nearest active zone for scanner results
            enriched_zones = [calculate_zone_metrics(z, ltp) for z in active_zones]
            enriched_zones.sort(key=lambda x: abs(x['distance_pct']))
            nearest_zone = enriched_zones[0]

            scanner_result = {
                "symbol": symbol,
                "ltp": ltp,
                "zone_id": nearest_zone['zone_id'],
                "zone_high": nearest_zone['zone_high'],
                "zone_low": nearest_zone['zone_low'],
                "zone_width_pct": nearest_zone['zone_width_pct'],
                "distance_pct": nearest_zone['distance_pct'],
                "created_date": nearest_zone['created_date'],
                "zone_age_days": nearest_zone['zone_age_days'],
                "event": nearest_zone['event'],
                "status": nearest_zone['status'],
                "updated_at": datetime.now(timezone.utc)
            }

            await self.results_col.update_one(
                {"symbol": symbol},
                {"$set": scanner_result},
                upsert=True
            )

        except Exception as e:
            log.error(f"Error processing SMC for {symbol}: {e}")

    async def get_scanner_results(self, filters: Dict[str, Any], limit: int = 50) -> List[Dict[str, Any]]:
        """
        Retrieves scanner results from MongoDB based on UI filters.
        """
        query: Dict[str, Any] = {}

        if "category" in filters:
            cat = filters["category"]
            if cat == "Inside Zone":
                query["distance_pct"] = 0.0
            elif cat == "Near Zone (2%)":
                query["distance_pct"] = {"$gt": 0.0, "$lte": 2.0}
            elif cat == "Near Zone (5%)":
                query["distance_pct"] = {"$gt": 0.0, "$lte": 5.0}
            elif cat == "Fresh Zones":
                query["zone_age_days"] = {"$lte": 7}
            elif cat == "CHoCH Zones":
                query["event"] = "CHoCH"
            elif cat == "BOS Zones":
                query["event"] = "BOS"

        cursor = self.results_col.find(query).sort("distance_pct", 1).limit(limit)
        results = await cursor.to_list(length=limit)
        
        # Format object id for JSON
        for r in results:
            r["_id"] = str(r["_id"])
            
        return results
        
    async def get_dashboard_stats(self) -> Dict[str, Any]:
        """
        Returns stats for the dashboard cards.
        """
        total_active = await self.results_col.count_documents({})
        inside_zone = await self.results_col.count_documents({"distance_pct": 0.0})
        within_2 = await self.results_col.count_documents({"distance_pct": {"$gt": 0.0, "$lte": 2.0}})
        within_5 = await self.results_col.count_documents({"distance_pct": {"$gt": 0.0, "$lte": 5.0}})
        
        # Pipeline for average distance
        pipeline = [
            {"$group": {"_id": None, "avg_dist": {"$avg": "$distance_pct"}}}
        ]
        agg_res = await self.results_col.aggregate(pipeline).to_list(length=1)
        avg_dist = agg_res[0]["avg_dist"] if agg_res else 0.0
        
        return {
            "total_active_zones": total_active,
            "inside_zone": inside_zone,
            "within_2_pct": within_2,
            "within_5_pct": within_5,
            "avg_distance": round(avg_dist, 2)
        }

    async def get_zone_details(self, symbol: str) -> Dict[str, Any]:
        """
        Gets the detailed history of a symbol's zones.
        """
        cursor = self.zones_col.find({"symbol": symbol}).sort("created_date", -1)
        zones = await cursor.to_list(length=100)
        for z in zones:
            z["_id"] = str(z["_id"])
        return {"symbol": symbol, "zones": zones}

def get_smc_service(db: AsyncIOMotorDatabase, market_service: MarketDataService) -> SMCService:
    return SMCService(db, market_service)
