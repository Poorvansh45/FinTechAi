import sys, os, time, asyncio
import pandas as pd
from datetime import datetime, timedelta, timezone
import pyotp

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from config import get_settings
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))
API_KEY = os.getenv("GROWW_API_KEY", "")
TOTP_SECRET = os.getenv("GROWW_TOTP_SECRET", "")

# Load growwapi inside try block
try:
    from growwapi import GrowwAPI
    from growwapi.groww.exceptions import GrowwAPIRateLimitException
except ImportError:
    try:
        from growwapi.exceptions import GrowwAPIRateLimitException
    except:
        class GrowwAPIRateLimitException(Exception): pass
        
from scanners.smc_scanner import process_smc_zones, calculate_zone_metrics

async def main():
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongodb_uri, tlsCAFile=certifi.where())
    db = client.get_default_database("finai_edge")
    
    zones_col = db.get_collection("smc_zones")
    results_col = db.get_collection("smc_scanner_results")
    
    csv_path = os.path.join(os.path.dirname(__file__), "../../data/Stocks.csv")
    df = pd.read_csv(csv_path)
    demand_mask = (
        df['SETUP 1'].astype(str).str.contains('Demand', case=False, na=False) | 
        df['SETUP 2'].astype(str).str.contains('Demand', case=False, na=False) | 
        df['SETUP 3'].astype(str).str.contains('Demand', case=False, na=False)
    )
    demand_symbols = df[demand_mask]['SYMBOL'].str.strip().unique().tolist()
    print(f"Found {len(demand_symbols)} UNIQUE demand symbols.")
    
    totp_gen = pyotp.TOTP(TOTP_SECRET)
    totp = totp_gen.now()
    access_token = GrowwAPI.get_access_token(api_key=API_KEY, totp=totp)
    groww = GrowwAPI(access_token)
    print("✅ Groww Authenticated.")
    
    await zones_col.delete_many({})
    await results_col.delete_many({})
    
    end_dt = datetime.now()
    start_dt = end_dt - timedelta(days=175)
    
    for symbol in demand_symbols:
        for attempt in range(3):
            try:
                print(f"Fetching {symbol}...", end=" ")
                groww_symbol_clean = symbol.replace(".NS", "").replace("NSE:", "").replace(".BO", "")
                groww_symbol = f"NSE-{groww_symbol_clean}"
                
                resp = groww.get_historical_candles(
                    exchange=groww.EXCHANGE_NSE,
                    segment=groww.SEGMENT_CASH,
                    groww_symbol=groww_symbol,
                    start_time=start_dt.strftime("%Y-%m-%d %H:%M:%S"),
                    end_time=end_dt.strftime("%Y-%m-%d %H:%M:%S"),
                    candle_interval=groww.CANDLE_INTERVAL_DAY,
                )
                
                candles = []
                if isinstance(resp, list):
                    candles = resp
                elif isinstance(resp, dict):
                    if "candles" in resp:
                        candles = resp["candles"]
                    elif "data" in resp and isinstance(resp["data"], dict):
                        candles = resp["data"].get("candles", [])
                    else:
                        print(f"Unexpected response for {groww_symbol}: {resp}")
                        break
                else:
                    print(f"Unexpected response type {type(resp)} for {groww_symbol}")
                    break

                if not candles:
                    print("No candles.")
                    break
                    
                rows = []
                for c in candles:
                    if len(c) < 6:
                        continue
                    if any(v is None for v in c[:6]):
                        print(f"Skipping incomplete candle for {groww_symbol}: {c}")
                        continue
                    
                    row = {
                        "Date": pd.to_datetime(c[0], errors="coerce"),
                        "Open": float(c[1]),
                        "High": float(c[2]),
                        "Low": float(c[3]),
                        "Close": float(c[4]),
                        "Volume": int(c[5]),
                    }
                    if len(c) >= 7:
                        row["OI"] = c[6]
                    else:
                        row["OI"] = 0
                    rows.append(row)

                if not rows:
                    print("Empty rows after filtering.")
                    break

                df_candles = pd.DataFrame(rows)
                df_candles["Date"] = df_candles["Date"].dt.normalize()
                
                # Debug
                if symbol == demand_symbols[0]:
                    print("Debug first row:", df_candles.iloc[0].to_dict())
                    
                df_candles = df_candles.dropna(subset=["Date", "Close"]).sort_values("Date").reset_index(drop=True)
                
                if df_candles.empty:
                    print("Empty dataframe.")
                    break
                    
                ltp = float(df_candles.iloc[-1]['Close'])
                
                zones = process_smc_zones(df_candles, symbol)
                if not zones:
                    print("No zones detected.")
                    break
                    
                for z in zones:
                    z['created_date'] = z['created_date'].to_pydatetime()
                    if z['invalidated_date']:
                        z['invalidated_date'] = z['invalidated_date'].to_pydatetime()
                    await zones_col.update_one(
                        {"symbol": symbol, "zone_id": z['zone_id']},
                        {"$set": z},
                        upsert=True
                    )
                    
                active_zones = [z for z in zones if z['status'] == 'Active']
                if active_zones:
                    enriched = [calculate_zone_metrics(z, ltp) for z in active_zones]
                    enriched.sort(key=lambda x: abs(x['distance_pct']))
                    nearest = enriched[0]
                    
                    await results_col.update_one(
                        {"symbol": symbol},
                        {"$set": {
                            "symbol": symbol,
                            "ltp": ltp,
                            "zone_id": nearest['zone_id'],
                            "zone_high": nearest['zone_high'],
                            "zone_low": nearest['zone_low'],
                            "zone_width_pct": nearest['zone_width_pct'],
                            "distance_pct": nearest['distance_pct'],
                            "created_date": nearest['created_date'],
                            "zone_age_days": nearest['zone_age_days'],
                            "event": nearest['event'],
                            "status": nearest['status'],
                            "updated_at": datetime.now(timezone.utc)
                        }},
                        upsert=True
                    )
                    print(f"✅ Indexed {len(active_zones)} zones.")
                else:
                    print("No ACTIVE zones.")
                    
                time.sleep(0.3)
                break
                
            except GrowwAPIRateLimitException:
                print(f"Rate limited. Retrying in {attempt*2}s...")
                time.sleep(attempt * 2)
            except Exception as e:
                print(f"❌ Error: {e}")
                time.sleep(0.3)
                break

if __name__ == "__main__":
    asyncio.run(main())
