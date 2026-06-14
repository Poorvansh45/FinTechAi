"""
FinAI Edge — FVG Scanner
=========================
ICT-style Fair Value Gap detection with full scoring system.

Bullish FVG Requirements (strict ICT):
  - Candle 1 High < Candle 3 Low  (the gap between C1 high and C3 low)
  - Gap size >= ATR threshold
  - Not fully mitigated (price hasn't closed into the full gap)

Produces FVG Score (0–100) per zone.
"""

import math
import pandas as pd
import numpy as np
from datetime import datetime
from typing import List, Dict, Any, Optional


def _safe(v) -> Optional[float]:
    try:
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else round(f, 4)
    except Exception:
        return None


def _compute_atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    high = df["High"]
    low  = df["Low"]
    prev_close = df["Close"].shift(1)
    tr = pd.concat([
        high - low,
        (high - prev_close).abs(),
        (low  - prev_close).abs(),
    ], axis=1).max(axis=1)
    return tr.rolling(period, min_periods=1).mean()


def detect_bullish_fvgs(
    df: pd.DataFrame,
    min_gap_atr_mult: float = 0.3,
) -> List[Dict[str, Any]]:
    """
    True ICT Bullish FVG:
      - C1.High < C3.Low
      - Gap = [C1.High, C3.Low]
      - Gap size >= min_gap_atr_mult * ATR(14)

    Returns list of gap dicts.
    """
    df = df.sort_values("Date").reset_index(drop=True)
    atr = _compute_atr(df)
    fvgs = []

    N = len(df)
    if N < 3:
        return fvgs

    for i in range(N - 2):
        c1 = df.iloc[i]
        c2 = df.iloc[i + 1]
        c3 = df.iloc[i + 2]

        # Core ICT rule: C1 High < C3 Low
        if c3["Low"] <= c1["High"]:
            continue

        gap_low  = float(c1["High"])
        gap_high = float(c3["Low"])
        gap_size = gap_high - gap_low

        # ATR threshold
        bar_atr = float(atr.iloc[i + 2])
        if bar_atr > 0 and gap_size < (min_gap_atr_mult * bar_atr):
            continue

        # Displacement: C2 should be a strong bullish move
        c2_body = abs(float(c2["Close"]) - float(c2["Open"]))
        c2_range = float(c2["High"]) - float(c2["Low"])
        displacement = (c2_body / c2_range) if c2_range > 0 else 0

        future_df = df.iloc[i + 3:]
        if not future_df.empty:
            # Use Close (not Low) for deep failure — ICT considers a gap
            # mitigated only when the close breaches, not just a wick.
            min_close_after = float(future_df["Close"].min())
            if min_close_after < gap_low:
                # Fully breached by close — skip (deep failure)
                continue
            # Mitigation % based on how far Low has entered the gap
            min_low_after = float(future_df["Low"].min())
            mitigation_pct = max(0.0, (gap_high - min_low_after) / max(gap_size, 0.01) * 100)
        else:
            mitigation_pct = 0.0

        # Touch count (partial touches = low enters gap)
        touch_count = 0
        if not future_df.empty:
            touches = future_df[(future_df["Low"] <= gap_high) & (future_df["Low"] >= gap_low)]
            touch_count = len(touches)

        # Age
        try:
            date_c3 = pd.Timestamp(c3["Date"])
            age_days = (pd.Timestamp.now() - date_c3).days
        except Exception:
            age_days = 0

        fvgs.append({
            "formed_idx":       i + 2,
            "gap_low":          round(gap_low, 2),
            "gap_high":         round(gap_high, 2),
            "gap_mid":          round((gap_low + gap_high) / 2, 2),
            "gap_size":         round(gap_size, 2),
            "gap_size_pct":     round(gap_size / max(float(c3["Close"]), 1) * 100, 3),
            "displacement":     round(displacement, 3),
            "atr_at_formation": round(bar_atr, 2),
            "mitigation_pct":   round(mitigation_pct, 1),
            "touch_count":      touch_count,
            "age_days":         age_days,
            "start_date":       c1["Date"],
            "end_date":         c3["Date"],
            "status":           _get_fvg_status(mitigation_pct, touch_count),
        })

    return fvgs


def detect_bearish_fvgs(
    df: pd.DataFrame,
    min_gap_atr_mult: float = 0.3,
) -> List[Dict[str, Any]]:
    """
    Bearish FVG: C1.Low > C3.High
    Gap = [C3.High, C1.Low]
    """
    df = df.sort_values("Date").reset_index(drop=True)
    atr = _compute_atr(df)
    fvgs = []

    N = len(df)
    if N < 3:
        return fvgs

    for i in range(N - 2):
        c1 = df.iloc[i]
        c2 = df.iloc[i + 1]
        c3 = df.iloc[i + 2]

        if c3["High"] >= c1["Low"]:
            continue

        gap_low  = float(c3["High"])
        gap_high = float(c1["Low"])
        gap_size = gap_high - gap_low

        bar_atr = float(atr.iloc[i + 2])
        if bar_atr > 0 and gap_size < (min_gap_atr_mult * bar_atr):
            continue

        c2_body  = abs(float(c2["Close"]) - float(c2["Open"]))
        c2_range = float(c2["High"]) - float(c2["Low"])
        displacement = (c2_body / c2_range) if c2_range > 0 else 0

        future_df = df.iloc[i + 3:]
        if not future_df.empty:
            # Use Close (not High) for deep failure — ICT considers a gap
            # mitigated only when the close breaches, not just a wick.
            max_close_after = float(future_df["Close"].max())
            if max_close_after > gap_high:
                continue  # Deep failure
            # Mitigation % based on how far High has entered the gap
            max_high_after = float(future_df["High"].max())
            mitigation_pct = max(0.0, (max_high_after - gap_low) / max(gap_size, 0.01) * 100)
        else:
            mitigation_pct = 0.0

        touch_count = 0
        if not future_df.empty:
            touches = future_df[(future_df["High"] >= gap_low) & (future_df["High"] <= gap_high)]
            touch_count = len(touches)

        try:
            age_days = (pd.Timestamp.now() - pd.Timestamp(c3["Date"])).days
        except Exception:
            age_days = 0

        fvgs.append({
            "formed_idx":       i + 2,
            "gap_low":          round(gap_low, 2),
            "gap_high":         round(gap_high, 2),
            "gap_mid":          round((gap_low + gap_high) / 2, 2),
            "gap_size":         round(gap_size, 2),
            "gap_size_pct":     round(gap_size / max(float(c3["Close"]), 1) * 100, 3),
            "displacement":     round(displacement, 3),
            "atr_at_formation": round(bar_atr, 2),
            "mitigation_pct":   round(mitigation_pct, 1),
            "touch_count":      touch_count,
            "age_days":         age_days,
            "start_date":       c1["Date"],
            "end_date":         c3["Date"],
            "status":           _get_fvg_status(mitigation_pct, touch_count),
        })

    return fvgs


def _get_fvg_status(mitigation_pct: float, touch_count: int) -> str:
    if mitigation_pct == 0 and touch_count == 0:
        return "Untouched"
    elif mitigation_pct == 0 and touch_count > 0:
        return "Touched"
    elif mitigation_pct < 50:
        return "PartiallyFilled"
    else:
        return "MostlyFilled"


def compute_fvg_score(
    fvg: Dict[str, Any],
    ltp: float,
    rsi: Optional[float] = None,
    ema_200_dist: Optional[float] = None,
) -> int:
    """
    FVG Score (0–100):
      Gap Size pct   (>0.5% = 20pts)
      Displacement   (>0.7 body ratio = 20pts)
      Mitigation     (0% = 20pts, partial = 10pts)
      Touch count    (0 = 15pts, 1 = 8pts)
      Distance       (≤2% = 15pts, ≤5% = 8pts)
      EMA alignment  (above EMA200 = 5pts)
      RSI health     (40-65 = 5pts)
    """
    score = 0

    # Gap size
    gsp = fvg.get("gap_size_pct", 0)
    if gsp >= 1.0:   score += 20
    elif gsp >= 0.5: score += 12
    elif gsp >= 0.2: score += 6

    # Displacement
    disp = fvg.get("displacement", 0)
    if disp >= 0.7:  score += 20
    elif disp >= 0.5: score += 12
    elif disp >= 0.3: score += 6

    # Mitigation
    mit = fvg.get("mitigation_pct", 100)
    if mit == 0:     score += 20
    elif mit < 25:   score += 14
    elif mit < 50:   score += 8

    # Touch count
    tc = fvg.get("touch_count", 0)
    if tc == 0:      score += 15
    elif tc == 1:    score += 8

    # Distance from LTP to gap
    gap_high = fvg.get("gap_high", ltp)
    gap_low  = fvg.get("gap_low", ltp)

    if ltp > gap_high:
        dist_pct = (ltp - gap_high) / max(gap_high, 1) * 100
    elif ltp < gap_low:
        dist_pct = (gap_low - ltp) / max(gap_low, 1) * 100
    else:
        dist_pct = 0.0

    if dist_pct <= 2:    score += 15
    elif dist_pct <= 5:  score += 8
    elif dist_pct <= 10: score += 3

    # EMA 200 alignment
    if ema_200_dist is not None and ema_200_dist > 0:
        score += 5

    # RSI health
    if rsi is not None and 40 <= rsi <= 65:
        score += 5

    return min(score, 100)


def score_to_strength(score: int) -> str:
    if score >= 70: return "Strong"
    if score >= 45: return "Medium"
    return "Weak"


def get_latest_fvgs_for_symbol(
    df: pd.DataFrame,
    symbol: str,
    ltp: float,
    rsi: Optional[float] = None,
    ema_200_dist: Optional[float] = None,
    max_fvgs: int = 3,
) -> Dict[str, Any]:
    """
    Runs FVG detection on a symbol's DataFrame and returns the
    top N bullish FVGs (most recent, not fully mitigated) with scoring.
    """
    bull_fvgs = detect_bullish_fvgs(df)
    bear_fvgs = detect_bearish_fvgs(df)

    # Score and enrich
    for fvg in bull_fvgs:
        fvg["fvg_score"]    = compute_fvg_score(fvg, ltp, rsi, ema_200_dist)
        fvg["strength"]     = score_to_strength(fvg["fvg_score"])
        fvg["direction"]    = "bullish"
        fvg["distance_pct"] = round(
            (ltp - fvg["gap_high"]) / max(fvg["gap_high"], 1) * 100
            if ltp > fvg["gap_high"]
            else (fvg["gap_low"] - ltp) / max(fvg["gap_low"], 1) * 100
            if ltp < fvg["gap_low"]
            else 0.0,
            2
        )

    for fvg in bear_fvgs:
        fvg["fvg_score"]    = compute_fvg_score(fvg, ltp, rsi, ema_200_dist)
        fvg["strength"]     = score_to_strength(fvg["fvg_score"])
        fvg["direction"]    = "bearish"
        fvg["distance_pct"] = round(
            (fvg["gap_low"] - ltp) / max(fvg["gap_low"], 1) * 100
            if ltp < fvg["gap_low"]
            else (ltp - fvg["gap_high"]) / max(fvg["gap_high"], 1) * 100
            if ltp > fvg["gap_high"]
            else 0.0,
            2
        )

    # Filters: not fully mitigated
    valid_bull = [f for f in bull_fvgs if f.get("mitigation_pct", 100) < 95]
    valid_bear = [f for f in bear_fvgs if f.get("mitigation_pct", 100) < 95]

    # Sort by most recent (highest formed_idx)
    valid_bull.sort(key=lambda x: x["formed_idx"], reverse=True)
    valid_bear.sort(key=lambda x: x["formed_idx"], reverse=True)

    top_bull = valid_bull[:max_fvgs]
    nearest_bull = min(top_bull, key=lambda f: abs(ltp - f["gap_mid"])) if top_bull else None

    return {
        "symbol":              symbol,
        "has_fvg_bullish":     len(top_bull) > 0,
        "has_fvg_bearish":     len(valid_bear) > 0,
        "total_fvgs_bullish":  len(valid_bull),
        "total_fvgs_bearish":  len(valid_bear),
        "top_bullish_fvgs":    top_bull,
        "top_bearish_fvgs":    valid_bear[:max_fvgs],
        "nearest_bullish_fvg": nearest_bull,
        "best_fvg_score":      max((f["fvg_score"] for f in top_bull), default=0),
    }
