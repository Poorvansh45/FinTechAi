import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()
uri = os.getenv("MONGODB_URI") or "mongodb://localhost:27017/finai_edge"

async def run():
    client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=5000)
    db = client.get_database("finai_edge")
    
    pipeline = [
        {
            "$match": {
                "active_fvg_count": {"$gt": 0}
            }
        },
        {
            "$lookup": {
                "from": "screener_cache",
                "localField": "symbol",
                "foreignField": "symbol",
                "as": "screener"
            }
        },
        {
            "$unwind": "$screener"
        },
        {
            "$match": {
                "screener.indicators.ema_200_dist_pct": {"$gte": -10.0, "$lte": 10.0}
            }
        },
        {
            "$project": {
                "_id": 0,
                "symbol": 1,
                "company_name": 1,
                "ltp": 1,
                "price": 1,
                "nearest_fvg_high": 1,
                "nearest_fvg_dist_pct": 1,
                "active_fvg_count": 1,
                "fvgs": 1,
                "ema_200_dist_pct": "$screener.indicators.ema_200_dist_pct",
                "rsi_14": "$screener.indicators.rsi_14"
            }
        }
    ]
    
    results = await db.fvg_scan_results.aggregate(pipeline).to_list(length=100)
    print(f"LaunchPad candidates found: {len(results)}")
    if results:
        print("Sample candidate:")
        print(results[0])

asyncio.run(run())
