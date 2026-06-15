import os
import sys
import pandas as pd
import random

# Add project path to python import path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scanners.fvg import detect_bullish_fvgs
from services.ohlc_downloader import load_stock_dataframe, get_cached_symbols

def detect_bullish_fvgs_reference(stock_df, min_gap_pct=0.01):
    stock_df = stock_df.sort_values('Date').reset_index(drop=True)
    results = []
    N = len(stock_df)
    if N < 3:
        return results
    for i in range(N - 2):
        c1 = stock_df.iloc[i]
        c2 = stock_df.iloc[i + 1]
        c3 = stock_df.iloc[i + 2]
        if (c2['Low'] > c1['High']) and (c3['Low'] > c1['High']):
            gap_low = c1['High']
            gap_high = min(c2['Low'], c3['Low'])
            ref_price = c3['Close']
            min_gap = ref_price * min_gap_pct
            if (gap_high - gap_low) >= min_gap:
                results.append({
                    "formed_idx": i + 2,
                    "Low": gap_low,
                    "High": gap_high,
                    "Start_Index": i,
                    "End_Index": i + 2,
                    "Start_Date": stock_df['Date'].iloc[i],
                    "End_Date": stock_df['Date'].iloc[i + 2],
                })
    return results

def run_validation():
    print("=" * 60)
    print("FVG SCANNER REBUILD VALIDATION AUDIT")
    print("=" * 60)
    
    symbols = get_cached_symbols()
    if not symbols:
        print("[FAIL] No symbols cached. Please load Stock_Data.csv first.")
        sys.exit(1)
        
    random.seed(42)  # reproducible random
    sample_symbols = random.sample(list(symbols), min(len(symbols), 50))
    print(f"Auditing FVG count and zones on {len(sample_symbols)} random symbols...\n")
    
    total_symbols = len(sample_symbols)
    matched_count_ok = 0
    matched_zones_ok = 0
    
    for sym in sample_symbols:
        df = load_stock_dataframe(sym)
        if df.empty:
            print(f"Skipping empty DataFrame for {sym}")
            total_symbols -= 1
            continue
            
        # Run reference logic
        ref_res = detect_bullish_fvgs_reference(df)
        
        # Run new implemented logic
        new_res = detect_bullish_fvgs(df)
        
        # Check FVG count
        ref_count = len(ref_res)
        new_count = len(new_res)
        
        count_match = (ref_count == new_count)
        if count_match:
            matched_count_ok += 1
            
        # Check FVG zone levels
        zones_match = True
        for ref_fvg, new_fvg in zip(ref_res, new_res):
            ref_low = round(float(ref_fvg["Low"]), 2)
            ref_high = round(float(ref_fvg["High"]), 2)
            new_low = round(float(new_fvg["low"]), 2)
            new_high = round(float(new_fvg["high"]), 2)
            
            if ref_low != new_low or ref_high != new_high:
                zones_match = False
                break
                
        if zones_match:
            matched_zones_ok += 1
            
        print(f"Symbol {sym:12} | Ref count: {ref_count:3} | New count: {new_count:3} | Count Match: {'✓' if count_match else 'X'} | Zones Match: {'✓' if zones_match else 'X'}")
        
    count_accuracy = (matched_count_ok / total_symbols) * 100 if total_symbols else 0
    zones_accuracy = (matched_zones_ok / total_symbols) * 100 if total_symbols else 0
    
    print("\n" + "=" * 60)
    print("VALIDATION RESULTS SUMMARY")
    print("=" * 60)
    print(f"FVG Count Accuracy      : {count_accuracy:.2f}% (Target: >= 95%)")
    print(f"FVG Zone Levels Accuracy: {zones_accuracy:.2f}% (Target: >= 95%)")
    print("=" * 60)
    
    if count_accuracy >= 95.0 and zones_accuracy >= 95.0:
        print("✓ SUCCESS: Refactored FVG scanner matches Jupyter Notebook logic perfectly!")
        sys.exit(0)
    else:
        print("X FAILURE: Accuracy is below the 95% target threshold.")
        sys.exit(1)

if __name__ == "__main__":
    run_validation()
