import asyncio
import os

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()
uri = os.getenv("MONGODB_URI") or "mongodb://localhost:27017/finai_edge"


async def run():
    client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=5000)
    db = client.get_database("finai_edge")

    collections = [
        "screener_cache",
        "fvg_scan_results",
        "smc_scanner_results",
        "scan_meta",
    ]
    for col_name in collections:
        col = db.get_collection(col_name)
        doc = await col.find_one({})
        print(f"\n=== COLLECTION: {col_name} ===")
        if doc:
            # Print keys and types
            for k, v in doc.items():
                if isinstance(v, dict):
                    print(f"  {k} (dict): {list(v.keys())}")
                elif isinstance(v, list):
                    print(f"  {k} (list of {type(v[0]).__name__ if v else 'empty'})")
                else:
                    print(f"  {k} ({type(v).__name__}): {str(v)[:100]}")
        else:
            print("  No documents found.")


asyncio.run(run())
