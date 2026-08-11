import asyncio
import os

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()
uri = os.getenv("MONGODB_URI") or "mongodb://localhost:27017/finai_edge"


async def run():
    client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=5000)
    db = client.get_database("finai_edge")

    # 1. Check screener_cache fvg values
    print("Screener Cache FVG Stats:")
    fvg_bullish_count = await db.screener_cache.count_documents(
        {"fvg.has_fvg_bullish": True}
    )
    print(f"  fvg.has_fvg_bullish == True: {fvg_bullish_count}")

    fvg_bearish_count = await db.screener_cache.count_documents(
        {"fvg.has_fvg_bearish": True}
    )
    print(f"  fvg.has_fvg_bearish == True: {fvg_bearish_count}")

    print(
        f"  fvg field exists: {await db.screener_cache.count_documents({'fvg': {'$ne': None}})}"
    )

    # Print a document with fvg.has_fvg_bullish == True if it exists
    if fvg_bullish_count > 0:
        doc = await db.screener_cache.find_one({"fvg.has_fvg_bullish": True})
        print(
            f"  Sample fvg.has_fvg_bullish document: {doc['symbol']}, fvg: {doc['fvg']}"
        )

    # 2. Check fvg_scan_results active counts
    print("\nFVG Scan Results Stats:")
    total_fvg_res = await db.fvg_scan_results.count_documents({})
    print(f"  Total docs: {total_fvg_res}")

    active_fvgs_gt_0 = await db.fvg_scan_results.count_documents(
        {"active_fvg_count": {"$gt": 0}}
    )
    print(f"  active_fvg_count > 0: {active_fvgs_gt_0}")

    nearest_fvg_not_null = await db.fvg_scan_results.count_documents(
        {"nearest_fvg_dist_pct": {"$ne": None}}
    )
    print(f"  nearest_fvg_dist_pct is not null: {nearest_fvg_not_null}")

    if active_fvgs_gt_0 > 0:
        doc = await db.fvg_scan_results.find_one({"active_fvg_count": {"$gt": 0}})
        print(
            f"  Sample active FVG: {doc['symbol']}, active_fvg_count: {doc['active_fvg_count']}, nearest_dist: {doc['nearest_fvg_dist_pct']}"
        )


asyncio.run(run())
