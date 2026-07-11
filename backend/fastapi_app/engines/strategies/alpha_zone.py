"""
Alpha Zone — institutional accumulation strategy (2-8 week hold).

Signals when price REVISITS a valid Internal Bullish Order Block (demand zone)
detected by the dedicated `alpha_zone_ob` engine. Every value is derived from
real price structure:

  • Institutional Score (from the OB detector) — how likely institutions
    accumulated at the zone (displacement / volume / spread / base / origin).
  • Confidence — explainable blend of Institutional, Proximity, Freshness and
    Trend (NO RSI).
  • ATR-based trade plan — entry at the zone (or its top on a retest), stop below
    the zone floor, target at a 3.0 reward multiple.
"""

from __future__ import annotations

from typing import Optional

from .base import TradePlan
from .alpha_zone_ob import AlphaZoneOB, ABOVE_MAX_PCT, NEAR_MAX_PCT

ALPHAZONE_REWARD_MULTIPLE = 3.0     # institutional swings target larger moves
HOLDING_PERIOD = "2-8 weeks"
DAILY_PROGRESS_PCT = 0.8            # ~0.8%/day assumed swing pace toward target

# Confidence weights (sum = 1.0). No RSI.
_CONF_WEIGHTS = {"institutional": 0.40, "proximity": 0.25, "freshness": 0.20, "trend": 0.15}


def _clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))


def _proximity_score(distance_pct: float) -> float:
    """In Zone (0%) = best; decays through the +1.5% and +3% bands to 0."""
    d = distance_pct
    if d <= 0:
        return 100.0
    if d <= ABOVE_MAX_PCT:
        return _clamp(100.0 - (d / ABOVE_MAX_PCT) * 30.0)          # 100 → 70
    if d <= NEAR_MAX_PCT:
        return _clamp(70.0 - ((d - ABOVE_MAX_PCT) / (NEAR_MAX_PCT - ABOVE_MAX_PCT)) * 40.0)  # 70 → 30
    return 0.0


def _freshness_score(touch_count: int) -> float:
    return {0: 100.0, 1: 70.0, 2: 45.0}.get(touch_count or 0, 25.0)


def _trend_score(ema200_dist_pct: Optional[float]) -> float:
    """Reward demand revisits inside a constructive trend, across the wide band."""
    if ema200_dist_pct is None:
        return 60.0
    d = ema200_dist_pct
    if 0 <= d <= 15:
        return 100.0
    if -35 <= d < 0:
        return _clamp(40.0 + (d + 35.0) / 35.0 * 60.0)   # -35 → 40, 0 → 100
    if 15 < d <= 40:
        return _clamp(100.0 - (d - 15.0) / 25.0 * 45.0)  # 15 → 100, 40 → 55
    return 40.0


def score_confidence(
    institutional_score: float, distance_pct: float, touch_count: int,
    ema200_dist_pct: Optional[float],
) -> tuple[float, dict]:
    """Explainable Alpha Zone confidence (0-100) + named sub-scores. No RSI."""
    subs = {
        "institutional": round(_clamp(float(institutional_score or 0.0)), 1),
        "proximity": round(_proximity_score(distance_pct), 1),
        "freshness": round(_freshness_score(touch_count), 1),
        "trend": round(_trend_score(ema200_dist_pct), 1),
    }
    conf = sum(subs[k] * _CONF_WEIGHTS[k] for k in _CONF_WEIGHTS)
    return round(_clamp(conf), 1), subs


def build_alphazone_result(
    *,
    symbol: str,
    company_name: str,
    ltp: float,
    ob: AlphaZoneOB,
    ema200_dist_pct: Optional[float],
    atr: Optional[float] = None,
) -> Optional[dict]:
    """Derive a real Alpha Zone row from a valid OB price is reacting to."""
    zl, zh = ob.zone_low, ob.zone_high
    if not zh or not zl or zh <= zl or ltp is None or ltp <= 0:
        return None

    # Location category + entry (CMP if in the zone, else the zone top on a retest).
    if zl <= ltp <= zh:
        zone_status, distance_pct, entry = "In Zone", 0.0, float(ltp)
    elif ltp <= zh * (1.0 + ABOVE_MAX_PCT / 100.0):
        zone_status, distance_pct, entry = "Above Zone", (ltp - zh) / zh * 100.0, float(zh)
    elif ltp <= zh * (1.0 + NEAR_MAX_PCT / 100.0):
        zone_status, distance_pct, entry = "Near Zone", (ltp - zh) / zh * 100.0, float(zh)
    else:
        return None  # too far above (detector normally filters this already)

    trade = TradePlan.from_support(
        entry=entry, support_level=float(zl), atr=atr,
        reward_multiple=ALPHAZONE_REWARD_MULTIPLE,
    )
    projected_return = round(trade.reward_per_share / entry * 100.0, 1) if entry else 0.0

    conf, breakdown = score_confidence(
        ob.institutional_score, distance_pct, ob.touch_count, ema200_dist_pct
    )
    zone_type = "Fresh" if ob.touch_count == 0 else (
        "Retested Once" if ob.touch_count == 1 else "Retested")
    zone_strength = "Strong" if conf >= 75 else ("Medium" if conf >= 55 else "Weak")
    expected_holding = int(_clamp(round(projected_return / DAILY_PROGRESS_PCT), 14, 60))

    return {
        "symbol": symbol,
        "company_name": company_name or symbol,
        "strategy": "alpha_zone",
        "ltp": round(float(ltp), 2),
        "institutional_score": int(round(conf)),   # headline = confidence composite
        "score_breakdown": breakdown,              # incl. the "institutional" sub-bar
        "origin_score": ob.institutional_score,    # §6 origin quality (context)
        "origin_breakdown": ob.inst_breakdown,
        "zone_status": zone_status,
        "zone_type": zone_type,
        "zone_strength": zone_strength,
        "distance_pct": round(float(distance_pct), 2),
        "projected_return": projected_return,
        "expected_holding": expected_holding,
        "holding_period": HOLDING_PERIOD,
        "entry": trade.entry,
        "stop_loss": trade.stop_loss,
        "target": trade.target,
        "risk_reward": f"1:{trade.risk_reward}",
        "risk_pct": trade.risk_pct,
        "zone_low": round(float(zl), 2),
        "zone_high": round(float(zh), 2),
        "days_since_formation": ob.age_days,
        "zone_date": ob.formed_date,
    }
