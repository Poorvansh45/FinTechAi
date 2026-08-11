import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
import certifi
from motor.motor_asyncio import AsyncIOMotorClient

from config import get_settings


async def main():
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongodb_uri, tlsCAFile=certifi.where())
    db = client.get_default_database("finai_edge")

    zones_col = db.get_collection("smc_zones")
    results_col = db.get_collection("smc_scanner_results")

    # Clean previous mock data
    await zones_col.delete_many(
        {"symbol": {"$in": ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ITC"]}}
    )
    await results_col.delete_many(
        {"symbol": {"$in": ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ITC"]}}
    )

    now = datetime.now(timezone.utc)

    mock_results = [
        {
            "symbol": "RELIANCE",
            "ltp": 2950.45,
            "zone_id": "z_1",
            "zone_high": 2960.00,
            "zone_low": 2940.00,
            "zone_width_pct": 0.68,
            "distance_pct": 0.0,  # Inside Zone
            "created_date": now - timedelta(days=2),
            "zone_age_days": 2,
            "event": "BOS",
            "status": "Active",
            "updated_at": now,
        },
        {
            "symbol": "HDFCBANK",
            "ltp": 1645.20,
            "zone_id": "z_2",
            "zone_high": 1620.00,
            "zone_low": 1600.00,
            "zone_width_pct": 1.25,
            "distance_pct": 1.53,  # Near Zone (2%)
            "created_date": now - timedelta(days=5),
            "zone_age_days": 5,
            "event": "CHoCH",
            "status": "Active",
            "updated_at": now,
        },
        {
            "symbol": "TCS",
            "ltp": 4120.00,
            "zone_id": "z_3",
            "zone_high": 3950.00,
            "zone_low": 3900.00,
            "zone_width_pct": 1.28,
            "distance_pct": 4.12,  # Near Zone (5%)
            "created_date": now - timedelta(days=12),
            "zone_age_days": 12,
            "event": "BOS",
            "status": "Active",
            "updated_at": now,
        },
        {
            "symbol": "INFY",
            "ltp": 1450.00,
            "zone_id": "z_4",
            "zone_high": 1440.00,
            "zone_low": 1420.00,
            "zone_width_pct": 1.40,
            "distance_pct": 0.69,
            "created_date": now - timedelta(days=1),
            "zone_age_days": 1,
            "event": "CHoCH",
            "status": "Active",
            "updated_at": now,
        },
        {
            "symbol": "ITC",
            "ltp": 420.50,
            "zone_id": "z_5",
            "zone_high": 422.00,
            "zone_low": 418.00,
            "zone_width_pct": 0.95,
            "distance_pct": -0.35,  # Slightly below high, Inside Zone
            "created_date": now - timedelta(days=3),
            "zone_age_days": 3,
            "event": "BOS",
            "status": "Active",
            "updated_at": now,
        },
    ]

    mock_zones = []
    for r in mock_results:
        mock_zones.append(
            {
                "symbol": r["symbol"],
                "zone_id": r["zone_id"],
                "type": "Demand",
                "status": "Active",
                "event": r["event"],
                "zone_high": r["zone_high"],
                "zone_low": r["zone_low"],
                "created_date": r["created_date"],
                "invalidated_date": None,
                "retests": [],
            }
        )

    if mock_results:
        await results_col.insert_many(mock_results)
    if mock_zones:
        await zones_col.insert_many(mock_zones)

    print("✅ Mock data inserted successfully! Refresh UI.")


if __name__ == "__main__":
    asyncio.run(main())
