import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()
uri = os.getenv("MONGODB_URI") or "mongodb://localhost:27017/finai_edge"

async def run():
    client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=5000)
    db = client.get_database("finai_edge")
    
    # Check LaunchPad candidates in screener_cache
    # Logic: fvg.has_fvg_bullish == True AND -10 <= indicators.ema_200_dist_pct <= 10
    query_lp = {
        "fvg.has_fvg_bullish": True,
        "indicators.ema_200_dist_pct": {"$gte": -10.0, "$lte": 10.0}
    }
    lp_count = await db.screener_cache.count_documents(query_lp)
    print(f"LaunchPad (screener_cache method) candidate count: {lp_count}")
    
    # Let's inspect one candidate
    if lp_count > 0:
        doc = await db.screener_cache.find_one(query_lp)
        print("Sample LaunchPad Doc:")
        print(f"  Symbol: {doc.get('symbol')}")
        print(f"  Price: {doc.get('price')}")
        print(f"  FVG: {doc.get('fvg')}")
        print(f"  Indicators: {doc.get('indicators')}")
        
    # Check Alpha Zone candidates in smc_scanner_results
    # Logic: Stock enters an Unmitigated Order Block (demand zone distance_pct is 0 or within some range, and nearest_demand.touch_count == 0)
    # Let's check smc_scanner_results fields
    query_az = {
        "nearest_demand.touch_count": 0,
        "nearest_demand.distance_pct": {"$lte": 5.0} # entered or near zone
    }
    az_count = await db.smc_scanner_results.count_documents(query_az)
    print(f"Alpha Zone (unmitigated demand) candidate count: {az_count}")
    if az_count > 0:
        doc = await db.smc_scanner_results.find_one(query_az)
        print("Sample Alpha Zone Doc:")
        print(f"  Symbol: {doc.get('symbol')}")
        print(f"  LTP: {doc.get('ltp')}")
        print(f"  Nearest Demand: {doc.get('nearest_demand')}")
        print(f"  SMC Score: {doc.get('smc_score')}")

asyncio.run(run())
