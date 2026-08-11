import asyncio
import os
import random
import sys

import certifi
import pandas as pd
from motor.motor_asyncio import AsyncIOMotorClient

# Add project path to import config
sys.path.append("/Users/akarshbhandari/FinTechAi/backend/fastapi_app")
from config import get_settings
from scanners.fvg import detect_bullish_fvgs
from services.ohlc_downloader import get_cached_symbols, load_stock_dataframe


async def audit():
    settings = get_settings()
    client = AsyncIOMotorClient(
        settings.mongodb_uri, serverSelectionTimeoutMS=5000, tlsCAFile=certifi.where()
    )
    db = client.get_default_database("finai_edge")

    print("=" * 70)
    print("STEP 1: TRACE COMPLETE FVG DATA FLOW FOR BLUECHIP")
    print("=" * 70)

    # 1. Stock_Data.csv
    csv_path = "/Users/akarshbhandari/FinTechAi/backend/data/Stock_Data.csv"
    csv_df = pd.read_csv(csv_path)
    bluechip_csv = csv_df[csv_df["symbol"] == "BLUECHIP"]
    print(f"1. Stock_Data.csv: {len(bluechip_csv)} rows found for BLUECHIP.")

    # 2. FVG Detection Engine
    df = load_stock_dataframe("BLUECHIP")
    fvgs = detect_bullish_fvgs(df)
    print(f"2. FVG Detection Engine: Detected {len(fvgs)} bullish FVGs.")
    if fvgs:
        latest = fvgs[-1]
        print(
            f"   Latest FVG Date: {latest['end_date']}, Low: {latest['low']}, High: {latest['high']}, Gap %: {latest['gap_pct']}%"
        )

    # 3. Stock_FVG.csv
    stock_fvg_path = "/Users/akarshbhandari/Desktop/Trading_algorithm/Stock_FVG.csv"
    if os.path.exists(stock_fvg_path):
        fvg_csv = pd.read_csv(stock_fvg_path)
        bluechip_fvg_csv = fvg_csv[fvg_csv["Symbol"] == "BLUECHIP"]
        print(
            f"3. Stock_FVG.csv: {len(bluechip_fvg_csv)} rows found for BLUECHIP (due to RSI/other filters)."
        )
    else:
        print("3. Stock_FVG.csv: File not found on desktop.")

    # 4. Database Storage
    doc = await db["fvg_scan_results"].find_one({"symbol": "BLUECHIP"})
    if doc:
        print("4. Database Storage: Document found.")
        print(f"   fvg_count field: {doc.get('fvg_count')}")
        print(f"   fvgs array size: {len(doc.get('fvgs', []))}")
        if doc.get("fvgs"):
            lat = doc.get("fvgs")[0]
            print(
                f"   Latest cached FVG: {lat.get('end_date')} Low: {lat.get('low')} High: {lat.get('high')} Gap: {lat.get('gap_pct')}%"
            )
    else:
        print("4. Database Storage: No record in fvg_scan_results.")

    print("\n" + "=" * 70)
    print("STEP 2: expected vs actual fvg counts check for 50 random stocks")
    print("=" * 70)

    symbols = get_cached_symbols()
    random.seed(42)
    sample_syms = random.sample(list(symbols), min(len(symbols), 50))

    print(
        f"{'Symbol':15} | {'Expected (Ref)':15} | {'Actual (New)':15} | {'Difference':10}"
    )
    print("-" * 60)
    diff_count = 0
    for sym in sample_syms:
        sym_df = load_stock_dataframe(sym)
        if sym_df.empty:
            continue
        # Expected
        ref_res = []
        sym_df = sym_df.sort_values("Date").reset_index(drop=True)
        for i in range(len(sym_df) - 2):
            c1, c2, c3 = sym_df.iloc[i], sym_df.iloc[i + 1], sym_df.iloc[i + 2]
            if c2["Low"] > c1["High"] and c3["Low"] > c1["High"]:
                gl = c1["High"]
                gh = min(c2["Low"], c3["Low"])
                rp = c3["Close"]
                if (gh - gl) >= rp * 0.01:
                    ref_res.append((gl, gh))
        # Actual
        actual_res = detect_bullish_fvgs(sym_df)
        diff = len(actual_res) - len(ref_res)
        if diff != 0:
            diff_count += 1
        print(f"{sym:15} | {len(ref_res):15} | {len(actual_res):15} | {diff:+10}")
    print(f"Stocks with count differences: {diff_count}/50")

    print("\n" + "=" * 70)
    print("STEP 3: detect overlapping/duplicate fvg chains")
    print("=" * 70)

    # Let's define overlapping FVG chain:
    # Consecutive FVGs in history that overlap in price.
    # For a stock, sort FVGs by formed_idx. Check if FVG[k] overlaps FVG[k-1].
    # Overlap condition: max(low1, low2) < min(high1, high2)
    dup_report = []
    for sym in sample_syms:
        sym_df = load_stock_dataframe(sym)
        if sym_df.empty:
            continue
        sym_fvgs = detect_bullish_fvgs(sym_df)
        dup_count = 0
        affected_dates = []
        for i in range(1, len(sym_fvgs)):
            f1 = sym_fvgs[i - 1]
            f2 = sym_fvgs[i]
            # check overlap
            o_low = max(f1["low"], f2["low"])
            o_high = min(f1["high"], f2["high"])
            if o_low < o_high:  # non-zero overlap in price
                dup_count += 1
                affected_dates.append(f"{f1['end_date']} & {f2['end_date']}")
        if dup_count > 0:
            dup_report.append(
                {"symbol": sym, "dup_count": dup_count, "dates": affected_dates[:5]}
            )

    print(f"{'Symbol':15} | {'Duplicate Count':15} | {'Sample Dates':30}")
    print("-" * 65)
    for r in dup_report[:15]:
        print(f"{r['symbol']:15} | {r['dup_count']:15} | {', '.join(r['dates'])}")

    print("\n" + "=" * 70)
    print("STEP 4: analyze FVG active vs historical mitigation")
    print("=" * 70)

    # Active FVG: not mitigated by subsequent price action.
    # Let's count active FVGs for BLUECHIP and some random stocks.
    # Active FVG condition: subsequent candles (from end_date onwards) have Low > FVG High (or FVG Low?)
    # Let's write the checker and print for BLUECHIP and a few others.
    for sym in ["BLUECHIP"] + sample_syms[:4]:
        sym_df = load_stock_dataframe(sym)
        if sym_df.empty:
            continue
        sym_fvgs = detect_bullish_fvgs(sym_df)
        active_cnt_high = 0
        active_cnt_low = 0
        for f in sym_fvgs:
            idx = f["formed_idx"]
            future = sym_df.iloc[idx + 1 :]
            if future.empty:
                active_cnt_high += 1
                active_cnt_low += 1
                continue
            min_low = future["Low"].min()
            if min_low > f["high"]:  # Untouched / active (never dipped below high)
                active_cnt_high += 1
            if min_low > f["low"]:  # Not fully mitigated (never dipped below low)
                active_cnt_low += 1

        print(
            f"Symbol: {sym:12} | Total: {len(sym_fvgs):4} | Active (Unmitigated: Low > FVG High): {active_cnt_high:4} | Active (Not fully filled: Low > FVG Low): {active_cnt_low:4}"
        )

    client.close()


if __name__ == "__main__":
    asyncio.run(audit())
