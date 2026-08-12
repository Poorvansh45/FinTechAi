"""
Phase 2 regression tests — chunked Download-stage fetch/persist must produce
identical results to the pre-chunking single-shot behaviour, just with
bounded peak memory (see the standalone memory benchmark used to measure
that; not part of the automated suite since it deliberately allocates a
realistic ~2,200-symbol universe to get an honest number).

Three things are verified here:
  1. _fetch_chunk() on a slice of symbols aggregates identically to running
     it once over the whole set (chunking the FETCH doesn't change outcomes).
  2. _persist_chunk_mongo() called N times over disjoint chunks writes byte-
     identical final per-symbol data to Mongo as calling the equivalent
     single-shot merge once over everything (chunking the PERSIST doesn't
     change outcomes).
  3. download_incremental_ohlc()'s progress_cb is invoked with correct
     (done, total) pairs, and a raising callback does not abort ingestion.
"""

from __future__ import annotations

import asyncio

import numpy as np
import pandas as pd

import services.ohlc_downloader as ohlc
from services.ohlc_downloader import (
    _fetch_chunk,
    _persist_chunk_mongo,
    _to_naive_datetime,
    download_incremental_ohlc,
    validate_and_clean_data,
)

# ── Shared synthetic universe ─────────────────────────────────────────────


def _row(sym: str, instrument_key: str = "NSE_EQ|FAKE") -> pd.Series:
    return pd.Series({"Symbol": sym, "instrument_key": instrument_key})


def _symbols_df(n: int) -> pd.DataFrame:
    return pd.DataFrame([_row(f"SYM{i:03d}") for i in range(n)])


def _ohlc_frame(sym: str, seed: int, n: int = 30) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    close = np.abs(100 + np.cumsum(rng.normal(0, 1, n))) + 1.0
    return pd.DataFrame(
        {
            "date": pd.date_range("2026-01-01", periods=n, freq="D"),
            "open": close,
            "high": close + 1,
            "low": close - 1,
            "close": close,
            "volume": rng.integers(1000, 50_000, n),
            "symbol": sym,
        }
    )


# ── 1. Fetch chunking ──────────────────────────────────────────────────────


def _fake_process_stock(row, last_date_map):
    """Deterministic stand-in for process_stock() — no network."""
    sym = row["Symbol"]
    if sym == "^NSEI":  # the benchmark row download_incremental_ohlc() appends
        return {"symbol": sym, "status": "up_to_date", "df": None}
    idx = int(sym.replace("SYM", ""))
    if idx % 5 == 0:
        return {"symbol": sym, "status": "up_to_date", "df": None}
    if idx % 7 == 0:
        return {"symbol": sym, "status": "no_data", "df": None}
    if idx % 11 == 0:
        return {"symbol": sym, "status": "failure", "error": "boom", "df": None}
    return {"symbol": sym, "status": "success", "df": _ohlc_frame(sym, seed=idx)}


def test_fetch_chunk_aggregates_same_as_whole_universe(monkeypatch):
    monkeypatch.setattr(ohlc, "process_stock", _fake_process_stock)
    symbols_df = _symbols_df(55)

    # Chunked: 4 slices of ~15 each.
    chunk_size = 15
    chunked_success, chunked_failed, chunked_missing, chunked_uptodate = (
        [],
        [],
        [],
        0,
    )
    chunked_records = []
    for start in range(0, len(symbols_df), chunk_size):
        res = _fetch_chunk(symbols_df.iloc[start : start + chunk_size], {})
        chunked_records.extend(res["records"])
        chunked_success.extend(res["success"])
        chunked_failed.extend(res["failed"])
        chunked_missing.extend(res["missing"])
        chunked_uptodate += res["up_to_date"]

    # Whole-universe, single call.
    whole = _fetch_chunk(symbols_df, {})

    assert sorted(chunked_success) == sorted(whole["success"])
    assert sorted(chunked_failed) == sorted(whole["failed"])
    assert sorted(chunked_missing) == sorted(whole["missing"])
    assert chunked_uptodate == whole["up_to_date"]
    assert len(chunked_records) == len(whole["records"])


# ── 2. Persist chunking ─────────────────────────────────────────────────────


class FakeMongoStore:
    """Minimal stand-in for services.ohlcv_store's get_symbol/upsert_frame,
    keyed by symbol, so two independently-seeded stores can be diffed."""

    def __init__(self):
        self.data: dict[str, pd.DataFrame] = {}

    def get_symbol(self, sym: str) -> pd.DataFrame:
        df = self.data.get(sym)
        if df is None or df.empty:
            return pd.DataFrame()
        return df.rename(
            columns={
                "symbol": "Symbol",
                "date": "Date",
                "open": "Open",
                "high": "High",
                "low": "Low",
                "close": "Close",
                "volume": "Volume",
            }
        )

    def upsert_frame(self, df: pd.DataFrame) -> int:
        for sym, g in df.groupby("symbol"):
            self.data[sym] = g.reset_index(drop=True)
        return len(df["symbol"].unique())


def _single_shot_merge(records: list[pd.DataFrame], store: FakeMongoStore) -> None:
    """Reproduces the PRE-Phase-2 single-shot merge loop exactly, against the
    given store, for comparison against the chunked path."""
    new_df = pd.concat(records, ignore_index=True)
    new_df.columns = new_df.columns.str.lower()
    new_df["date"] = _to_naive_datetime(new_df["date"])
    new_df["symbol"] = new_df["symbol"].astype(str).str.strip().str.upper()

    for sym, incoming in new_df.groupby("symbol"):
        prior = store.get_symbol(sym)
        if not prior.empty:
            prior = prior.rename(
                columns={
                    "Symbol": "symbol",
                    "Date": "date",
                    "Open": "open",
                    "High": "high",
                    "Low": "low",
                    "Close": "close",
                    "Volume": "volume",
                }
            )[["symbol", "date", "open", "high", "low", "close", "volume"]]
            merged = pd.concat([prior, incoming], ignore_index=True)
        else:
            merged = incoming
        merged = validate_and_clean_data(merged)
        merged["date"] = merged["date"].dt.normalize()
        merged = merged.sort_values("date")
        store.upsert_frame(merged)


def test_chunked_persist_matches_single_shot_persist(monkeypatch):
    """The exact regression this phase is about: chunking WHEN symbols are
    persisted must not change WHAT ends up stored for any symbol."""
    symbols = [f"SYM{i:03d}" for i in range(40)]
    records = [_ohlc_frame(s, seed=i) for i, s in enumerate(symbols)]

    single_shot_store = FakeMongoStore()
    _single_shot_merge(records, single_shot_store)

    chunked_store = FakeMongoStore()
    import services.ohlcv_store as store_module

    monkeypatch.setattr(store_module, "get_symbol", chunked_store.get_symbol)
    monkeypatch.setattr(store_module, "upsert_frame", chunked_store.upsert_frame)

    chunk_size = 9  # deliberately not a divisor of 40
    for start in range(0, len(records), chunk_size):
        _persist_chunk_mongo(records[start : start + chunk_size])

    assert set(single_shot_store.data.keys()) == set(chunked_store.data.keys())
    for sym in single_shot_store.data:
        pd.testing.assert_frame_equal(
            single_shot_store.data[sym].reset_index(drop=True),
            chunked_store.data[sym].reset_index(drop=True),
        )


# ── 3. Progress callback wiring ──────────────────────────────────────────────


def test_download_incremental_ohlc_reports_progress_and_survives_bad_callback(
    monkeypatch, tmp_path
):
    monkeypatch.setattr(ohlc, "process_stock", _fake_process_stock)
    monkeypatch.setattr(ohlc, "_use_mongo", lambda: False)  # exercise the CSV path

    symbols_csv = tmp_path / "symbols.csv"
    pd.DataFrame(
        {
            "trading_symbol": [f"SYM{i:03d}" for i in range(23)],
            "company_name": [f"Company {i}" for i in range(23)],
            "instrument_key": ["NSE_EQ|FAKE"] * 23,
        }
    ).to_csv(symbols_csv, index=False)
    output_csv = tmp_path / "Stock_Data.csv"

    monkeypatch.setattr(
        ohlc,
        "get_downloader_paths",
        lambda: {"symbols_csv": str(symbols_csv), "output_csv": str(output_csv)},
    )
    monkeypatch.setattr(ohlc, "DOWNLOAD_CHUNK_SIZE", 5)  # force multiple chunks

    calls: list[tuple[int, int]] = []

    async def progress_cb(done, total):
        calls.append((done, total))
        if done == calls[0][0]:  # fail on the very first call, must not abort
            raise RuntimeError("simulated progress-write failure")

    asyncio.run(download_incremental_ohlc(progress_cb=progress_cb))

    # 23 symbols + 1 benchmark row (^NSEI) = 24, chunked at 5 -> 5 calls,
    # strictly increasing, ending at the true total.
    assert len(calls) == 5
    assert [c[0] for c in calls] == [5, 10, 15, 20, 24]
    assert all(c[1] == 24 for c in calls)
    assert output_csv.exists(), "a failing progress callback must not abort ingestion"
