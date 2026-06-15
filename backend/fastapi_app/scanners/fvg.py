"""
FinAI Edge — FVG Scanner (v2 Rebuild)
=======================================
ICT-style Fair Value Gap detection and 52-week High/Low analysis.
Calculated entirely from local Stock_Data.csv.
"""

import math
import pandas as pd
import numpy as np
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

MIN_FVG_GAP_PCT = 0.01  # 1% minimum gap size threshold

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

        # ICT-style bullish FVG: both candle 2 low and candle 3 low above candle 1 high
        if (c2["Low"] > c1["High"]) and (c3["Low"] > c1["High"]):
            gap_low = float(c1["High"])
            gap_high = float(min(c2["Low"], c3["Low"]))

            # Enforce a minimum gap size in percentage of Candle 3 close
            ref_price = float(c3["Close"])
            min_gap = ref_price * min_gap_pct

            if (gap_high - gap_low) >= min_gap:
                c3_date = pd.Timestamp(c3["Date"])
                age_days = (current_time - c3_date.to_pydatetime()).days
                
                # Check subsequent candles for mitigation (filling the FVG completely)
                future_lows = df.iloc[i + 3:]["Low"]
                is_active = True
                if not future_lows.empty:
                    # FVG is active (not completely filled) if subsequent Low > gap_low
                    is_active = float(future_lows.min()) > gap_low
                
                results.append({
                    "formed_idx": i + 2,
                    "low": round(gap_low, 2),
                    "high": round(gap_high, 2),
                    "gap_pct": round((gap_high - gap_low) / ref_price * 100, 2),
                    "start_date": c1["Date"].strftime("%Y-%m-%d") if hasattr(c1["Date"], "strftime") else str(c1["Date"]),
                    "end_date": c3["Date"].strftime("%Y-%m-%d") if hasattr(c3["Date"], "strftime") else str(c3["Date"]),
                    "age_days": max(0, age_days),
                    "is_active": is_active,
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

def analyze_fvg_for_symbol(df: pd.DataFrame, symbol: str, company_name: str = "") -> Dict[str, Any]:
    """
    Analyzes historical candles for a single symbol to extract FVG results:
    - 52-week High/Low
    - Pure ICT Bullish FVGs (all history)
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
    
    # Filter only active (unmitigated) FVGs
    active_fvgs = [f for f in all_fvgs if f.get("is_active", True)]
    
    # Keep only the last 5 active FVGs (newest first)
    active_fvgs_desc = active_fvgs[::-1][:5]
    
    # Calculate distance for each active FVG
    for f in active_fvgs_desc:
        f["distance_pct"] = round(((ltp - f["high"]) / f["high"]) * 100, 2)

    # Find the nearest active FVG (min absolute distance)
    nearest_fvg = None
    nearest_dist = None
    for f in active_fvgs_desc:
        dist = f["distance_pct"]
        if nearest_dist is None or abs(dist) < abs(nearest_dist):
            nearest_dist = dist
            nearest_fvg = f

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
        "fvgs": active_fvgs_desc,
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
    Uses the new detect_bullish_fvgs.
    """
    bull_fvgs = detect_bullish_fvgs(df)
    
    # Map to the old structure
    top_bull = []
    for f in bull_fvgs[-max_fvgs:]:
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
    
    top_bull = top_bull[::-1]  # most recent first
    nearest_bull = min(top_bull, key=lambda f: abs(ltp - f["gap_mid"])) if top_bull else None
    
    return {
        "symbol":              symbol,
        "has_fvg_bullish":     len(top_bull) > 0,
        "has_fvg_bearish":     False,
        "total_fvgs_bullish":  len(bull_fvgs),
        "total_fvgs_bearish":  0,
        "top_bullish_fvgs":    top_bull,
        "top_bearish_fvgs":    [],
        "nearest_bullish_fvg": nearest_bull,
        "best_fvg_score":      0,
    }
