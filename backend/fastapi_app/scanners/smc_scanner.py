"""
FinAI Edge — SMC Scanner
=========================
Production-grade Smart Money Concepts scanner.
Faithfully implements LuxAlgo Pine Script logic:
  - Swing High/Low detection (configurable length)
  - BOS / CHoCH (Bullish & Bearish)
  - Demand & Supply Order Blocks
  - Equal Highs / Equal Lows (ATR-based threshold)
  - Premium / Discount / Equilibrium Zones
  - SMC Score (0-100)
"""

import math
import pandas as pd
import numpy as np
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional


# ── Helpers ──────────────────────────────────────────────────────────────────

def _safe_float(v) -> Optional[float]:
    try:
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else round(f, 4)
    except Exception:
        return None


def _compute_atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """True range ATR, pandas-only fallback."""
    high = df["High"]
    low  = df["Low"]
    prev_close = df["Close"].shift(1)
    tr = pd.concat([
        high - low,
        (high - prev_close).abs(),
        (low  - prev_close).abs(),
    ], axis=1).max(axis=1)
    return tr.rolling(period, min_periods=1).mean()


# ── Swing Detection ──────────────────────────────────────────────────────────

def detect_swing_highs_lows(df: pd.DataFrame, swing_len: int = 5, suffix: str = "") -> pd.DataFrame:
    """
    Vectorized swing high/low detection.
    A bar is a swing high if its High equals the rolling max over
    [bar - swing_len, bar + swing_len] (centre window).
    Also labels HH/HL/LH/LL on structure points.
    """
    window = swing_len * 2 + 1
    df = df.copy()
    sh_col = f"SwingHigh{suffix}"
    sl_col = f"SwingLow{suffix}"
    df[sh_col] = df["High"] == df["High"].rolling(window, center=True, min_periods=window).max()
    df[sl_col]  = df["Low"]  == df["Low"].rolling(window, center=True, min_periods=window).min()
    
    # Label swing points
    label_sh_col = f"SwingHigh{suffix}_Label"
    label_sl_col = f"SwingLow{suffix}_Label"
    df[label_sh_col] = ""
    df[label_sl_col] = ""
    
    prev_sh = None
    prev_sl = None
    for idx in df.index:
        if df.loc[idx, sh_col]:
            curr_sh = df.loc[idx, "High"]
            if prev_sh is None:
                df.at[idx, label_sh_col] = "HH"
            elif curr_sh > prev_sh:
                df.at[idx, label_sh_col] = "HH"
            else:
                df.at[idx, label_sh_col] = "LH"
            prev_sh = curr_sh
            
        if df.loc[idx, sl_col]:
            curr_sl = df.loc[idx, "Low"]
            if prev_sl is None:
                df.at[idx, label_sl_col] = "LL"
            elif curr_sl > prev_sl:
                df.at[idx, label_sl_col] = "HL"
            else:
                df.at[idx, label_sl_col] = "LL"
            prev_sl = curr_sl
            
    return df


# ── BOS / CHoCH Detection ────────────────────────────────────────────────────

def detect_structure_events(df: pd.DataFrame, suffix: str = "") -> List[Dict[str, Any]]:
    """
    Detects Bullish and Bearish BOS / CHoCH events.
    Returns list of events with full metadata.
    """
    events: List[Dict[str, Any]] = []
    trend        = None      # "bullish" | "bearish" | None
    last_sh      = None      # last confirmed swing high price
    last_sl      = None      # last confirmed swing low price
    last_sh_idx  = None
    last_sl_idx  = None
    
    sh_col = f"SwingHigh{suffix}"
    sl_col = f"SwingLow{suffix}"
    label_sh_col = f"SwingHigh{suffix}_Label"
    label_sl_col = f"SwingLow{suffix}_Label"

    for i in df.index:
        # Track swings
        if df.loc[i, sh_col]:
            last_sh     = df.loc[i, "High"]
            last_sh_idx = i
        if df.loc[i, sl_col]:
            last_sl     = df.loc[i, "Low"]
            last_sl_idx = i

        # ── Bullish BOS / CHoCH ──────────────────────────────────────────
        if last_sh is not None and df.loc[i, "Close"] > last_sh:
            ev = "BOS" if trend == "bullish" else "CHoCH"
            events.append({
                "bar_idx":      int(i),
                "date":         df.loc[i, "Date"],
                "close":        float(df.loc[i, "Close"]),
                "direction":    "bullish",
                "event":        ev,
                "broken_level":  float(last_sh),
                "leg_start_idx": int(last_sl_idx) if last_sl_idx is not None else None,
                "label":        str(df.loc[last_sh_idx, label_sh_col]) if last_sh_idx is not None else "",
            })
            trend   = "bullish"
            last_sh = None

        # ── Bearish BOS / CHoCH ──────────────────────────────────────────
        if last_sl is not None and df.loc[i, "Close"] < last_sl:
            ev = "BOS" if trend == "bearish" else "CHoCH"
            events.append({
                "bar_idx":      int(i),
                "date":         df.loc[i, "Date"],
                "close":        float(df.loc[i, "Close"]),
                "direction":    "bearish",
                "event":        ev,
                "broken_level":  float(last_sl),
                "leg_start_idx": int(last_sh_idx) if last_sh_idx is not None else None,
                "label":        str(df.loc[last_sl_idx, label_sl_col]) if last_sl_idx is not None else "",
            })
            trend   = "bearish"
            last_sl = None

    return events


# ── Order Block Extraction ───────────────────────────────────────────────────

def extract_order_blocks(
    df: pd.DataFrame,
    events: List[Dict[str, Any]],
    atr: pd.Series,
) -> List[Dict[str, Any]]:
    """
    For each BOS/CHoCH event, find the Order Block:
    - Bullish BOS/CHoCH: OB = the candle with the lowest low in the preceding leg
    - Bearish BOS/CHoCH: OB = the candle with the highest high in the preceding leg
    Uses LuxAlgo high-volatility bar parsing: when a bar's range >= 2x ATR,
    swaps high/low values for candidate selection.
    """
    obs: List[Dict[str, Any]] = []

    # Pre-calculate parsedHigh and parsedLow on df copies
    df = df.copy()
    df["parsedHigh"] = df["High"]
    df["parsedLow"] = df["Low"]
    
    for i in range(len(df)):
        atr_val = atr.iloc[i] if i < len(atr) else atr.mean()
        if (df.loc[i, "High"] - df.loc[i, "Low"]) >= (2 * atr_val):
            df.loc[i, "parsedHigh"] = df.loc[i, "Low"]
            df.loc[i, "parsedLow"]  = df.loc[i, "High"]

    for ev in events:
        leg_start = ev.get("leg_start_idx")
        bar_idx   = ev["bar_idx"]

        if leg_start is None or leg_start >= bar_idx:
            continue

        leg_df = df.iloc[leg_start:bar_idx]
        if leg_df.empty:
            continue

        # We find candidate using parsedLow / parsedHigh
        if ev["direction"] == "bullish":
            ob_row = leg_df.loc[leg_df["parsedLow"].idxmin()]
        else:
            ob_row = leg_df.loc[leg_df["parsedHigh"].idxmax()]

        # Set zone boundaries. If they were swapped (so zone_high < zone_low), we correct them.
        zone_high = float(ob_row["parsedHigh"])
        zone_low  = float(ob_row["parsedLow"])
        if zone_high < zone_low:
            zone_high, zone_low = zone_low, zone_high

        # Post-event invalidation check
        future_df = df.iloc[bar_idx:]
        status    = "Active"
        invalidated_date = None

        if ev["direction"] == "bullish":
            # Invalidated when close falls > 2% below zone_low
            if not future_df.empty:
                bad = future_df[future_df["Close"] < zone_low * 0.98]
                if not bad.empty:
                    status           = "Invalidated"
                    invalidated_date = bad.iloc[0]["Date"]
        else:
            # Bearish OB: invalidated when close rises > 2% above zone_high
            if not future_df.empty:
                bad = future_df[future_df["Close"] > zone_high * 1.02]
                if not bad.empty:
                    status           = "Invalidated"
                    invalidated_date = bad.iloc[0]["Date"]

        # Deep failure filter: price goes 5% through zone
        if not future_df.empty:
            if ev["direction"] == "bullish":
                if future_df["Close"].min() < zone_low * 0.95:
                    continue  # Complete failure, discard
            else:
                if future_df["Close"].max() > zone_high * 1.05:
                    continue

        # Touch count after creation
        touch_count = 0
        if not future_df.empty:
            touches = future_df[
                (future_df["Low"] <= zone_high) & (future_df["High"] >= zone_low)
            ]
            touch_count = len(touches)

        obs.append({
            "event":            ev["event"],
            "direction":        ev["direction"],
            "zone_high":        round(zone_high, 2),
            "zone_low":         round(zone_low, 2),
            "zone_mid":         round((zone_high + zone_low) / 2, 2),
            "created_date":     ev["date"],
            "status":           status,
            "invalidated_date": invalidated_date,
            "touch_count":      touch_count,
        })

    return obs


# ── Equal Highs / Equal Lows ─────────────────────────────────────────────────

def detect_equal_highs_lows(
    df: pd.DataFrame,
    atr: pd.Series,
    bars_confirm: int = 3,
    threshold_mult: float = 0.1,
    suffix: str = "_internal",
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Detect EQH and EQL using ATR-based threshold.
    Two swing points within threshold_mult * ATR of each other = equal.
    Requires at least bars_confirm separation between the two points.
    """
    sh_col = f"SwingHigh{suffix}"
    sl_col = f"SwingLow{suffix}"
    
    swing_highs_df = df[df[sh_col]][["Date", "High"]].copy()
    swing_highs_df["idx"] = swing_highs_df.index
    swing_highs = swing_highs_df.values.tolist()
    
    swing_lows_df  = df[df[sl_col]][["Date", "Low"]].copy()
    swing_lows_df["idx"] = swing_lows_df.index
    swing_lows = swing_lows_df.values.tolist()
    
    avg_atr     = float(atr.mean())
    threshold   = threshold_mult * avg_atr

    eqh, eql = [], []

    for i in range(1, len(swing_highs)):
        prev_date, prev_high, prev_idx = swing_highs[i - 1]
        curr_date, curr_high, curr_idx = swing_highs[i]
        if (curr_idx - prev_idx) >= bars_confirm:
            if abs(curr_high - prev_high) <= threshold:
                eqh.append({
                    "date":  curr_date,
                    "level": round((curr_high + prev_high) / 2, 2),
                    "type":  "EQH",
                })

    for i in range(1, len(swing_lows)):
        prev_date, prev_low, prev_idx = swing_lows[i - 1]
        curr_date, curr_low, curr_idx = swing_lows[i]
        if (curr_idx - prev_idx) >= bars_confirm:
            if abs(curr_low - prev_low) <= threshold:
                eql.append({
                    "date":  curr_date,
                    "level": round((curr_low + prev_low) / 2, 2),
                    "type":  "EQL",
                })

    return {"equal_highs": eqh, "equal_lows": eql}


# ── Premium / Discount / Equilibrium ────────────────────────────────────────

def compute_premium_discount(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Based on the most recent swing range (trailing swing top & bottom from structure).
    Premium Zone:    top 25%
    Equilibrium:     middle 50%
    Discount Zone:   bottom 25%
    """
    if df.empty:
        return {}

    # Look for confirmed swing high and swing low from SwingHigh_swing and SwingLow_swing
    # falling back to 252-bar high/low if not found
    sh_col = "SwingHigh_swing"
    sl_col = "SwingLow_swing"
    
    swing_high = None
    swing_low = None
    
    if sh_col in df.columns:
        sh_df = df[df[sh_col]]
        if not sh_df.empty:
            swing_high = float(sh_df.iloc[-1]["High"])
            
    if sl_col in df.columns:
        sl_df = df[df[sl_col]]
        if not sl_df.empty:
            swing_low = float(sl_df.iloc[-1]["Low"])
            
    if swing_high is None:
        recent = df.tail(252)
        swing_high = float(recent["High"].max()) if not recent.empty else float(df["High"].max())
        
    if swing_low is None:
        recent = df.tail(252)
        swing_low = float(recent["Low"].min()) if not recent.empty else float(df["Low"].min())
        
    rng = swing_high - swing_low
    if rng <= 0:
        rng = 1.0

    equilibrium  = (swing_high + swing_low) / 2
    premium_low  = swing_high - 0.25 * rng
    discount_high = swing_low  + 0.25 * rng

    ltp = float(df.iloc[-1]["Close"])

    if ltp >= premium_low:
        zone = "Premium"
    elif ltp <= discount_high:
        zone = "Discount"
    else:
        zone = "Equilibrium"

    return {
        "swing_high":       round(swing_high, 2),
        "swing_low":        round(swing_low, 2),
        "equilibrium":      round(equilibrium, 2),
        "premium_low":      round(premium_low, 2),
        "discount_high":    round(discount_high, 2),
        "current_zone":     zone,
        "ltp":              round(ltp, 2),
    }


# ── Liquidity Sweeps ─────────────────────────────────────────────────────────

def detect_liquidity_sweeps(
    df: pd.DataFrame,
    equal_levels: Dict[str, List[Dict[str, Any]]],
) -> List[Dict[str, Any]]:
    """
    Detect EQH / EQL sweeps — bar wicks through equal level then closes back.
    """
    sweeps = []
    eqh_levels = [e["level"] for e in equal_levels.get("equal_highs", [])]
    eql_levels = [e["level"] for e in equal_levels.get("equal_lows", [])]

    for _, row in df.iterrows():
        for lvl in eqh_levels:
            if row["High"] > lvl and row["Close"] < lvl:
                sweeps.append({
                    "date":   row["Date"],
                    "level":  lvl,
                    "type":   "EQH_Sweep",
                    "close":  float(row["Close"]),
                })
        for lvl in eql_levels:
            if row["Low"] < lvl and row["Close"] > lvl:
                sweeps.append({
                    "date":   row["Date"],
                    "level":  lvl,
                    "type":   "EQL_Sweep",
                    "close":  float(row["Close"]),
                })

    return sweeps


# ── SMC Score ────────────────────────────────────────────────────────────────

def compute_smc_score(
    active_obs: List[Dict[str, Any]],
    events: List[Dict[str, Any]],
    equal_levels: Dict[str, List[Dict[str, Any]]],
    sweeps: List[Dict[str, Any]],
    ltp: float,
    rsi: Optional[float] = None,
    volume_ratio: Optional[float] = None,
) -> int:
    """
    Composite SMC Score (0–100).

    Weights:
      Active bullish OB present         +25
      BOS event                         +20 (CHoCH = +15)
      Zone quality (touch_count <= 1)   +15
      EQL sweep (liquidity taken)       +15
      Distance to zone <= 2%            +15
      Volume confirmation (ratio > 2)   +5
      RSI in 40-65 (healthy, not overbought) +5
    """
    score = 0

    # 1. Active bullish OB
    bull_obs = [o for o in active_obs if o["direction"] == "bullish" and o["status"] == "Active"]
    if bull_obs:
        score += 25

    # 2. Most recent structure event
    if events:
        last_ev = events[-1]
        if last_ev["direction"] == "bullish":
            score += 20 if last_ev["event"] == "BOS" else 15

    # 3. Zone quality
    if bull_obs:
        best = min(bull_obs, key=lambda o: abs(ltp - o["zone_mid"]))
        if best.get("touch_count", 999) <= 1:
            score += 15

        # 4a. Distance to nearest zone
        dist = abs(ltp - best["zone_mid"]) / max(best["zone_mid"], 1) * 100
        if dist <= 2:
            score += 15
        elif dist <= 5:
            score += 8

    # 5. EQL sweep in last events
    recent_sweeps = [s for s in sweeps if s["type"] == "EQL_Sweep"]
    if recent_sweeps:
        score += 15

    # 6. Volume confirmation
    if volume_ratio and volume_ratio >= 2.0:
        score += 5

    # 7. RSI health
    if rsi and 40 <= rsi <= 65:
        score += 5

    return min(score, 100)


# ── Main Entry Point ─────────────────────────────────────────────────────────

def process_smc_zones(
    df: pd.DataFrame,
    symbol: str,
    swing_len: int = 5,
) -> List[Dict[str, Any]]:
    """
    Full SMC pipeline for one symbol.

    Returns list of zone dicts with:
      symbol, event, direction, zone_high, zone_low, status,
      created_date, invalidated_date, touch_count
    """
    if df.empty or len(df) < swing_len * 2 + 5:
        return []

    df = df.sort_values("Date").reset_index(drop=True)
    df = detect_swing_highs_lows(df, swing_len, suffix="")

    events  = detect_structure_events(df, suffix="")
    atr     = _compute_atr(df)
    obs     = extract_order_blocks(df, events, atr)

    for ob in obs:
        ob["symbol"] = symbol

    return obs


def calculate_zone_metrics(zone: dict, ltp: float) -> dict:
    """Enrich a zone dict with distance %, width %, and age."""
    zone_high = zone["zone_high"]
    zone_low  = zone["zone_low"]

    if ltp > zone_high:
        distance_pct = ((ltp - zone_high) / zone_high) * 100
    elif ltp < zone_low:
        distance_pct = ((zone_low - ltp) / zone_low) * 100
    else:
        distance_pct = 0.0  # inside zone

    width_pct = ((zone_high - zone_low) / max(zone_low, 1)) * 100

    created = zone.get("created_date")
    if created:
        if hasattr(created, "tzinfo") and created.tzinfo is not None:
            created = created.replace(tzinfo=None)
        age_days = (datetime.utcnow() - created).days
    else:
        age_days = 0

    zone["ltp"]           = ltp
    zone["distance_pct"]  = round(distance_pct, 2)
    zone["zone_width_pct"] = round(width_pct, 2)
    zone["zone_age_days"]  = age_days

    return zone


def run_full_smc_analysis(
    df: pd.DataFrame,
    symbol: str,
    swing_len: int = 5,
    rsi: Optional[float] = None,
    volume_ratio: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Full SMC analysis returning all signal types in a single dict.
    Used by the SMC service for enriched scanner results.
    """
    if df.empty or len(df) < swing_len * 2 + 5:
        return {}

    df = df.sort_values("Date").reset_index(drop=True)
    
    # 1. Swings detection for both levels
    df = detect_swing_highs_lows(df, swing_len=5, suffix="_internal")
    df = detect_swing_highs_lows(df, swing_len=50, suffix="_swing")
    
    atr = _compute_atr(df)
    
    # 2. Events detection for both levels
    internal_events = detect_structure_events(df, suffix="_internal")
    swing_events = detect_structure_events(df, suffix="_swing")
    
    # 3. Order Blocks for both levels
    internal_obs = extract_order_blocks(df, internal_events, atr)
    swing_obs = extract_order_blocks(df, swing_events, atr)
    
    # Add labels/prefix to distinguish internal vs swing OBs
    for ob in internal_obs:
        ob["symbol"] = symbol
        ob["timeframe"] = "Internal"
        
    for ob in swing_obs:
        ob["symbol"] = symbol
        ob["timeframe"] = "Swing"
        
    # 4. Equal Highs / Lows and sweeps (run on internal swing points)
    equal = detect_equal_highs_lows(df, atr, suffix="_internal")
    sweeps = detect_liquidity_sweeps(df, equal)
    
    # 5. Premium / Discount zones (uses swing_swing points dynamically)
    pd_zones = compute_premium_discount(df)
    
    ltp = float(df.iloc[-1]["Close"])
    
    # Active OBs
    active_bull_swing = [o for o in swing_obs if o["direction"] == "bullish" and o["status"] == "Active"]
    active_bear_swing = [o for o in swing_obs if o["direction"] == "bearish" and o["status"] == "Active"]
    active_bull_internal = [o for o in internal_obs if o["direction"] == "bullish" and o["status"] == "Active"]
    active_bear_internal = [o for o in internal_obs if o["direction"] == "bearish" and o["status"] == "Active"]
    
    for o in active_bull_swing + active_bear_swing + active_bull_internal + active_bear_internal:
        calculate_zone_metrics(o, ltp)

    # Nearest bullish OB (major swing preferred, fallback to internal)
    nearest_bull = None
    if active_bull_swing:
        nearest_bull = min(active_bull_swing, key=lambda o: abs(ltp - o.get("zone_mid", ltp)))
    elif active_bull_internal:
        nearest_bull = min(active_bull_internal, key=lambda o: abs(ltp - o.get("zone_mid", ltp)))

    # Compute SMC score using swing_obs/swing_events (as major signals)
    score = compute_smc_score(
        active_obs=swing_obs,
        events=swing_events,
        equal_levels=equal,
        sweeps=sweeps,
        ltp=ltp,
        rsi=rsi,
        volume_ratio=volume_ratio,
    )

    # Recent structure label (default to Swing structure, fallback to internal)
    bullish_events = [e for e in swing_events if e["direction"] == "bullish"]
    last_bull_ev   = bullish_events[-1] if bullish_events else None
    
    if not last_bull_ev:
        bullish_events_internal = [e for e in internal_events if e["direction"] == "bullish"]
        last_bull_ev = bullish_events_internal[-1] if bullish_events_internal else None

    return {
        "symbol":              symbol,
        "ltp":                 round(ltp, 2),
        "smc_score":           score,
        "structure": {
            "last_bullish_event": last_bull_ev["event"] if last_bull_ev else None,
            "last_bullish_date":  last_bull_ev["date"] if last_bull_ev else None,
            "total_bos":          sum(1 for e in swing_events if e["event"] == "BOS"),
            "total_choch":        sum(1 for e in swing_events if e["event"] == "CHoCH"),
        },
        "internal_structure": {
            "last_bullish_event": (internal_events[-1]["event"] if internal_events else None),
            "last_bullish_date":  (internal_events[-1]["date"] if internal_events else None),
            "total_bos":          sum(1 for e in internal_events if e["event"] == "BOS"),
            "total_choch":        sum(1 for e in internal_events if e["event"] == "CHoCH"),
        },
        "demand_zones":        active_bull_swing,
        "supply_zones":        active_bear_swing,
        "internal_demand_zones": active_bull_internal,
        "internal_supply_zones": active_bear_internal,
        "nearest_demand":      nearest_bull,
        "equal_levels":        equal,
        "liquidity_sweeps":    sweeps[-5:],  # most recent 5
        "premium_discount":    pd_zones,
        "current_zone":        pd_zones.get("current_zone", "Unknown"),
    }
