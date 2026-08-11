#!/usr/bin/env python
"""
Copy backend/data/Stock_Data.csv into the MongoDB `ohlcv` collection.

    python scripts/migrate_ohlcv_to_mongo.py            # migrate, then verify
    python scripts/migrate_ohlcv_to_mongo.py --verify   # verify only, no writes
    python scripts/migrate_ohlcv_to_mongo.py --resume   # skip symbols already stored
    python scripts/migrate_ohlcv_to_mongo.py --limit 50 # first N symbols (a smoke test)

READ-ONLY WITH RESPECT TO THE CSV. The file is opened, never written, never
moved, never deleted — it stays exactly as it is so `ohlcv_backend="csv"`
remains a working rollback at any point.

Memory: the CSV is streamed in chunks and flushed per complete symbol, so peak
usage is one symbol's history plus one chunk — never the whole 196 MB file.

Verification compares MongoDB against the CSV with EXACT equality (not a
tolerance): OHLC are stored as float64, so the round-trip is bit-for-bit
lossless and anything less than exact agreement is a real defect.
"""

import argparse
import os
import sys
import time

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import ohlcv_store as store

CHUNK = 400_000
COLS = ["symbol", "date", "open", "high", "low", "close", "volume"]
OUT = {
    "open": "Open",
    "high": "High",
    "low": "Low",
    "close": "Close",
    "volume": "Volume",
}


def csv_path() -> str:
    from services.ohlc_downloader import get_downloader_paths

    return get_downloader_paths()["output_csv"]


def _iter_symbols(path: str, limit: int | None = None):
    """Yield (symbol, frame) for each complete symbol, streaming the file.

    Rows for one symbol are contiguous (the writer sorts by symbol, then date),
    so a symbol is complete as soon as a different one appears. The carry-over
    guards the case where a symbol straddles a chunk boundary.
    """
    carry: list[pd.DataFrame] = []
    current: str | None = None
    emitted = 0
    for chunk in pd.read_csv(path, chunksize=CHUNK):
        chunk.columns = chunk.columns.str.lower()
        chunk = chunk[COLS]
        for sym, g in chunk.groupby("symbol", sort=False):
            sym = str(sym).strip().upper()
            if current is None:
                current = sym
            if sym != current:
                if carry:
                    yield current, pd.concat(carry, ignore_index=True)
                    emitted += 1
                    if limit and emitted >= limit:
                        return
                carry, current = [], sym
            carry.append(g)
    if carry and current:
        yield current, pd.concat(carry, ignore_index=True)


def _prepare(g: pd.DataFrame) -> pd.DataFrame:
    g = g.copy()
    g["date"] = pd.to_datetime(g["date"])
    g = g.rename(columns=OUT).rename(columns={"date": "Date", "symbol": "Symbol"})
    return g.sort_values("Date").reset_index(drop=True)


def migrate(limit=None, resume=False) -> None:
    from pymongo import ReplaceOne

    path = csv_path()
    if not os.path.exists(path):
        sys.exit(f"CSV not found: {path}")
    print(f"source : {path}  ({os.path.getsize(path) / 1e6:.0f} MB)")
    print(f"target : MongoDB '{store.COLLECTION}'  (CSV is read-only here)\n")

    existing: set[str] = set()
    if resume:
        existing = {d["_id"] for d in store._coll().find({}, {"_id": 1})}
        print(f"resume: {len(existing)} symbols already stored, skipping those\n")

    coll = store._coll()
    ops: list = []
    n_sym = n_bar = skipped = 0
    t0 = time.time()

    for sym, g in _iter_symbols(path, limit):
        if sym in existing:
            skipped += 1
            continue
        frame = _prepare(g)
        ops.append(ReplaceOne({"_id": sym}, store.encode(sym, frame), upsert=True))
        n_sym += 1
        n_bar += len(frame)
        if len(ops) >= 200:
            coll.bulk_write(ops, ordered=False)
            ops.clear()
            print(
                f"  {n_sym:5d} symbols · {n_bar:9,} bars · {time.time() - t0:5.1f}s",
                flush=True,
            )
    if ops:
        coll.bulk_write(ops, ordered=False)

    store.clear_cache()
    print(
        f"\nwrote {n_sym} symbols / {n_bar:,} bars in {time.time() - t0:.1f}s"
        + (f" (skipped {skipped} existing)" if skipped else "")
    )

    s = store.stats()
    print(
        f"collection now: {s['symbols']} symbols, {s['bars']:,} bars, "
        f"{s['oldest']:%Y-%m-%d} -> {s['newest']:%Y-%m-%d}"
    )


def verify(sample: int = 40) -> int:
    """Compare MongoDB against the CSV. Exit code 0 = identical."""
    path = csv_path()
    print(f"verifying MongoDB against {path}\n")

    s = store.stats()
    print(f"mongo : {s['symbols']:5d} symbols  {s['bars']:10,} bars")

    counts: dict[str, int] = {}
    total = 0
    for chunk in pd.read_csv(path, usecols=["symbol"], chunksize=CHUNK):
        vc = chunk["symbol"].astype(str).str.strip().str.upper().value_counts()
        for k, v in vc.items():
            counts[k] = counts.get(k, 0) + int(v)
        total += len(chunk)
    print(f"csv   : {len(counts):5d} symbols  {total:10,} bars")

    problems: list[str] = []
    if s["bars"] != total:
        problems.append(f"bar count differs: mongo {s['bars']:,} vs csv {total:,}")
    if s["symbols"] != len(counts):
        problems.append(
            f"symbol count differs: mongo {s['symbols']} vs csv {len(counts)}"
        )

    # Per-symbol bar counts
    stored = {d["_id"]: d["n"] for d in store._coll().find({}, {"n": 1})}
    for sym, n in counts.items():
        if sym not in stored:
            problems.append(f"missing from mongo: {sym}")
        elif stored[sym] != n:
            problems.append(f"{sym}: mongo {stored[sym]} bars vs csv {n}")
    for sym in stored:
        if sym not in counts:
            problems.append(f"extra in mongo (not in csv): {sym}")

    # Exact value comparison on a spread of symbols
    picks = sorted(counts)[:: max(1, len(counts) // sample)][:sample]
    print(f"\nexact value check on {len(picks)} symbols...")
    want = set(picks)
    frames: dict[str, list[pd.DataFrame]] = {p: [] for p in picks}
    for chunk in pd.read_csv(path, chunksize=CHUNK):
        chunk.columns = chunk.columns.str.lower()
        chunk["symbol"] = chunk["symbol"].astype(str).str.strip().str.upper()
        hit = chunk[chunk["symbol"].isin(want)]
        for sym, g in hit.groupby("symbol"):
            frames[sym].append(g)

    mismatched = 0
    for sym in picks:
        if not frames[sym]:
            continue
        csv_df = _prepare(pd.concat(frames[sym], ignore_index=True))
        doc = store._coll().find_one({"_id": sym})
        if not doc:
            problems.append(f"{sym}: absent")
            continue
        got = store.decode(doc)
        for col, dtype in (
            ("Open", np.float64),
            ("High", np.float64),
            ("Low", np.float64),
            ("Close", np.float64),
            ("Volume", np.int64),
        ):
            a = csv_df[col].to_numpy(dtype)
            b = got[col].to_numpy(dtype)
            if a.shape != b.shape or not np.array_equal(a, b):
                bad = int((a != b).sum()) if a.shape == b.shape else -1
                problems.append(
                    f"{sym}.{col}: {bad} values differ (expected exact match)"
                )
                mismatched += 1
                break
        if not (
            csv_df["Date"].to_numpy("datetime64[D]")
            == got["Date"].to_numpy("datetime64[D]")
        ).all():
            problems.append(f"{sym}.Date: dates differ")

    print()
    if problems:
        print(f"FAILED — {len(problems)} problem(s):")
        for p in problems[:25]:
            print(f"  - {p}")
        if len(problems) > 25:
            print(f"  … and {len(problems) - 25} more")
        return 1
    print("PASSED — MongoDB matches the CSV exactly (bar counts and values).")
    print('The CSV is unchanged and remains a valid rollback: ohlcv_backend="csv".')
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--verify", action="store_true", help="verify only, write nothing")
    ap.add_argument("--resume", action="store_true", help="skip symbols already stored")
    ap.add_argument("--limit", type=int, help="only the first N symbols")
    ap.add_argument("--sample", type=int, default=40, help="symbols to value-check")
    a = ap.parse_args()

    if a.verify:
        sys.exit(verify(a.sample))
    migrate(limit=a.limit, resume=a.resume)
    print()
    sys.exit(verify(a.sample))
