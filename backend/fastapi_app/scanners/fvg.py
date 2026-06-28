"""
FinAI Edge — FVG Scanner (v3 — ICT-Correct Active FVG Logic)
==============================================================
ICT-style Fair Value Gap detection and 52-week High/Low analysis.
Calculated entirely from local Stock_Data.csv.

Key fixes in v3:
  - ICT-correct mitigation: FVG is mitigated when price trades INTO the gap
    (any subsequent candle low <= gap_high), not just when fully filled.
  - Active FVG filtering: exclude mitigated, stale (>1yr), and distant (>100%) FVGs.
  - Nearest-to-price selection instead of newest-first.
  - Debug output helper for verification.
"""

import math
import logging
import pandas as pd
import numpy as np
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

log = logging.getLogger("finai_edge.fvg_scanner")

MIN_FVG_GAP_PCT = 0.01   # 1% minimum gap size threshold
MAX_FVG_GAP_PCT = 10.0   # 10% maximum gap size — wider gaps are bad data or not actionable
MAX_FVG_AGE_DAYS = 365   # Exclude FVGs older than 1 year
MAX_FVG_DISTANCE_PCT = 100.0  # Exclude FVGs more than 100% away from price
MAX_CANDLE_SPAN_DAYS = 5  # Max calendar days between C1 and C3 (catches data gaps)

def _safe(v) -> Optional[float]:
    try:
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else round(f, 2)
    except Exception:
        return None


def detect_bullish_fvgs(df: pd.DataFrame, min_gap_pct: float = MIN_FVG_GAP_PCT) -> List[Dict[str, Any]]:
    """
    Detect all bullish FVGs for a single stock's full history, ICT-style:
    - Candle 2 Low > Candle 1 High
    - Candle 3 Low > Candle 1 High
    Gap zone: [Candle1.High, min(Candle2.Low, Candle3.Low)]
    Minimum Gap Size: (High - Low) >= Candle3.Close * min_gap_pct

    ICT Mitigation Rule (v3):
    A bullish FVG is MITIGATED when any subsequent candle's Low trades
    into or through the gap zone (Low <= gap_high). This means price has
    returned to fill the imbalance.

    Returns a list of dicts with levels and dates, sorted oldest to newest.
    """
    df = df.sort_values("Date").reset_index(drop=True)
    results = []
    N = len(df)
    if N < 3:
        return results

    current_time = datetime.now()

    for i in range(N - 2):
        c1 = df.iloc[i]
        c2 = df.iloc[i + 1]
        c3 = df.iloc[i + 2]

        # Data continuity check: skip if the 3 candles span too many days
        # (indicates missing data creating artificial gaps)
        c1_date = pd.Timestamp(c1["Date"])
        c3_date_ts = pd.Timestamp(c3["Date"])
        span_days = (c3_date_ts - c1_date).days
        if span_days > MAX_CANDLE_SPAN_DAYS:
            continue

        # ICT-style bullish FVG (standard definition):
        # Candle 2 is the impulse candle — it creates the imbalance.
        # The FVG zone is the gap between Candle 1's High and Candle 3's Low.
        # Condition: Candle 3 Low > Candle 1 High (there is a gap/imbalance)
        # Note: Candle 2's low does NOT need to be above Candle 1's high.
        if c3["Low"] > c1["High"]:
            gap_low = float(c1["High"])
            gap_high = float(c3["Low"])

            # Enforce a minimum gap size in percentage of Candle 3 close
            ref_price = float(c3["Close"])
            min_gap = ref_price * min_gap_pct

            # Also enforce a maximum gap size — gaps > 10% of price are
            # likely bad data or extreme events, not actionable ICT FVGs
            max_gap = ref_price * (MAX_FVG_GAP_PCT / 100)

            if (gap_high - gap_low) >= min_gap and (gap_high - gap_low) <= max_gap:
                c3_date = pd.Timestamp(c3["Date"])
                age_days = (current_time - c3_date.to_pydatetime()).days

                # ICT-correct mitigation check:
                # A bullish FVG is mitigated when price trades INTO the gap.
                # This means any subsequent candle's Low <= gap_high.
                future_lows = df.iloc[i + 3:]["Low"]
                is_active = True
                mitigation_reason = None
                if not future_lows.empty:
                    min_future_low = float(future_lows.min())
                    if min_future_low <= gap_high:
                        # Price entered (or passed through) the gap zone → mitigated
                        is_active = False
                        if min_future_low <= gap_low:
                            mitigation_reason = "fully_filled"
                        else:
                            mitigation_reason = "partially_filled"

                results.append({
                    "formed_idx": i + 2,
                    "low": round(gap_low, 2),
                    "high": round(gap_high, 2),
                    "gap_pct": round((gap_high - gap_low) / ref_price * 100, 2),
                    "start_date": c1["Date"].strftime("%Y-%m-%d") if hasattr(c1["Date"], "strftime") else str(c1["Date"]),
                    "end_date": c3["Date"].strftime("%Y-%m-%d") if hasattr(c3["Date"], "strftime") else str(c3["Date"]),
                    "age_days": max(0, age_days),
                    "is_active": is_active,
                    "mitigation_reason": mitigation_reason,
                    "is_duplicate": False,
                })

    # Flag duplicate overlapping chains
    for idx in range(1, len(results)):
        f1 = results[idx - 1]
        f2 = results[idx]
        overlap_low = max(f1["low"], f2["low"])
        overlap_high = min(f1["high"], f2["high"])
        if overlap_low < overlap_high:
            f2["is_duplicate"] = True

    return results


def filter_active_fvgs(
    all_fvgs: List[Dict[str, Any]],
    current_price: float,
    max_age_days: int = MAX_FVG_AGE_DAYS,
    max_distance_pct: float = MAX_FVG_DISTANCE_PCT,
) -> List[Dict[str, Any]]:
    """
    Filter FVGs to keep only valid, actionable active FVGs.

    Excludes:
    - Mitigated FVGs (is_active == False)
    - Duplicate overlapping FVGs (is_duplicate == True)
    - FVGs older than max_age_days (default 365)
    - FVGs where gap_high is more than max_distance_pct away from current price

    Returns filtered list sorted by absolute distance to current price (nearest first).
    """
    active = []
    for f in all_fvgs:
        # Must be unmitigated
        if not f.get("is_active", False):
            continue

        # Skip duplicates
        if f.get("is_duplicate", False):
            continue

        # Age filter: skip FVGs older than threshold
        if f.get("age_days", 0) > max_age_days:
            continue

        # Distance filter: skip FVGs too far from current price
        distance_pct = abs((current_price - f["high"]) / f["high"] * 100) if f["high"] > 0 else float("inf")
        if distance_pct > max_distance_pct:
            continue

        active.append(f)

    # Sort by absolute distance to current price (nearest first)
    active.sort(key=lambda f: abs(current_price - (f["low"] + f["high"]) / 2))

    return active


def analyze_fvg_for_symbol(df: pd.DataFrame, symbol: str, company_name: str = "") -> Dict[str, Any]:
    """
    Analyzes historical candles for a single symbol to extract FVG results:
    - 52-week High/Low
    - Pure ICT Bullish FVGs (active only, filtered)
    - Distances from High/Low
    - LTP/latest values
    """
    df = df.sort_values("Date").reset_index(drop=True)
    N = len(df)
    if N == 0:
        return {}

    # Latest close price (LTP)
    ltp = float(df.iloc[-1]["Close"])

    # 52-week High/Low
    high_window = df["High"].rolling(window=252, min_periods=1).max()
    low_window = df["Low"].rolling(window=252, min_periods=1).min()

    wk52_high = float(high_window.iloc[-1])
    wk52_low = float(low_window.iloc[-1])

    # Distance % from 52W High and Low
    distance_high_pct = round(((ltp - wk52_high) / wk52_high) * 100, 2) if wk52_high else 0.0
    distance_low_pct = round(((ltp - wk52_low) / wk52_low) * 100, 2) if wk52_low else 0.0

    # Detect all bullish FVGs
    all_fvgs = detect_bullish_fvgs(df)

    # Count raw active (before age/distance filtering) for stats
    raw_active_count = sum(1 for f in all_fvgs if f.get("is_active", False))

    # Filter to valid, actionable active FVGs
    active_fvgs = filter_active_fvgs(all_fvgs, ltp)

    # Keep only the top 5 nearest active FVGs
    active_fvgs_top5 = active_fvgs[:5]

    # Calculate distance for each active FVG
    for f in active_fvgs_top5:
        f["distance_pct"] = round(((ltp - f["high"]) / f["high"]) * 100, 2)

    # Find the nearest active FVG (min absolute distance)
    nearest_fvg = None
    nearest_dist = None
    if active_fvgs_top5:
        nearest_fvg = active_fvgs_top5[0]  # Already sorted by distance
        nearest_dist = nearest_fvg["distance_pct"]

    return {
        "symbol": symbol,
        "company_name": company_name,
        "company": company_name,  # support both names for frontend compatibility
        "ltp": round(ltp, 2),
        "price": round(ltp, 2),
        "week52_high": round(wk52_high, 2),
        "week52_low": round(wk52_low, 2),
        "52w_high": round(wk52_high, 2),
        "52w_low": round(wk52_low, 2),
        "distance_high_pct": distance_high_pct,
        "distance_low_pct": distance_low_pct,
        "historical_fvg_count": len(all_fvgs),
        "active_fvg_count": len(active_fvgs),
        "fvg_count": len(active_fvgs),  # compatibility field
        "nearest_fvg_high": nearest_fvg["high"] if nearest_fvg else None,
        "nearest_fvg_dist_pct": nearest_dist if nearest_dist is not None else None,
        "fvgs": active_fvgs_top5,
        "updated_at": datetime.now(timezone.utc),
        "last_updated": datetime.now(timezone.utc),
    }

def get_latest_fvgs_for_symbol(
    df: pd.DataFrame,
    symbol: str,
    ltp: float,
    rsi: Optional[float] = None,
    ema_200_dist: Optional[float] = None,
    max_fvgs: int = 3,
) -> Dict[str, Any]:
    """
    Backward-compatibility wrapper for local OHLC service.
    Uses the new detect_bullish_fvgs with proper active filtering.
    """
    bull_fvgs = detect_bullish_fvgs(df)

    # Filter to only active, actionable FVGs (v3 fix)
    active_fvgs = filter_active_fvgs(bull_fvgs, ltp)

    # Map to the old structure, limited to max_fvgs nearest FVGs
    top_bull = []
    for f in active_fvgs[:max_fvgs]:
        top_bull.append({
            "low": f["low"],
            "high": f["high"],
            "gap_low": f["low"],
            "gap_high": f["high"],
            "gap_mid": (f["low"] + f["high"]) / 2,
            "gap_size": f["high"] - f["low"],
            "gap_size_pct": f["gap_pct"],
            "mitigation_pct": 0.0,
            "touch_count": 0,
            "age_days": f["age_days"],
            "start_date": f["start_date"],
            "end_date": f["end_date"],
            "status": "Untouched",
            "fvg_score": 0,
            "strength": "Medium",
            "direction": "bullish"
        })

    nearest_bull = min(top_bull, key=lambda f: abs(ltp - f["gap_mid"])) if top_bull else None

    return {
        "symbol":              symbol,
        "has_fvg_bullish":     len(top_bull) > 0,
        "has_fvg_bearish":     False,
        "total_fvgs_bullish":  len(active_fvgs),
        "total_fvgs_bearish":  0,
        "top_bullish_fvgs":    top_bull,
        "top_bearish_fvgs":    [],
        "nearest_bullish_fvg": nearest_bull,
        "best_fvg_score":      0,
    }


def debug_fvg_for_symbol(df: pd.DataFrame, symbol: str, ltp: Optional[float] = None) -> str:
    """
    Debug helper — returns a formatted string with complete FVG analysis
    for verification purposes.

    Usage:
        df = load_stock_dataframe("SUMEETINDS")
        print(debug_fvg_for_symbol(df, "SUMEETINDS"))
    """
    df = df.sort_values("Date").reset_index(drop=True)
    if df.empty:
        return f"[{symbol}] No data available."

    if ltp is None:
        ltp = float(df.iloc[-1]["Close"])

    all_fvgs = detect_bullish_fvgs(df)
    active_fvgs = filter_active_fvgs(all_fvgs, ltp)

    mitigated_count = sum(1 for f in all_fvgs if not f.get("is_active", False))
    stale_count = sum(1 for f in all_fvgs if f.get("is_active", False) and f.get("age_days", 0) > MAX_FVG_AGE_DAYS)
    distant_count = sum(
        1 for f in all_fvgs
        if f.get("is_active", False)
        and f.get("age_days", 0) <= MAX_FVG_AGE_DAYS
        and abs((ltp - f["high"]) / f["high"] * 100) > MAX_FVG_DISTANCE_PCT
    )

    lines = [
        "=" * 60,
        f"  FVG DEBUG: {symbol}",
        "=" * 60,
        f"  Current Price (LTP)  : ₹{ltp:.2f}",
        f"  Total FVGs Found     : {len(all_fvgs)}",
        f"  Mitigated FVGs       : {mitigated_count}",
        f"  Stale FVGs (>{MAX_FVG_AGE_DAYS}d)  : {stale_count}",
        f"  Distant FVGs (>{MAX_FVG_DISTANCE_PCT}%) : {distant_count}",
        f"  Active FVGs          : {len(active_fvgs)}",
        "-" * 60,
    ]

    if active_fvgs:
        nearest = active_fvgs[0]
        dist = round(((ltp - nearest["high"]) / nearest["high"]) * 100, 2)
        lines.append(f"  Nearest Active FVG   : ₹{nearest['low']:.2f} – ₹{nearest['high']:.2f}")
        lines.append(f"  Nearest FVG Date     : {nearest['end_date']} ({nearest['age_days']}d ago)")
        lines.append(f"  Distance to Nearest  : {dist:+.2f}%")
        lines.append("-" * 60)

        lines.append("  All Active FVGs (nearest first):")
        for i, f in enumerate(active_fvgs[:10]):
            d = round(((ltp - f["high"]) / f["high"]) * 100, 2)
            lines.append(
                f"    #{i+1}: ₹{f['low']:.2f}–₹{f['high']:.2f}  "
                f"Date: {f['end_date']}  Age: {f['age_days']}d  Dist: {d:+.2f}%"
            )
    else:
        lines.append("  No active FVGs found for this stock.")

    lines.append("=" * 60)
    return "\n".join(lines)
