"""
FinAI Edge — Volume Surge Scanner
====================================
Per-surge historical analysis with full forward-return statistics.

For every historical volume surge event stores:
  surge_date, surge_price, volume_ratio, day_return
  return_1d, return_2d, return_3d, return_5d, return_10d, return_20d
  max_gain_after_surge, max_drawdown_after_surge

Aggregates:
  avg_1d … avg_20d
  win_rate_1d … win_rate_20d
  max_gain, max_drawdown
"""

import math
import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional

VOLUME_RATIO_THRESHOLD = 2.5   # surge = today vol > 2.5x 20d avg
FORWARD_WINDOWS = [1, 2, 3, 5, 10, 20]


def _safe(v) -> Optional[float]:
    try:
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else round(f, 2)
    except Exception:
        return None


def detect_volume_surges(
    df: pd.DataFrame,
    symbol: str,
    company_name: str = "",
    volume_ratio_threshold: float = VOLUME_RATIO_THRESHOLD,
) -> Dict[str, Any]:
    """
    Full volume surge analysis for one symbol.

    Returns:
      symbol, company_name, ltp, has_current_surge, current_volume_ratio,
      surge_history (list of per-surge dicts),
      surge_stats (aggregate stats across all surges)
    """
    df = df.sort_values("Date").reset_index(drop=True)

    if len(df) < 25:
        return {}

    # 20-day average volume (rolling, shifted to avoid lookahead)
    df["avg_vol_20d"] = df["Volume"].rolling(20, min_periods=5).mean().shift(1)
    df["volume_ratio"] = df["Volume"] / df["avg_vol_20d"].replace(0, np.nan)

    # Identify surge days
    surge_mask = df["volume_ratio"] >= volume_ratio_threshold
    surge_df   = df[surge_mask].copy()

    ltp = float(df.iloc[-1]["Close"])
    last_date = df.iloc[-1]["Date"]

    # Check if the most recent day is a surge
    has_current_surge  = False
    current_vol_ratio  = None
    if not df.empty:
        last_row = df.iloc[-1]
        cr = _safe(last_row.get("volume_ratio"))
        if cr and cr >= volume_ratio_threshold:
            has_current_surge = True
            current_vol_ratio = cr

    # Per-surge forward returns
    surge_history: List[Dict[str, Any]] = []

    for idx, surge_row in surge_df.iterrows():
        surge_date  = surge_row["Date"]
        surge_price = _safe(surge_row["Close"])
        vol_ratio   = _safe(surge_row["volume_ratio"])
        day_open    = _safe(surge_row["Open"])
        day_return  = _safe((surge_row["Close"] - surge_row["Open"]) / max(surge_row["Open"], 0.01) * 100)

        if surge_price is None or surge_price <= 0:
            continue

        # Forward returns: price at close of N days after surge
        future_df = df.iloc[idx + 1:].reset_index(drop=True)

        fwd_returns: Dict[str, Optional[float]] = {}
        for w in FORWARD_WINDOWS:
            if len(future_df) >= w:
                fwd_price = float(future_df.iloc[w - 1]["Close"])
                fwd_returns[f"return_{w}d"] = _safe((fwd_price - surge_price) / surge_price * 100)
            else:
                fwd_returns[f"return_{w}d"] = None

        # Max gain and max drawdown after surge (over next 20 bars)
        horizon_df = future_df.iloc[:20]
        if not horizon_df.empty:
            max_close   = float(horizon_df["High"].max())
            min_close   = float(horizon_df["Low"].min())
            max_gain    = _safe((max_close - surge_price) / surge_price * 100)
            max_drawdown = _safe((min_close - surge_price) / surge_price * 100)
        else:
            max_gain    = None
            max_drawdown = None

        surge_history.append({
            "surge_date":        surge_date.strftime("%Y-%m-%d") if hasattr(surge_date, "strftime") else str(surge_date),
            "surge_price":       surge_price,
            "volume_ratio":      vol_ratio,
            "day_return_pct":    day_return,
            "return_1d":         fwd_returns.get("return_1d"),
            "return_2d":         fwd_returns.get("return_2d"),
            "return_3d":         fwd_returns.get("return_3d"),
            "return_5d":         fwd_returns.get("return_5d"),
            "return_10d":        fwd_returns.get("return_10d"),
            "return_20d":        fwd_returns.get("return_20d"),
            "max_gain_pct":      max_gain,
            "max_drawdown_pct":  max_drawdown,
        })

    # ── Aggregate stats ───────────────────────────────────────────────────
    def _avg(key: str) -> Optional[float]:
        vals = [s[key] for s in surge_history if s.get(key) is not None]
        return _safe(sum(vals) / len(vals)) if vals else None

    def _win_rate(key: str) -> Optional[float]:
        vals = [s[key] for s in surge_history if s.get(key) is not None]
        if not vals:
            return None
        wins = sum(1 for v in vals if v > 0)
        return _safe(wins / len(vals) * 100)

    surge_stats = {
        "total_surges":     len(surge_history),
        "avg_1d_return":    _avg("return_1d"),
        "avg_2d_return":    _avg("return_2d"),
        "avg_3d_return":    _avg("return_3d"),
        "avg_5d_return":    _avg("return_5d"),
        "avg_10d_return":   _avg("return_10d"),
        "avg_20d_return":   _avg("return_20d"),
        "win_rate_1d":      _win_rate("return_1d"),
        "win_rate_2d":      _win_rate("return_2d"),
        "win_rate_5d":      _win_rate("return_5d"),
        "win_rate_10d":     _win_rate("return_10d"),
        "win_rate_20d":     _win_rate("return_20d"),
        "max_gain_ever":    _safe(max((s["max_gain_pct"] for s in surge_history if s["max_gain_pct"] is not None), default=0)),
        "max_drawdown_ever": _safe(min((s["max_drawdown_pct"] for s in surge_history if s["max_drawdown_pct"] is not None), default=0)),
    }

    return {
        "symbol":               symbol,
        "company_name":         company_name,
        "ltp":                  round(ltp, 2),
        "has_current_surge":    has_current_surge,
        "current_volume_ratio": current_vol_ratio,
        "surge_history":        surge_history,
        "surge_stats":          surge_stats,
    }
