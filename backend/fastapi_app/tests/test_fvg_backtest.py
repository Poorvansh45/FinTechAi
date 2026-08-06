"""
Unit tests for the historical bullish-FVG backtest (engines/patterns/fvg.py).

Pure/offline — builds tiny synthetic OHLCV frames with a single known FVG and
asserts the win/loss classification, averages, and the look-ahead guard. Uses a
small forward window (3 bars) so the fixtures stay readable. No network / no Mongo,
matching the suite's existing style.
"""

from __future__ import annotations

import pandas as pd

from engines.patterns.fvg import fvg_backtest


def _df(rows: list[tuple]) -> pd.DataFrame:
    """rows = list of (open, high, low, close); dates are consecutive days."""
    dates = pd.date_range("2026-01-01", periods=len(rows), freq="D")
    return pd.DataFrame(
        {
            "Date": dates,
            "Open": [r[0] for r in rows],
            "High": [r[1] for r in rows],
            "Low": [r[2] for r in rows],
            "Close": [r[3] for r in rows],
        }
    )


def test_empty_or_short_returns_zero_sample():
    for df in (pd.DataFrame(), _df([(99, 100, 98, 99), (99, 100, 98, 99)])):
        out = fvg_backtest(df, forward_days=3)
        assert out["fvg_sample"] == 0
        assert out["fvg_win_rate"] is None


def test_single_fvg_win_case():
    # C1.High=100, C3.Low=106 → gap floor 100 / ceiling 106; entry 106,
    # target 106 + 2*(106-100) = 118. A later High (119) hits target first.
    df = _df([
        (99, 100, 98, 99),      # d0 C1
        (104, 108, 103, 107),   # d1 C2 (impulse)
        (107, 112, 106, 110),   # d2 C3 → FVG completes here (j=2)
        (110, 115, 107, 114),   # d3
        (114, 119, 111, 117),   # d4 → High 119 ≥ target 118 ⇒ WIN
        (117, 118, 112, 117),   # d5
    ])
    out = fvg_backtest(df, forward_days=3)
    assert out["fvg_sample"] == 1
    assert out["fvg_win_rate"] == 100.0
    assert out["fvg_avg_win"] is not None and out["fvg_avg_win"] > 0
    assert out["fvg_avg_loss"] is None


def test_single_fvg_loss_case():
    # Same FVG (floor 100), but a forward candle CLOSES below the floor first.
    df = _df([
        (99, 100, 98, 99),      # d0 C1
        (104, 108, 103, 107),   # d1 C2
        (107, 112, 106, 110),   # d2 C3 → FVG (floor 100, entry 106)
        (105, 107, 99, 98),     # d3 → Close 98 < floor 100 ⇒ LOSS
        (98, 100, 96, 99),      # d4
        (99, 101, 97, 100),     # d5
    ])
    out = fvg_backtest(df, forward_days=3)
    assert out["fvg_sample"] == 1
    assert out["fvg_win_rate"] == 0.0
    assert out["fvg_avg_win"] is None
    assert out["fvg_avg_loss"] is not None and out["fvg_avg_loss"] < 0


def test_lookahead_guard_excludes_gaps_without_full_window():
    # The only FVGs form too close to the end (no full 3-bar forward window),
    # so none are counted — no look-ahead / incomplete outcomes.
    df = _df([
        (99, 100, 98, 99),      # d0
        (98, 101, 97, 100),     # d1
        (100, 105, 99, 104),    # d2 (C1 for the late gap)
        (106, 112, 108, 111),   # d3
        (110, 115, 106, 113),   # d4 → gap completes here (j=4), 4+3 ≥ n=6
        (113, 116, 111, 114),   # d5
    ])
    out = fvg_backtest(df, forward_days=3)
    assert out["fvg_sample"] == 0
