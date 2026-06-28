"""
FVG v3 Audit & Validation Script
==================================
Validates the ICT-correct FVG logic against Stock_Data.csv.

Steps:
  1. Trace SUMEETINDS FVG data flow (the original bug report)
  4. Validate 50 random stocks: Symbol, FVG dates, mitigation status, reason
  7. Debug output for selected stocks
  8. Accuracy comparison: expected vs actual for 20 random stocks
"""

import os
import sys
import random
import pandas as pd
from datetime import datetime

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.ohlc_downloader import load_stock_dataframe, get_cached_symbols
from scanners.fvg import (
    detect_bullish_fvgs,
    filter_active_fvgs,
    analyze_fvg_for_symbol,
    debug_fvg_for_symbol,
    MAX_FVG_AGE_DAYS,
    MAX_FVG_DISTANCE_PCT,
)


def step1_sumeetinds_trace():
    """Step 1: Trace the exact SUMEETINDS issue from the bug report."""
    print("=" * 70)
    print("STEP 1: SUMEETINDS FVG TRACE (Original Bug Report)")
    print("=" * 70)

    df = load_stock_dataframe("SUMEETINDS")
    if df.empty:
        print("[SKIP] SUMEETINDS not found in Stock_Data.csv")
        return

    ltp = float(df.iloc[-1]["Close"])
    print(f"Candles loaded: {len(df)}")
    print(f"LTP: ₹{ltp:.2f}")
    print()

    # All FVGs detected
    all_fvgs = detect_bullish_fvgs(df)
    active_raw = [f for f in all_fvgs if f.get("is_active", False)]
    mitigated = [f for f in all_fvgs if not f.get("is_active", False)]

    print(f"Total FVGs detected      : {len(all_fvgs)}")
    print(f"Mitigated (ICT-correct)  : {len(mitigated)}")
    print(f"Active (before filters)  : {len(active_raw)}")

    # Apply filters
    filtered = filter_active_fvgs(all_fvgs, ltp)
    print(f"Active (after filters)   : {len(filtered)}")
    print()

    # Show the bug: the old ₹3.79-₹55.96 FVG should now be mitigated
    print("Checking if the ₹3.79 FVG from bug report is correctly mitigated:")
    bug_fvgs = [f for f in all_fvgs if f["low"] < 10 and f["high"] > 50]
    for f in bug_fvgs:
        print(f"  FVG ₹{f['low']:.2f}–₹{f['high']:.2f} | Active: {f['is_active']} | Reason: {f.get('mitigation_reason', 'N/A')}")

    if not bug_fvgs:
        print("  No FVG matching ₹3.79-₹55.96 found (may have different exact values)")
        # Show all FVGs with low < 10
        low_fvgs = [f for f in all_fvgs if f["low"] < 10]
        if low_fvgs:
            print(f"  FVGs with low < ₹10 ({len(low_fvgs)} found):")
            for f in low_fvgs[:5]:
                print(f"    ₹{f['low']:.2f}–₹{f['high']:.2f} | Active: {f['is_active']} | Reason: {f.get('mitigation_reason', 'N/A')}")

    print()
    # Show final active FVGs
    if filtered:
        print("Final active FVGs (should be near ₹24 range):")
        for i, f in enumerate(filtered[:5]):
            dist = round(((ltp - f["high"]) / f["high"]) * 100, 2)
            print(f"  #{i+1}: ₹{f['low']:.2f}–₹{f['high']:.2f} | Date: {f['end_date']} | Age: {f['age_days']}d | Dist: {dist:+.2f}%")
    else:
        print("No active FVGs remaining after filtering (stock may have filled all recent gaps).")

    print()

    # Full debug output
    print(debug_fvg_for_symbol(df, "SUMEETINDS"))
    print()


def step4_validate_50_stocks():
    """Step 4: Validate FVG output for 50 random stocks."""
    print("=" * 70)
    print("STEP 4: VALIDATE 50 RANDOM STOCKS")
    print("=" * 70)

    symbols = get_cached_symbols()
    random.seed(42)
    sample = random.sample(list(symbols), min(len(symbols), 50))

    print(f"\n{'Symbol':15} | {'LTP':>8} | {'Total':>5} | {'Mitig':>5} | {'Active':>6} | {'Nearest FVG':>20} | {'Dist':>8}")
    print("-" * 85)

    issues = []
    for sym in sample:
        df = load_stock_dataframe(sym)
        if df.empty or len(df) < 30:
            continue

        ltp = float(df.iloc[-1]["Close"])
        all_fvgs = detect_bullish_fvgs(df)
        active = filter_active_fvgs(all_fvgs, ltp)
        mitigated = len(all_fvgs) - sum(1 for f in all_fvgs if f.get("is_active", False))

        nearest_str = "—"
        dist_str = "—"
        if active:
            n = active[0]
            nearest_str = f"₹{n['low']:.2f}–₹{n['high']:.2f}"
            dist = round(((ltp - n["high"]) / n["high"]) * 100, 2)
            dist_str = f"{dist:+.2f}%"

            # Sanity check: nearest FVG should be reasonably close
            if abs(dist) > 100:
                issues.append(f"{sym}: nearest FVG at {dist:+.2f}% (should be filtered)")

        print(f"{sym:15} | {ltp:>8.2f} | {len(all_fvgs):>5} | {mitigated:>5} | {len(active):>6} | {nearest_str:>20} | {dist_str:>8}")

    if issues:
        print(f"\n⚠️ Issues found ({len(issues)}):")
        for issue in issues:
            print(f"  - {issue}")
    else:
        print("\n✅ All 50 stocks pass sanity checks.")
    print()


def step7_debug_selected_stocks():
    """Step 7: Full debug output for 5 stocks."""
    print("=" * 70)
    print("STEP 7: DEBUG OUTPUT FOR SELECTED STOCKS")
    print("=" * 70)

    test_symbols = ["SUMEETINDS", "RELIANCE", "TCS", "INFY", "HDFCBANK"]
    symbols = get_cached_symbols()

    for sym in test_symbols:
        if sym in symbols:
            df = load_stock_dataframe(sym)
            if not df.empty:
                print(debug_fvg_for_symbol(df, sym))
                print()


def step8_accuracy_check():
    """Step 8: Compare ICT-correct logic for 20 random stocks."""
    print("=" * 70)
    print("STEP 8: ACCURACY CHECK — ICT FVG LOGIC (20 stocks)")
    print("=" * 70)

    symbols = get_cached_symbols()
    random.seed(123)
    sample = random.sample(list(symbols), min(len(symbols), 20))

    print(f"\n{'Symbol':15} | {'Total':>5} | {'Mitigated':>9} | {'Active(raw)':>11} | {'Active(filt)':>12} | {'Verdict':>10}")
    print("-" * 80)

    correct = 0
    total = 0

    for sym in sample:
        df = load_stock_dataframe(sym)
        if df.empty or len(df) < 30:
            continue

        total += 1
        ltp = float(df.iloc[-1]["Close"])
        all_fvgs = detect_bullish_fvgs(df)
        active_raw = [f for f in all_fvgs if f.get("is_active", False)]
        active_filtered = filter_active_fvgs(all_fvgs, ltp)
        mitigated = len(all_fvgs) - len(active_raw)

        # Manual ICT verification: for each "active" FVG, verify no subsequent
        # candle low <= gap_high
        manual_active_count = 0
        for f in all_fvgs:
            idx = f["formed_idx"]
            future = df.iloc[idx + 1:]
            if future.empty:
                manual_active_count += 1
                continue
            min_low = float(future["Low"].min())
            if min_low > f["high"]:
                manual_active_count += 1

        matches = len(active_raw) == manual_active_count
        verdict = "✅ PASS" if matches else f"❌ FAIL ({manual_active_count})"
        if matches:
            correct += 1

        print(f"{sym:15} | {len(all_fvgs):>5} | {mitigated:>9} | {len(active_raw):>11} | {len(active_filtered):>12} | {verdict:>10}")

    accuracy = (correct / total * 100) if total > 0 else 0
    print(f"\nAccuracy: {correct}/{total} = {accuracy:.1f}%")
    if accuracy == 100:
        print("✅ ICT mitigation logic is 100% accurate.")
    else:
        print("⚠️ Mitigation logic has discrepancies — investigate.")
    print()


def main():
    print("\n" + "🔍 " * 20)
    print("  FVG v3 AUDIT & VALIDATION REPORT")
    print("🔍 " * 20 + "\n")

    step1_sumeetinds_trace()
    step4_validate_50_stocks()
    step7_debug_selected_stocks()
    step8_accuracy_check()

    print("=" * 70)
    print("AUDIT COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    main()
