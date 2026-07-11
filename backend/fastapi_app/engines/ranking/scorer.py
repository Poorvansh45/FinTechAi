"""
Ranking Engine — transparent confidence scoring.

Every confidence number is a weighted sum of named 0-100 sub-scores, each with
a clear rationale, so the UI can show *why* a setup scores what it does. This
replaces the previous ad-hoc `80 + (5-dist)*2 + (rsi-50)*0.2` and ASCII-derived
values, which were neither meaningful nor explainable.
"""

from __future__ import annotations

from typing import Optional


def _clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))


def _proximity_score(
    price: float, fvg_low: float, fvg_high: float, overshoot_pct: float = 2.0
) -> float:
    """
    LaunchPad accumulation/continuation proximity.

    Acceptance band (enforced by the strategy): FVG_low ≤ price ≤ FVG_high·(1+ov).
    Within that band the score is shaped as:

      • INSIDE the gap  (fvg_low ≤ price ≤ fvg_high):
            f = (price − low) / (high − low)          # 0 at floor → 1 at top
            score = 60 + 40·f
        → near the HIGH (f→1) = 100  (best: price defending the top of the gap)
        → MIDDLE       (f=0.5) = 80
        → near the LOW  (f→0)  = 60  (deep in the gap, weaker but still valid)

      • ABOVE the top, within the overshoot band (fvg_high < price ≤ fvg_high·(1+ov)):
            o = (price − high) / high · 100           # % above the top, 0…overshoot
            score = 100 − 50·(o / overshoot_pct)
        → smooth decay 100 → 50 as price stretches from the top out to +overshoot%.

    Both branches meet at 100 when price == fvg_high (continuous, no jump).
    Anything outside the band is rejected upstream, so it never reaches here;
    defensively we return 0 for those.
    """
    if fvg_high <= fvg_low or price < fvg_low:
        return 0.0
    if price <= fvg_high:  # inside the gap
        f = (price - fvg_low) / (fvg_high - fvg_low)
        return _clamp(60.0 + 40.0 * f)
    # above the top, within the overshoot band
    o = (price - fvg_high) / fvg_high * 100.0
    if o > overshoot_pct:
        return 0.0
    return _clamp(100.0 - 50.0 * (o / overshoot_pct))


def _gap_quality_score(gap_pct: float) -> float:
    """
    Bigger displacement = stronger imbalance, with diminishing returns.
    0.5% → ~25, 2% → 100, capped (very wide gaps aren't proportionally better).
    """
    return _clamp(gap_pct / 2.0 * 100.0)


def _trend_score(ema200_dist_pct: Optional[float]) -> float:
    """
    Reward a healthy uptrend without chasing over-extension. Peaks around
    +5-10% above EMA200; lower near/below the EMA and when very extended.
    """
    if ema200_dist_pct is None:
        return 50.0
    d = ema200_dist_pct
    if d < -10:
        return 20.0
    if d <= 10:
        # ramp from 55 (at -10) up to 100 (around +7.5)
        return _clamp(55.0 + (d + 10) * 2.5) if d <= 7.5 else 100.0
    # extended: decay from 100 (at +10) toward ~60 (at +20)
    return _clamp(100.0 - (d - 10) * 4.0, lo=55.0)


def _freshness_score(age_days: int, max_age: int = 30) -> float:
    """Younger gaps are stronger for a 5-7 day swing. age 0 → 100, ≥max_age → ~20."""
    return _clamp(100.0 - (age_days / max_age) * 80.0, lo=20.0)


# Weights sum to 1.0. LaunchPad no longer uses RSI (removed). Proximity dominates
# (it defines where price sits in/around the gap), trend & freshness refine it,
# and gap quality is a lighter confirmation.
_WEIGHTS = {
    "proximity": 0.40,
    "trend": 0.25,
    "freshness": 0.20,
    "gap_quality": 0.15,
}


def score_launchpad(
    *,
    price: float,
    fvg_low: float,
    fvg_high: float,
    gap_pct: float,
    ema200_dist_pct: Optional[float],
    age_days: int,
    overshoot_pct: float = 2.0,
) -> tuple[float, dict]:
    """Return (confidence 0-100, breakdown of named sub-scores).

    Confidence = 0.40·Proximity + 0.25·Trend + 0.20·Freshness + 0.15·GapQuality.
    (RSI has been removed from the LaunchPad model.)
    """
    subs = {
        "proximity": round(_proximity_score(price, fvg_low, fvg_high, overshoot_pct), 1),
        "trend": round(_trend_score(ema200_dist_pct), 1),
        "freshness": round(_freshness_score(age_days), 1),
        "gap_quality": round(_gap_quality_score(gap_pct), 1),
    }
    confidence = sum(subs[k] * _WEIGHTS[k] for k in _WEIGHTS)
    return round(_clamp(confidence), 1), subs


def strength_label(confidence: float) -> str:
    if confidence >= 75:
        return "Strong"
    if confidence >= 55:
        return "Medium"
    return "Weak"
