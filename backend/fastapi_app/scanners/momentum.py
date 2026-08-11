"""
FinAI Edge — Momentum Scanner
================================
Composite Momentum Score (0–100) with full category classification.

Factors:
  RSI strength
  Relative strength vs Nifty50
  Price vs EMA50 / EMA200
  Volume expansion
  Breakout strength
  Distance from 52-week high
"""

import math
from typing import Any


def _safe(v) -> float | None:
    try:
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else round(f, 4)
    except Exception:
        return None


def compute_momentum_score(
    rsi: float | None = None,
    ema_50_dist_pct: float | None = None,
    ema_200_dist_pct: float | None = None,
    volume_ratio: float | None = None,
    week52_high_dist_pct: float | None = None,
    relative_strength: float | None = None,
    macd_hist: float | None = None,
) -> int:
    """
    Momentum Score (0–100):

    RSI strength            (25 pts)
    Price vs EMAs           (25 pts)
    Volume expansion        (15 pts)
    52W High proximity      (15 pts)
    Relative strength       (10 pts)
    MACD histogram          (10 pts)
    """
    score = 0

    # 1. RSI (25 pts)
    if rsi is not None:
        if rsi >= 60:
            score += 25
        elif rsi >= 55:
            score += 20
        elif rsi >= 50:
            score += 14
        elif rsi >= 45:
            score += 8
        elif rsi >= 40:
            score += 4

    # 2. EMA alignment (25 pts)
    ema50_ok = ema_50_dist_pct is not None and ema_50_dist_pct > 0
    ema200_ok = ema_200_dist_pct is not None and ema_200_dist_pct > 0

    if ema50_ok and ema200_ok:
        bonus = 0
        if ema_50_dist_pct > 5:
            bonus += 5
        if ema_200_dist_pct > 10:
            bonus += 5
        score += 15 + bonus
    elif ema50_ok:
        score += 10
    elif ema200_ok:
        score += 8

    # 3. Volume expansion (15 pts)
    if volume_ratio is not None:
        if volume_ratio >= 3.0:
            score += 15
        elif volume_ratio >= 2.0:
            score += 10
        elif volume_ratio >= 1.5:
            score += 6

    # 4. 52-week high proximity (15 pts)
    # week52_high_dist_pct = (ltp - 52w_high) / 52w_high * 100 (negative = below, 0 = at high)
    if week52_high_dist_pct is not None:
        if week52_high_dist_pct >= -2:
            score += 15  # At or near 52W high
        elif week52_high_dist_pct >= -5:
            score += 10
        elif week52_high_dist_pct >= -10:
            score += 5

    # 5. Relative strength vs Nifty50 (10 pts)
    if relative_strength is not None:
        if relative_strength > 5:
            score += 10
        elif relative_strength > 2:
            score += 6
        elif relative_strength > 0:
            score += 3

    # 6. MACD histogram (10 pts)
    if macd_hist is not None:
        if macd_hist > 0:
            score += 10
        elif macd_hist > -0.5:
            score += 4

    return min(score, 100)


def get_momentum_category(score: int) -> str:
    if score >= 80:
        return "Strong Momentum"
    if score >= 65:
        return "Emerging Momentum"
    if score >= 50:
        return "Breakout Candidate"
    if score >= 35:
        return "Watch"
    return "Weak"


def build_momentum_record(
    symbol: str,
    ltp: float,
    company_name: str = "",
    rsi: float | None = None,
    ema_50: float | None = None,
    ema_200: float | None = None,
    ema_50_dist_pct: float | None = None,
    ema_200_dist_pct: float | None = None,
    volume: float | None = None,
    avg_volume_20d: float | None = None,
    week52_high: float | None = None,
    week52_low: float | None = None,
    nifty_return_1m: float | None = None,
    stock_return_1m: float | None = None,
    macd_hist: float | None = None,
) -> dict[str, Any]:
    """
    Build a full momentum record for storage in MongoDB.
    """
    # Volume ratio
    volume_ratio = None
    if volume and avg_volume_20d and avg_volume_20d > 0:
        volume_ratio = round(volume / avg_volume_20d, 2)

    # 52W high distance %
    week52_high_dist = None
    if week52_high and week52_high > 0 and ltp:
        week52_high_dist = round((ltp - week52_high) / week52_high * 100, 2)

    # Relative strength
    relative_strength = None
    if stock_return_1m is not None and nifty_return_1m is not None:
        relative_strength = round(stock_return_1m - nifty_return_1m, 2)

    score = compute_momentum_score(
        rsi=rsi,
        ema_50_dist_pct=ema_50_dist_pct,
        ema_200_dist_pct=ema_200_dist_pct,
        volume_ratio=volume_ratio,
        week52_high_dist_pct=week52_high_dist,
        relative_strength=relative_strength,
        macd_hist=macd_hist,
    )
    category = get_momentum_category(score)

    return {
        "symbol": symbol,
        "company_name": company_name,
        "ltp": round(ltp, 2),
        "momentum_score": score,
        "category": category,
        "rsi": _safe(rsi),
        "ema_50": _safe(ema_50),
        "ema_200": _safe(ema_200),
        "ema_50_dist_pct": _safe(ema_50_dist_pct),
        "ema_200_dist_pct": _safe(ema_200_dist_pct),
        "volume": volume,
        "avg_volume_20d": avg_volume_20d,
        "volume_ratio": volume_ratio,
        "week52_high": _safe(week52_high),
        "week52_low": _safe(week52_low),
        "week52_high_dist_pct": _safe(week52_high_dist),
        "relative_strength": _safe(relative_strength),
        "macd_hist": _safe(macd_hist),
        "above_ema50": ema_50_dist_pct > 0 if ema_50_dist_pct is not None else None,
        "above_ema200": ema_200_dist_pct > 0 if ema_200_dist_pct is not None else None,
    }
