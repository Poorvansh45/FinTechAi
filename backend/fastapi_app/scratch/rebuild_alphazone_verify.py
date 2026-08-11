"""One-off: run the new direct-OHLCV Alpha Zone scan and report counts/markers."""

import asyncio
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()
uri = os.getenv("MONGODB_URI") or "mongodb://localhost:27017/finai_edge"


async def run():
    client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=8000)
    db = client.get_database("finai_edge")

    from engines.strategies.runner import run_alphazone_scan

    t0 = time.time()
    n = await run_alphazone_scan(db)
    dt = time.time() - t0
    print(f"Alpha Zone scan -> {n} matches  ({dt:.1f}s full universe)\n")

    docs = (
        await db.get_collection("alpha_zone_cache")
        .find({}, {"_id": 0})
        .to_list(length=5000)
    )
    if not docs:
        print("No results.")
        client.close()
        return

    def dist(field):
        out = {}
        for d in docs:
            out[d.get(field)] = out.get(d.get(field), 0) + 1
        return out

    sub200 = [d["symbol"] for d in docs if (d.get("ltp") or 0) < 200]
    keys = sorted(docs[0].get("score_breakdown", {}).keys())
    print("zone_status:", dist("zone_status"))
    print("zone_type  :", dist("zone_type"))
    print("strength   :", dist("zone_strength"))
    print("sub-₹200   :", len(sub200))
    print("breakdown keys:", keys, "(no rsi:", "rsi" not in keys, ")")
    print()
    docs.sort(key=lambda d: d.get("institutional_score", 0), reverse=True)
    print("Top 12 by confidence:")
    for d in docs[:12]:
        print(
            f"  {d['symbol']:12} ltp={d.get('ltp'):>9} conf={d.get('institutional_score'):>3} "
            f"orig={d.get('origin_score'):>5} {d.get('zone_status'):10} {d.get('zone_type'):13} "
            f"zone=₹{d.get('zone_low')}-{d.get('zone_high')} R:R={d.get('risk_reward')} "
            f"ret={d.get('projected_return')}%"
        )
    client.close()


asyncio.run(run())
