import os
import sys

# Add project path to python import path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scanners.fvg import analyze_fvg_for_symbol
from services.ohlc_downloader import load_stock_dataframe


def test_redesign():
    print("=" * 60)
    print("FVG REDESIGN VALIDATION CHECK")
    print("=" * 60)

    # Test symbol BLUECHIP
    symbol = "BLUECHIP"
    df = load_stock_dataframe(symbol)
    if df.empty:
        print("[FAIL] BLUECHIP data is empty in Stock_Data.csv.")
        sys.exit(1)

    print(f"Candles loaded for {symbol}: {len(df)}")

    # Run active analysis
    fvg_data = analyze_fvg_for_symbol(df, symbol, company_name="Blue Chip India")

    # Verify FVG count
    print(f"Historical FVG count: {fvg_data['historical_fvg_count']}")
    print(f"Active FVG count    : {fvg_data['active_fvg_count']}")
    print(f"Cached FVGs array sz: {len(fvg_data['fvgs'])}")

    # Assert fvgs size <= 5
    if len(fvg_data["fvgs"]) > 5:
        print(
            f"[FAIL] Active FVG list exceeds maximum limit of 5. Found: {len(fvg_data['fvgs'])}"
        )
        sys.exit(1)
    else:
        print("[PASS] Active FVG list is sliced to max 5 items.")

    # Verify nearest FVG distance
    ltp = fvg_data["ltp"]
    print(f"Stock LTP: {ltp}")
    print(f"Nearest Active FVG High: {fvg_data['nearest_fvg_high']}")
    print(f"Nearest Active FVG Dist: {fvg_data['nearest_fvg_dist_pct']}%")

    if fvg_data["nearest_fvg_high"] is not None:
        expected_dist = round(
            ((ltp - fvg_data["nearest_fvg_high"]) / fvg_data["nearest_fvg_high"]) * 100,
            2,
        )
        if abs(expected_dist - fvg_data["nearest_fvg_dist_pct"]) > 0.01:
            print(
                f"[FAIL] Nearest FVG distance calculation mismatch. Expected: {expected_dist}%, Got: {fvg_data['nearest_fvg_dist_pct']}%"
            )
            sys.exit(1)
        else:
            print(
                "[PASS] Distance to nearest active FVG matches expected formula exactly."
            )

    # Check all returned FVGs are active
    for idx, f in enumerate(fvg_data["fvgs"]):
        if not f.get("is_active", True):
            print(f"[FAIL] Mitigated FVG found in active list at index {idx}: {f}")
            sys.exit(1)
    print("[PASS] All returned FVG records are confirmed active (unmitigated).")

    print("\n" + "=" * 60)
    print("✓ SUCCESS: Redesigned FVG scanner engine passes all active checks!")
    print("=" * 60)
    sys.exit(0)


if __name__ == "__main__":
    test_redesign()
