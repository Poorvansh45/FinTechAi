import asyncio
import os
import sys
from datetime import datetime, timezone

import pandas as pd

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
import certifi
from motor.motor_asyncio import AsyncIOMotorClient

from config import get_settings
from scanners.smc_scanner import calculate_zone_metrics, process_smc_zones


async def main():
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongodb_uri, tlsCAFile=certifi.where())
    db = client.get_default_database("finai_edge")

    ohlc_col = db.get_collection("ohlc_data")
    zones_col = db.get_collection("smc_zones")
    results_col = db.get_collection("smc_scanner_results")

    # NIFTY top stocks for quick testing
    symbols = [
        "RELIANCE",
        "TCS",
        "HDFCBANK",
        "ICICIBANK",
        "INFY",
        "ITC",
        "SBIN",
        "BHARTIARTL",
        "BAJFINANCE",
        "KOTAKBANK",
        "HINDUNILVR",
        "AXISBANK",
        "LT",
        "ASIANPAINT",
        "MARUTI",
        "SUNPHARMA",
        "TITAN",
        "ULTRACEMCO",
        "TATAMOTORS",
        "ZOMATO",
        "SUZLON",
        "PAYTM",
    ]

    print(
        f"Populating SMC data for {len(symbols)} popular symbols using local MongoDB OHLC cache..."
    )
    for symbol in symbols:
        try:
            # 1. Fetch candles from local DB instead of yfinance
            cursor = ohlc_col.find({"symbol": symbol}).sort("date", 1)
            docs = await cursor.to_list(length=None)

            if len(docs) < 50:
                print(
                    f"Skipping {symbol}: not enough historical data in DB ({len(docs)} candles)"
                )
                continue

            # 2. Build dataframe
            df = pd.DataFrame(
                [
                    {
                        "Date": d["date"],
                        "Open": d.get("open"),
                        "High": d.get("high"),
                        "Low": d.get("low"),
                        "Close": d.get("close"),
                        "Volume": d.get("volume"),
                    }
                    for d in docs
                ]
            ).dropna(subset=["Close", "High", "Low"])

            df["Date"] = pd.to_datetime(df["Date"])
            ltp = float(df.iloc[-1]["Close"])

            # 3. Process SMC Zones
            zones = process_smc_zones(df, symbol)
            if not zones:
                print(f"No zones detected for {symbol}")
                continue

            # 4. Save zones
            for z in zones:
                z["created_date"] = z["created_date"].to_pydatetime()
                if z["invalidated_date"]:
                    z["invalidated_date"] = z["invalidated_date"].to_pydatetime()

                await zones_col.update_one(
                    {"symbol": symbol, "zone_id": z["zone_id"]},
                    {"$set": z},
                    upsert=True,
                )

            # 5. Save scanner results
            active_zones = [z for z in zones if z["status"] == "Active"]
            if active_zones:
                enriched = [calculate_zone_metrics(z, ltp) for z in active_zones]
                enriched.sort(key=lambda x: abs(x["distance_pct"]))
                nearest = enriched[0]

                await results_col.update_one(
                    {"symbol": symbol},
                    {
                        "$set": {
                            "symbol": symbol,
                            "ltp": ltp,
                            "zone_id": nearest["zone_id"],
                            "zone_high": nearest["zone_high"],
                            "zone_low": nearest["zone_low"],
                            "zone_width_pct": nearest["zone_width_pct"],
                            "distance_pct": nearest["distance_pct"],
                            "created_date": nearest["created_date"],
                            "zone_age_days": nearest["zone_age_days"],
                            "event": nearest["event"],
                            "status": nearest["status"],
                            "updated_at": datetime.now(timezone.utc),
                        }
                    },
                    upsert=True,
                )
                print(f"✅ Indexed {symbol} -> {len(active_zones)} active zones")
            else:
                print(f"No active zones for {symbol}")

        except Exception as e:
            print(f"❌ Error scanning {symbol}: {e}")

    print("\n✅ Done! Refresh the UI.")


if __name__ == "__main__":
    asyncio.run(main())
