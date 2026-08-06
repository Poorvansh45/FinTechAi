"""
Unit tests for the IPO Vintage strategy (engines/strategies/ipo_vintage.py).

Pure/offline — synthetic OHLCV frames with a known listing date, asserting the
opening-range breakout trigger, the opening-candle stop (including stop-hit
propagation across horizons), the 7/15/30/60/90-session exits, the excursion
metrics, and the rule-based scorer. No network / no Mongo, matching the suite's
existing style (see test_fvg_backtest.py).
"""

from __future__ import annotations

import pandas as pd

from engines.strategies.ipo_vintage import (
    build_ipo_vintage_result,
    score_ipo_vintage,
    strength_label,
    MAX_LISTING_AGE_DAYS,
    LIVE_WINDOW_SESSIONS,
)


def _df(rows: list[tuple], start="2026-01-01") -> pd.DataFrame:
    """rows = list of (open, high, low, close, volume); consecutive daily bars."""
    dates = pd.date_range(start, periods=len(rows), freq="D")
    return pd.DataFrame(
        {
            "Date": dates,
            "Open": [r[0] for r in rows],
            "High": [r[1] for r in rows],
            "Low": [r[2] for r in rows],
            "Close": [r[3] for r in rows],
            "Volume": [r[4] for r in rows],
        }
    )


def _flat(n: int, price: float, vol: int = 10_000) -> list[tuple]:
    """n uneventful bars that neither break out nor approach a stop."""
    return [(price, price + 1, price - 1, price, vol)] * n


# ── Trigger detection ────────────────────────────────────────────────────────

def test_close_above_opening_CLOSE_but_below_opening_HIGH_is_not_a_signal():
    """Direct regression test against the original bug.

    The opening candle closes at 100 but its HIGH is 120. Later bars close at
    105/110 — above the opening CLOSE, below the opening HIGH. The corrected
    logic must produce NO signal; the old close-based logic wrongly triggered.
    """
    df = _df([
        (90, 120, 85, 100, 50_000),    # opening candle: high 120, low 85, close 100
        (100, 108, 98, 105, 20_000),   # closes above opening close, below high
        (105, 112, 102, 110, 20_000),  # ditto
        (110, 118, 106, 115, 20_000),  # still below 120
    ])
    assert build_ipo_vintage_result(
        symbol="T", company_name="T", df=df, listing_date="2026-01-01",
    ) is None


def test_trigger_entry_stop_and_risk_are_correct():
    rows = [
        (90, 120, 80, 100, 50_000),    # opening: high 120, low 80
        (100, 115, 95, 110, 20_000),   # below high -> no trigger
        (115, 130, 112, 125, 40_000),  # TRIGGER: close 125 > 120
    ]
    rows += _flat(10, 126)
    out = build_ipo_vintage_result(symbol="T", company_name="T", df=_df(rows), listing_date="2026-01-01")
    assert out is not None
    assert out["opening_high"] == 120.0
    assert out["opening_low"] == 80.0
    assert out["opening_close"] == 100.0
    assert out["trigger_date"] == "2026-01-03"
    assert out["entry"] == 125.0
    assert out["entry_session"] == 2
    assert out["stop_loss"] == 80.0
    assert out["risk_pct"] == round((125.0 - 80.0) / 125.0 * 100.0, 2)   # 36.0
    assert out["breakout_strength_pct"] == round((125.0 - 120.0) / 120.0 * 100.0, 2)  # 4.17
    assert out["stop_hit"] is False


def test_missing_listing_candle_returns_none():
    # First available bar is 30 days after the stated listing date.
    df = _df(_flat(10, 100), start="2026-02-01")
    assert build_ipo_vintage_result(
        symbol="T", company_name="T", df=df, listing_date="2026-01-01",
    ) is None


def test_aged_out_beyond_vintage_window_returns_none():
    rows = [(90, 120, 80, 100, 50_000), (120, 130, 118, 125, 40_000)]
    rows += _flat(MAX_LISTING_AGE_DAYS + 10, 126)
    assert build_ipo_vintage_result(
        symbol="T", company_name="T", df=_df(rows), listing_date="2026-01-01",
    ) is None


# ── Stop handling ────────────────────────────────────────────────────────────

def test_stop_hit_propagates_the_stop_return_to_all_later_horizons():
    """Once stopped, every horizon at/after the stop session reports the stop
    return — never a later close the position never actually saw."""
    rows = [
        (90, 120, 80, 100, 50_000),    # opening: high 120, low 80 (stop)
        (120, 130, 118, 125, 40_000),  # TRIGGER at 125
        (125, 126, 79, 95, 30_000),    # stop breached (low 79 <= 80), session 1
    ]
    # Price then rockets — a naive mark-to-market would show big gains.
    rows += _flat(120, 300)
    out = build_ipo_vintage_result(symbol="T", company_name="T", df=_df(rows), listing_date="2026-01-01")
    assert out is not None
    assert out["stop_hit"] is True
    assert out["stop_hit_session"] == 1
    assert out["setup_status"] == "stopped"

    expected = round((80.0 - 125.0) / 125.0 * 100.0, 2)   # -36.0
    for key in ("h7", "h15", "h30", "h60", "h90"):
        hz = out["horizons"][key]
        assert hz["status"] == "stopped", key
        assert hz["return_pct"] == expected, key
        assert hz["exit_price"] == 80.0, key
    # The 300-price rally must not leak into the outcome.
    assert out["unrealized_return_pct"] == expected


def test_stop_and_horizon_on_the_same_bar_stop_wins():
    """A bar that both breaches the stop and completes h7 counts as stopped."""
    rows = [
        (90, 120, 80, 100, 50_000),    # opening
        (120, 130, 118, 125, 40_000),  # TRIGGER (index 1)
    ]
    rows += _flat(6, 126)              # sessions 1..6 after entry
    rows += [(126, 127, 75, 90, 30_000)]  # session 7 = h7 bar AND breaches stop
    rows += _flat(100, 200)
    out = build_ipo_vintage_result(symbol="T", company_name="T", df=_df(rows), listing_date="2026-01-01")
    assert out is not None
    assert out["stop_hit_session"] == 7
    assert out["horizons"]["h7"]["status"] == "stopped"
    assert out["horizons"]["h7"]["return_pct"] == round((80.0 - 125.0) / 125.0 * 100.0, 2)


# ── Horizon resolution ───────────────────────────────────────────────────────

def test_horizons_resolved_versus_pending_with_days_remaining():
    rows = [
        (90, 120, 80, 100, 50_000),    # opening
        (120, 130, 118, 125, 40_000),  # TRIGGER at index 1
    ]
    rows += _flat(20, 130)             # 20 sessions after entry -> h7/h15 resolve
    out = build_ipo_vintage_result(symbol="T", company_name="T", df=_df(rows), listing_date="2026-01-01")
    assert out is not None
    assert out["horizons"]["h7"]["status"] == "resolved"
    assert out["horizons"]["h15"]["status"] == "resolved"
    assert out["horizons"]["h7"]["return_pct"] == round((130.0 - 125.0) / 125.0 * 100.0, 2)

    for key, h in (("h30", 30), ("h60", 60), ("h90", 90)):
        hz = out["horizons"][key]
        assert hz["status"] == "pending", key
        assert hz["days_remaining"] == h - 20, key
    assert out["setup_status"] == "live"
    assert out["is_live"] is True


# ── Live window: a stale trigger is history, not an opportunity ──────────────

def test_recent_trigger_is_live():
    rows = [
        (90, 120, 80, 100, 50_000),
        (120, 130, 118, 125, 40_000),   # TRIGGER
    ]
    rows += _flat(3, 130)               # only 3 sessions since the trigger
    out = build_ipo_vintage_result(symbol="T", company_name="T", df=_df(rows), listing_date="2026-01-01")
    assert out is not None
    assert out["is_live"] is True
    assert out["setup_status"] == "live"
    assert out["days_since_trigger"] == 3
    assert out["sessions_left_in_window"] == LIVE_WINDOW_SESSIONS - 3


def test_stale_trigger_expires_and_is_not_live():
    """The exact case that must never appear as an opportunity: a listing that
    crossed its opening high long ago and simply drifted since. The trade was
    real, but its entry price is far behind us — it belongs in the track record."""
    rows = [
        (90, 120, 80, 100, 50_000),
        (120, 130, 118, 125, 40_000),   # TRIGGER
    ]
    rows += _flat(LIVE_WINDOW_SESSIONS + 5, 130)   # long past the live window
    out = build_ipo_vintage_result(symbol="T", company_name="T", df=_df(rows), listing_date="2026-01-01")
    assert out is not None
    assert out["is_live"] is False
    assert out["setup_status"] == "expired"
    assert out["sessions_left_in_window"] == 0
    assert out["stop_hit"] is False          # expired on age alone, not a stop


def test_live_window_boundary_is_inclusive():
    for offset, expected in ((LIVE_WINDOW_SESSIONS, "live"), (LIVE_WINDOW_SESSIONS + 1, "expired")):
        rows = [(90, 120, 80, 100, 50_000), (120, 130, 118, 125, 40_000)]
        rows += _flat(offset, 130)
        out = build_ipo_vintage_result(symbol="T", company_name="T", df=_df(rows), listing_date="2026-01-01")
        assert out is not None
        assert out["days_since_trigger"] == offset
        assert out["setup_status"] == expected, f"at {offset} sessions"


def test_a_later_recross_never_creates_a_new_signal():
    """A stock that crossed once early, fell back inside the range, and crossed
    again much later must still report the ORIGINAL trigger — the re-cross is
    not a fresh opportunity."""
    rows = [
        (90, 120, 80, 100, 50_000),     # opening: high 120
        (120, 130, 118, 125, 40_000),   # FIRST cross (the only trigger)
        (125, 126, 100, 105, 20_000),   # back below the opening high
    ]
    rows += _flat(LIVE_WINDOW_SESSIONS + 10, 105)
    rows += [(105, 200, 104, 190, 90_000)]   # dramatic LATER re-cross
    out = build_ipo_vintage_result(symbol="T", company_name="T", df=_df(rows), listing_date="2026-01-01")
    assert out is not None
    # Bar index 1 (2026-01-02) is the first cross — the later 190 close is ignored.
    assert out["trigger_date"] == "2026-01-02"
    assert out["entry"] == 125.0
    assert out["is_live"] is False               # still expired despite the re-cross


# ── Excursions ───────────────────────────────────────────────────────────────

def test_mae_mfe_and_max_drawdown_hand_computed():
    rows = [
        (90, 120, 80, 100, 50_000),     # opening: high 120, low 80
        (120, 130, 118, 125, 40_000),   # TRIGGER, entry 125 (index 1)
        (125, 160, 120, 150, 20_000),   # high 160 -> MFE peak
        (150, 152, 100, 105, 20_000),   # low 100 -> MAE trough (stop is 80, not hit)
        (105, 110, 102, 108, 20_000),
    ]
    out = build_ipo_vintage_result(symbol="T", company_name="T", df=_df(rows), listing_date="2026-01-01")
    assert out is not None
    assert out["stop_hit"] is False
    assert out["mfe_pct"] == round((160.0 - 125.0) / 125.0 * 100.0, 2)   # +28.0
    assert out["mae_pct"] == round((100.0 - 125.0) / 125.0 * 100.0, 2)   # -20.0
    # Intraday peak-to-trough: running high peaks at 160, later low is 100.
    assert out["max_drawdown_pct"] == round((100.0 - 160.0) / 160.0 * 100.0, 2)   # -37.5


def test_freshly_triggered_setup_has_no_excursion_yet():
    """Entry is the trigger bar's CLOSE, so that bar's own intraday range is not
    heat the position took. A setup triggered on the latest bar has experienced
    nothing yet and must report flat excursions, not the trigger day's swing."""
    rows = [
        (90, 120, 80, 100, 50_000),      # opening candle
        (120, 200, 70, 125, 40_000),     # TRIGGER, huge intraday range, entry = close 125
    ]
    out = build_ipo_vintage_result(symbol="T", company_name="T", df=_df(rows), listing_date="2026-01-01")
    assert out is not None
    assert out["days_since_trigger"] == 0
    assert out["mae_pct"] == 0.0
    assert out["mfe_pct"] == 0.0
    assert out["max_drawdown_pct"] == 0.0
    assert out["unrealized_return_pct"] == 0.0    # cmp IS the entry bar's close


def test_stopped_trade_never_reports_zero_drawdown():
    """A close-based drawdown could read 0% on a trade that was stopped out
    intraday — the drawdown and the stop must not be able to contradict."""
    rows = [
        (90, 120, 80, 100, 50_000),     # opening: high 120, low 80 (stop)
        (120, 130, 118, 125, 40_000),   # TRIGGER at 125
        # Next bar dips through the stop intraday but CLOSES higher than entry.
        (125, 140, 79, 135, 30_000),
    ]
    out = build_ipo_vintage_result(symbol="T", company_name="T", df=_df(rows), listing_date="2026-01-01")
    assert out is not None
    assert out["stop_hit"] is True
    assert out["max_drawdown_pct"] < 0.0
    assert out["mae_pct"] == round((80.0 - 125.0) / 125.0 * 100.0, 2)


def test_mae_is_floored_at_the_stop_when_stopped():
    """After the stop is hit the position is closed, so MAE cannot be worse than
    the stop price even if the stock keeps collapsing."""
    rows = [
        (90, 120, 80, 100, 50_000),
        (120, 130, 118, 125, 40_000),   # TRIGGER at 125, stop 80
        (125, 126, 79, 85, 30_000),     # stop hit (low 79)
        (85, 86, 20, 25, 30_000),       # crashes far below the stop — must be ignored
    ]
    out = build_ipo_vintage_result(symbol="T", company_name="T", df=_df(rows), listing_date="2026-01-01")
    assert out is not None
    assert out["stop_hit"] is True
    assert out["mae_pct"] == round((80.0 - 125.0) / 125.0 * 100.0, 2)   # floored at the stop


# ── Scorer ───────────────────────────────────────────────────────────────────

def test_tight_risk_outscores_wide_risk_at_equal_breakout_strength():
    tight, tight_subs = score_ipo_vintage(breakout_strength_pct=4.0, risk_pct=5.0, volume_ratio=1.5)
    wide, wide_subs = score_ipo_vintage(breakout_strength_pct=4.0, risk_pct=24.0, volume_ratio=1.5)
    assert tight > wide
    assert tight_subs["risk_quality"] == 100.0
    assert wide_subs["risk_quality"] < 10.0


def test_scorer_shape_and_bounds():
    conf, breakdown = score_ipo_vintage(breakout_strength_pct=8.0, risk_pct=5.0, volume_ratio=2.5)
    assert 0.0 <= conf <= 100.0
    assert set(breakdown.keys()) == {"breakout_strength", "risk_quality", "volume"}
    assert strength_label(conf) in ("Strong", "Medium", "Weak")
    # Missing volume data is neutral, not penalising.
    assert score_ipo_vintage(4.0, 10.0, None)[1]["volume"] == 50.0
