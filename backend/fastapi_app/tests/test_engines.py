"""
Scanner engine tests — pure logic, no Mongo / no network / no LLM.

Covers the Indicator, Pattern, Ranking, and Strategy engines that the LaunchPad
and Alpha Zone scanners are built on. These lock in the behaviour that replaced
the previous fabricated (ASCII-derived / hardcoded) strategy values.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from engines.indicators import ema, rsi, atr, IndicatorEngine
from engines.patterns import detect_bullish_fvgs, classify_continuation
from engines.patterns.fvg import FVG
from engines.ranking import score_launchpad, strength_label
from engines.strategies.base import TradePlan
from engines.strategies.launchpad import build_launchpad_result
from engines.strategies.alpha_zone import build_alphazone_result, score_confidence
from engines.strategies.alpha_zone_ob import (
    AlphaZoneOB,
    detect_internal_bullish_obs,
    nearest_reacting_ob,
)


# ── Indicator Engine ────────────────────────────────────────────────────────────
def test_ema_matches_pandas_ewm():
    s = pd.Series([float(i) for i in range(1, 60)])
    got = ema(s, 10)
    expected = s.ewm(span=10, adjust=False).mean()
    assert np.allclose(got.values, expected.values)


def test_rsi_bounds_and_uptrend_high():
    up = pd.Series([100 + i for i in range(40)])  # strictly rising → RSI near 100
    r = rsi(up, 14).iloc[-1]
    assert 0 <= r <= 100 and r > 90


def _synthetic_ohlc(n=260, start=100.0, step=0.5):
    close = pd.Series([start + i * step for i in range(n)])
    return pd.DataFrame({
        "Date": pd.date_range("2023-01-01", periods=n, freq="D"),
        "Open": close - 0.2, "High": close + 0.5, "Low": close - 0.5,
        "Close": close, "Volume": [100000] * n,
    })


def test_indicator_engine_full_set():
    df = _synthetic_ohlc()
    ind = IndicatorEngine.compute(df)
    assert ind.price is not None
    assert ind.ema_200 is not None and ind.ema_50 is not None
    assert ind.ema_200_dist_pct > 0        # uptrend → price above EMA200
    assert ind.atr_14 is not None and ind.atr_14 > 0


# ── Pattern Engine ──────────────────────────────────────────────────────────────
def test_detect_bullish_fvg_on_gap():
    # C1 high=100, C3 low=103 → clean bullish gap [100,103]
    df = pd.DataFrame({
        "Date": pd.date_range("2024-01-01", periods=4, freq="D"),
        "Open": [98, 101, 104, 106], "High": [100, 106, 108, 109],
        "Low": [97, 101, 103, 105], "Close": [99, 105, 107, 106],
        "Volume": [1, 1, 1, 1],
    })
    fvgs = detect_bullish_fvgs(df)
    assert len(fvgs) >= 1
    f = fvgs[0]
    assert f.low == 100 and f.high == 103
    assert round(f.spec_gap_pct, 2) == 3.0  # (103-100)/100*100


def test_classify_continuation_states():
    f = FVG(low=100, high=103, gap_pct=3, age_days=2, start_date="", end_date="", is_active=True)
    assert classify_continuation(f, 104, max_distance_pct=3.0) == "at_support"   # 0.97% above
    assert classify_continuation(f, 110, max_distance_pct=3.0) == "extended"     # 6.8% above
    assert classify_continuation(f, 101.5, max_distance_pct=3.0) == "inside"
    assert classify_continuation(f, 95, max_distance_pct=3.0) == "below"


# ── Ranking Engine ──────────────────────────────────────────────────────────────
def test_score_launchpad_is_bounded_and_explainable():
    # price defending the very top of a 3% gap, fresh, healthy trend → near-perfect
    conf, breakdown = score_launchpad(
        price=103.0, fvg_low=100.0, fvg_high=103.0,
        gap_pct=3.0, ema200_dist_pct=6.0, age_days=2,
    )
    assert 0 <= conf <= 100
    assert set(breakdown) == {"proximity", "gap_quality", "trend", "freshness"}
    assert "rsi" not in breakdown            # RSI removed from LaunchPad
    assert breakdown["proximity"] == 100.0   # price at the gap top = best proximity
    assert conf > 80  # near-perfect setup should score high


def test_score_launchpad_proximity_shape():
    # near HIGH > MIDDLE > near LOW; decays above the top; 0 beyond +2%
    at_high, _ = score_launchpad(price=103.0, fvg_low=100.0, fvg_high=103.0,
                                 gap_pct=3.0, ema200_dist_pct=5.0, age_days=2)
    at_mid, _ = score_launchpad(price=101.5, fvg_low=100.0, fvg_high=103.0,
                                gap_pct=3.0, ema200_dist_pct=5.0, age_days=2)
    at_low, _ = score_launchpad(price=100.0, fvg_low=100.0, fvg_high=103.0,
                                gap_pct=3.0, ema200_dist_pct=5.0, age_days=2)
    assert at_high > at_mid > at_low


def test_strength_labels():
    assert strength_label(80) == "Strong"
    assert strength_label(60) == "Medium"
    assert strength_label(40) == "Weak"


# ── TradePlan (real, derived) ───────────────────────────────────────────────────
def test_tradeplan_from_support_uses_atr_and_reward_multiple():
    tp = TradePlan.from_support(entry=100.0, support_level=96.0, atr=2.0, reward_multiple=2.0)
    # stop = 96 - 0.25*2 = 95.5 → risk 4.5, reward 9.0, target 109
    assert tp.stop_loss == 95.5
    assert tp.risk_reward == 2.0
    assert tp.target == 109.0
    assert tp.risk_pct == 4.5


def test_tradeplan_widens_implausibly_tight_stop():
    # support just below entry → risk < 0.5*ATR → widened to 1.5*ATR
    tp = TradePlan.from_support(entry=100.0, support_level=99.9, atr=2.0, reward_multiple=2.0)
    assert tp.stop_loss == 97.0  # 100 - 1.5*2
    assert tp.risk_per_share == 3.0


def test_tradeplan_atr_fallback_when_missing():
    tp = TradePlan.from_support(entry=100.0, support_level=96.0, atr=None, reward_multiple=2.0)
    assert tp.stop_loss < 96.0 and tp.risk_reward == 2.0  # uses 2% fallback, still valid


# ── LaunchPad strategy (shared derivation) ──────────────────────────────────────
def _lp(**over):
    base = dict(
        symbol="TEST", company_name="Test Co", price=104.0, ema_200=100.0,
        ema_200_dist_pct=4.0, fvg_low=100.0, fvg_high=103.0, age_days=2,
        atr=2.0, fvg_date="2026-07-08",
    )
    base.update(over)
    return build_launchpad_result(**base)


def test_launchpad_accepts_valid_continuation():
    r = _lp()  # price 104 = 0.97% above the gap top → continuation
    assert r is not None
    assert r.strategy == "launchpad"
    assert r.metrics["setup"] == "continuation"
    assert r.trade.risk_reward == 2.0
    assert 0 < r.confidence <= 100


def test_launchpad_accepts_price_inside_gap():
    r = _lp(price=101.5)  # inside the gap now = accumulation, accepted
    assert r is not None
    assert r.metrics["setup"] == "accumulation"


def test_launchpad_rejects_below_min_price():
    # same clean setup but scaled under ₹100 → rejected by the price filter
    assert _lp(price=99.0, fvg_low=95.0, fvg_high=98.0, ema_200=96.0) is None


def test_launchpad_rejects_out_of_ema_band():
    assert _lp(ema_200_dist_pct=25.0) is None   # > +20%
    assert _lp(ema_200_dist_pct=-15.0) is None  # < -10%


def test_launchpad_rejects_tiny_gap():
    assert _lp(fvg_low=102.9, fvg_high=103.0) is None  # gap < 0.5%


def test_launchpad_rejects_price_out_of_location_band():
    # price ≥ ₹100 but below the FVG floor (support broken) → rejected on location
    assert _lp(price=100.5, fvg_low=101.0, fvg_high=104.0) is None
    assert _lp(price=106.0) is None   # 2.9% above the top → beyond the +2% overshoot
    assert _lp(price=130.0) is None   # extended far above


# ── Alpha Zone strategy ─────────────────────────────────────────────────────────
def _ob(**over):
    base = dict(
        zone_low=95.0, zone_high=100.0, ob_idx=20, break_idx=30, event="CHoCH",
        start_date="2026-06-01", formed_date="2026-06-15", age_days=10,
        touch_count=0, institutional_score=80.0,
        inst_breakdown={"disp": 90, "vol": 80, "spr": 70, "base": 60, "obq": 50},
    )
    base.update(over)
    return AlphaZoneOB(**base)


def test_alphazone_builds_real_values():
    # price 100.5 = 0.5% above the zone top (95-100) → Above Zone, entry at the top
    r = build_alphazone_result(symbol="X", company_name="X Co", ltp=100.5,
                               ob=_ob(), ema200_dist_pct=5.0, atr=2.0)
    assert r is not None
    assert r["entry"] == 100.0 and r["stop_loss"] < 95.0
    assert r["projected_return"] > 0
    assert r["risk_reward"] == "1:3.0"            # Alpha Zone reward multiple
    assert r["zone_status"] == "Above Zone"
    assert set(r["score_breakdown"]) == {"institutional", "proximity", "freshness", "trend"}
    assert "rsi" not in r["score_breakdown"]      # RSI is not used
    assert "ord(" not in str(r)                   # no ASCII fabrication


def test_alphazone_in_zone_uses_cmp_entry():
    r = build_alphazone_result(symbol="X", company_name="X", ltp=97.0,
                               ob=_ob(), ema200_dist_pct=5.0, atr=2.0)
    assert r is not None and r["zone_status"] == "In Zone" and r["entry"] == 97.0
    assert r["distance_pct"] == 0.0


def test_alphazone_confidence_rewards_fresh_close_zones():
    fresh, bd = score_confidence(institutional_score=80, distance_pct=0.0,
                                 touch_count=0, ema200_dist_pct=5.0)
    retested_far, _ = score_confidence(institutional_score=80, distance_pct=2.5,
                                       touch_count=2, ema200_dist_pct=5.0)
    assert 0 <= fresh <= 100 and fresh > retested_far
    assert "rsi" not in bd


def test_alphazone_rejects_invalid_zone():
    assert build_alphazone_result(symbol="X", company_name="X", ltp=10,
                                  ob=_ob(zone_low=8.0, zone_high=5.0),
                                  ema200_dist_pct=0.0, atr=1.0) is None


def test_alphazone_rejects_price_too_far_above_zone():
    # 5% above the zone top → beyond the 3% near band → no signal
    assert build_alphazone_result(symbol="X", company_name="X", ltp=105.0,
                                  ob=_ob(), ema200_dist_pct=5.0, atr=2.0) is None


# ── Alpha Zone OB detector (direct OHLCV) ───────────────────────────────────────
def _az_synth():
    """Synthetic OHLCV with a clear internal bullish structure: peak → trough
    (demand origin) → rally that closes above the prior swing high."""
    up1 = np.linspace(90, 110, 11)            # rise to a swing high
    down = np.linspace(110, 95, 11)[1:]       # fall to a swing low (demand origin)
    up2 = np.linspace(95, 122, 16)[1:]        # rally back up through the prior high
    close = np.concatenate([up1, down, up2])
    n = len(close)
    df = pd.DataFrame({
        "Date": pd.date_range("2026-01-01", periods=n, freq="D"),
        "Open": close - 0.2, "High": close + 0.8, "Low": close - 0.8,
        "Close": close, "Volume": [100000] * n,
    })
    return df


def _append(df, close, low, high):
    nxt = pd.DataFrame([{
        "Date": df["Date"].iloc[-1] + pd.Timedelta(days=1),
        "Open": close, "High": high, "Low": low, "Close": close, "Volume": 100000,
    }])
    return pd.concat([df, nxt], ignore_index=True)


def test_alphazone_ob_detects_bullish_block():
    obs = detect_internal_bullish_obs(_az_synth())
    assert len(obs) >= 1
    z = obs[0]
    assert z.zone_high > z.zone_low
    assert 0 <= z.institutional_score <= 100
    assert z.zone_low < 100  # origin is the trough, well below the breakout


def test_alphazone_ob_close_below_floor_invalidates_but_wick_survives():
    df = _az_synth()
    z = detect_internal_bullish_obs(df)[0]
    floor = z.zone_low

    # A candle that only WICKS below the floor (closes back above) → still valid.
    wick = detect_internal_bullish_obs(_append(df, close=floor + 3, low=floor - 2, high=floor + 4))
    assert any(abs(o.zone_low - floor) < 1e-6 for o in wick)

    # A candle that CLOSES below the floor → that zone is invalidated (gone).
    closed = detect_internal_bullish_obs(_append(df, close=floor - 2, low=floor - 3, high=floor + 1))
    assert all(abs(o.zone_low - floor) > 1e-6 for o in closed)
