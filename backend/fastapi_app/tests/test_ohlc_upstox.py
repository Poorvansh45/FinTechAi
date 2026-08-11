"""
Upstox OHLCV downloader — pure-function tests (no network, no MongoDB).

Covers the candle parser (`_parse_upstox_candles`) and the instrument-key
resolver that back the Upstox-only OHLCV fetch in services/ohlc_downloader.py
(Groww was removed from the OHLCV path). All logic here is deterministic and
offline — consistent with test_engines.py's zero-dependency style; no test hits
the live Upstox API.
"""

from __future__ import annotations

import pandas as pd

from services.ohlc_downloader import (
    _parse_upstox_candles,
    _resolve_instrument_key,
    _to_naive_datetime,
)

# A realistic Upstox V3 `candles` payload: newest-first, +05:30 tz,
# [iso_ts, open, high, low, close, volume, oi].
NEWEST_FIRST = [
    ["2026-07-15T00:00:00+05:30", 229.0, 233.6, 227.05, 228.24, 1562685, 0],
    ["2026-07-14T00:00:00+05:30", 225.0, 230.0, 224.0, 229.0, 1000000, 0],
    ["2026-07-13T00:00:00+05:30", 220.0, 226.0, 219.5, 225.0, 900000, 0],
]


# ── _parse_upstox_candles ────────────────────────────────────────────────────


def test_parse_sorts_newest_first_into_ascending():
    df = _parse_upstox_candles(NEWEST_FIRST)
    assert list(df.columns) == ["date", "open", "high", "low", "close", "volume"]
    dates = list(df["date"])
    assert dates == sorted(dates)  # ascending
    assert df.iloc[0]["date"] == pd.Timestamp("2026-07-13")
    assert df.iloc[-1]["date"] == pd.Timestamp("2026-07-15")


def test_parse_strips_timezone_and_normalizes():
    df = _parse_upstox_candles(NEWEST_FIRST)
    # tz-naive, midnight-normalized — matches the Groww/yfinance shape.
    assert df["date"].dt.tz is None
    assert (df["date"] == df["date"].dt.normalize()).all()


def test_parse_preserves_ohlcv_values():
    df = _parse_upstox_candles(NEWEST_FIRST)
    last = df.iloc[-1]  # 2026-07-15 row
    assert last["open"] == 229.0
    assert last["high"] == 233.6
    assert last["low"] == 227.05
    assert last["close"] == 228.24
    assert last["volume"] == 1562685


def test_parse_skips_rows_missing_date_or_close():
    payload = [
        ["2026-07-15T00:00:00+05:30", 1.0, 2.0, 0.5, 1.5, 100, 0],
        [None, 1.0, 2.0, 0.5, 1.5, 100, 0],  # null date -> skip
        [
            "2026-07-13T00:00:00+05:30",
            1.0,
            2.0,
            0.5,
            None,
            100,
            0,
        ],  # null close -> skip
    ]
    df = _parse_upstox_candles(payload)
    assert len(df) == 1
    assert df.iloc[0]["date"] == pd.Timestamp("2026-07-15")


def test_parse_fills_missing_ohlc_from_close():
    # open/high/low null but close present -> reasonable fallbacks, row kept.
    payload = [["2026-07-15T00:00:00+05:30", None, None, None, 50.0, None, 0]]
    df = _parse_upstox_candles(payload)
    assert len(df) == 1
    row = df.iloc[0]
    assert row["open"] == 50.0
    assert row["high"] == 50.0
    assert row["low"] == 50.0
    assert row["volume"] == 0  # null volume -> 0


def test_parse_empty_and_short_rows():
    assert _parse_upstox_candles([]).empty
    assert _parse_upstox_candles([[1, 2, 3]]).empty  # < 6 fields -> skipped -> empty


# ── _resolve_instrument_key ──────────────────────────────────────────────────


def test_instrument_key_prefers_explicit_column():
    assert (
        _resolve_instrument_key(
            {"instrument_key": "NSE_EQ|INE002A01018", "isin": "INE999"}
        )
        == "NSE_EQ|INE002A01018"
    )


def test_instrument_key_derives_from_isin_when_column_absent():
    # NSE_EQ|<isin> is exactly the official key format (validated live).
    assert _resolve_instrument_key({"isin": "INE002A01018"}) == "NSE_EQ|INE002A01018"


def test_instrument_key_none_when_nothing_resolvable():
    assert _resolve_instrument_key({}) is None
    assert _resolve_instrument_key({"instrument_key": "", "isin": None}) is None


def test_instrument_key_works_with_pandas_series():
    # Production passes a pandas Series row, not a dict.
    row = pd.Series({"instrument_key": "NSE_EQ|INE0LLY01014", "isin": "INE0LLY01014"})
    assert _resolve_instrument_key(row) == "NSE_EQ|INE0LLY01014"


# ── _to_naive_datetime (the stale-data / mixed-tz merge guard) ────────────────


def test_naive_datetime_passthrough_for_naive_column():
    s = pd.to_datetime(pd.Series(["2026-07-20", "2026-07-21"]))
    out = _to_naive_datetime(s)
    assert out.dt.tz is None
    assert list(out) == [pd.Timestamp("2026-07-20"), pd.Timestamp("2026-07-21")]


def test_naive_datetime_strips_homogeneous_tz_without_day_shift():
    # IST-midnight dates must NOT roll back to the previous day (the bug a naive
    # utc=True conversion would have caused).
    s = pd.to_datetime(pd.Series(["2026-07-20", "2026-07-21"])).dt.tz_localize(
        "Asia/Kolkata"
    )
    out = _to_naive_datetime(s)
    assert out.dt.tz is None
    assert list(out) == [pd.Timestamp("2026-07-20"), pd.Timestamp("2026-07-21")]


def test_naive_datetime_demixes_object_column_without_raising():
    # The exact shape that used to crash the merge and silently discard the day's
    # fresh download: an object column mixing tz-aware and tz-naive Timestamps.
    mixed = pd.Series(
        [
            pd.Timestamp("2026-07-20"),  # naive (Upstox)
            pd.Timestamp("2026-07-21", tz="Asia/Kolkata"),  # tz-aware (yfinance)
        ],
        dtype=object,
    )
    out = _to_naive_datetime(mixed)
    assert pd.api.types.is_datetime64_any_dtype(out)
    assert out.dt.tz is None
    assert list(out) == [pd.Timestamp("2026-07-20"), pd.Timestamp("2026-07-21")]
