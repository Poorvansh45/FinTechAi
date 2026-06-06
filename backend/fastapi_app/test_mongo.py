import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()
uri = os.getenv("MONGODB_URI")
print(f"URI: {uri[:40]}...")

async def run():
    client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=5000)
    db = client.get_default_database("finai_edge")
    count = await db.ohlc_data.count_documents({})
    print(f"OHLC data count: {count}")

asyncio.run(run())
