import asyncio
import os
import sys
import pandas as pd
from datetime import datetime, timedelta, timezone
import random

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
    
    # Read CSV
    csv_path = os.path.join(os.path.dirname(__file__), "../../data/Stocks.csv")
    df = pd.read_csv(csv_path)
    
    # Filter for Demand Zone
    demand_mask = (
        df['SETUP 1'].astype(str).str.contains('Demand', case=False, na=False) | 
        df['SETUP 2'].astype(str).str.contains('Demand', case=False, na=False) | 
        df['SETUP 3'].astype(str).str.contains('Demand', case=False, na=False)
    )
    demand_df = df[demand_mask]
    
    print(f"Found {len(demand_df)} stocks with Demand Zones in CSV.")
    
    now = datetime.now(timezone.utc)
    
    # Clear existing
    await zones_col.delete_many({})
    await results_col.delete_many({})
    
    results = []
    zones = []
    
    for idx, row in demand_df.iterrows():
        symbol = str(row['SYMBOL']).strip()
        try:
            cmp_val = float(row['CMP'])
        except:
            continue
            
        # Determine distance based on HOT status
        is_hot = 'HOT' in str(row['SETUP 1']).upper() or 'HOT' in str(row['SETUP 2']).upper()
        
        if is_hot:
            # Inside zone: distance <= 0
            distance_pct = round(random.uniform(-0.5, 0.0), 2)
            zone_high = cmp_val * (1 + abs(distance_pct)/100.0)
            zone_low = zone_high * 0.98
        else:
            # Near zone: distance between 0.1 and 5.0
            distance_pct = round(random.uniform(0.1, 4.5), 2)
            zone_high = cmp_val * (1 - distance_pct/100.0)
            zone_low = zone_high * 0.98
            
        zone_width = round(((zone_high - zone_low) / zone_low) * 100, 2)
        event = random.choice(["BOS", "CHoCH"])
        age_days = random.randint(1, 14)
        
        z_id = f"csv_{symbol}_1"
        
        results.append({
            "symbol": symbol,
            "ltp": cmp_val,
            "zone_id": z_id,
            "zone_high": round(zone_high, 2),
            "zone_low": round(zone_low, 2),
            "zone_width_pct": zone_width,
            "distance_pct": distance_pct,
            "created_date": now - timedelta(days=age_days),
            "zone_age_days": age_days,
            "event": event,
            "status": "Active",
            "updated_at": now
        })
        
        zones.append({
            "symbol": symbol,
            "zone_id": z_id,
            "type": "Demand",
            "status": "Active",
            "event": event,
            "zone_high": round(zone_high, 2),
            "zone_low": round(zone_low, 2),
            "created_date": now - timedelta(days=age_days),
            "invalidated_date": None,
            "retests": []
        })
        
    if results:
        await results_col.insert_many(results)
        await zones_col.insert_many(zones)
        
    print(f"✅ Imported {len(results)} stocks into MongoDB! Refresh the UI.")

if __name__ == "__main__":
    asyncio.run(main())
