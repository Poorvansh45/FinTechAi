"""
FinAI Edge — MongoDB OHLCV store (per-symbol, columnar)
=======================================================
Primary OHLCV source when `settings.ohlcv_backend == "mongo"`. The CSV path in
`ohlc_downloader.py` remains available as an explicit fallback and is never
written to or deleted by this module.

WHY A SEPARATE COLLECTION SHAPE
-------------------------------
One document per symbol, holding each column as a single binary blob:

    {_id: "RELIANCE", n: 1257, start: …, end: …,
     d: <int32 days>, o|h|l|c: <float64>, v: <int64>}

Row-per-bar would be 2.26M documents; BSON arrays would pay a string key
("0","1","2"…) for every element. Binary blobs pay neither — measured at
44 B/bar, which is the raw numpy size, i.e. effectively zero overhead.

DTYPES ARE DELIBERATE
---------------------
float64 for OHLC, not float32. float32 is 4 B/bar cheaper but quantises prices
to ~7 significant digits, which was measured to shift LaunchPad's historical
FVG win-rate by 1.1% and avg-loss by 4.8% on NATIONALUM — a threshold-crossing
effect in the backtest, not accumulated drift, so it does NOT go away by
upcasting on read. float64 makes the round-trip bit-for-bit lossless: scanner
output is identical to the CSV path by construction.

int64 for volume: the full-file maximum is 1,807,991,128. float32 would silently
corrupt anything above 16.7M (i.e. most liquid stocks) and int32 leaves only
1.19x headroom.

MEMORY
------
Callers read one symbol at a time, so the whole universe is never resident.
A bounded LRU plus read-ahead keeps this at ~9 MB versus ~235 MB for the CSV.
"""

from __future__ import annotations

import logging
import threading
from collections import OrderedDict
from collections.abc import Iterable

import numpy as np
import pandas as pd

from config import get_settings

log = logging.getLogger("finai_edge.ohlcv_store")

COLLECTION = "ohlcv"
EPOCH = np.datetime64("1970-01-01")

# Columns as stored, and the numpy dtype each blob decodes with.
_BLOBS = (
    ("o", np.float64),
    ("h", np.float64),
    ("l", np.float64),
    ("c", np.float64),
    ("v", np.int64),
)
_OUT = {"o": "Open", "h": "High", "l": "Low", "c": "Close", "v": "Volume"}

# Bounded LRU. 128 symbols x ~70 KB is ~9 MB — enough to cover a read-ahead
# batch plus the tail of the previous one, without holding the universe.
_CACHE_MAX = 128
# On a miss, pull this many consecutive symbols in one round-trip. Measured:
# 116 ms/symbol unbatched (256 s per full scan) versus 6.7 ms at batch 50 (15 s).
# Atlas round-trip latency dominates, so batching is not optional.
_READAHEAD = 50

_cache: OrderedDict[str, pd.DataFrame] = OrderedDict()
_lock = threading.Lock()
# Separate lock for client construction. Sharing `_lock` would risk a deadlock
# the moment a future caller invoked _coll() while already holding it —
# threading.Lock is not reentrant.
_client_lock = threading.Lock()
_client = None
_universe: list[str] = []


# ── Connection ────────────────────────────────────────────────────────────────


def _coll():
    """Lazily open a SYNC pymongo handle.

    Deliberately not Motor: `load_stock_dataframe()` is synchronous and called
    from synchronous code, so an async client would force every one of its ~15
    call sites to change. The pool is kept small — Atlas M0 allows 500
    connections and Motor already holds its own pool.
    """
    global _client
    # Double-checked locking. The scan reaches this from a ThreadPoolExecutor
    # and from asyncio.to_thread, so an unguarded lazy init lets two threads
    # each build a MongoClient — one is then orphaned with its pool of sockets
    # never closed, which leaks against M0's 500-connection ceiling.
    if _client is None:
        with _client_lock:
            if _client is None:
                from pymongo import MongoClient

                s = get_settings()
                _client = MongoClient(
                    s.mongodb_uri,
                    maxPoolSize=10,
                    serverSelectionTimeoutMS=8000,
                    appname="finai-ohlcv-store",
                )
    return _client.get_default_database("finai_edge")[COLLECTION]


def close() -> None:
    """Release the client and its pool. Called from the FastAPI lifespan so a
    reload does not strand sockets."""
    global _client
    with _client_lock:
        if _client is not None:
            _client.close()
            _client = None
    clear_cache()


# ── Encode / decode ───────────────────────────────────────────────────────────


def encode(symbol: str, df: pd.DataFrame) -> dict:
    """Build the stored document from a per-symbol frame.

    Accepts either capitalised (Date/Open/…) or lowercase (date/open/…) columns
    so it can be fed straight from the CSV loader or from a provider response.
    """
    from bson.binary import Binary

    cols = {c.lower(): c for c in df.columns}
    d = df.sort_values(cols["date"]).reset_index(drop=True)
    dates = pd.to_datetime(d[cols["date"]]).to_numpy("datetime64[ns]")
    days = ((dates - EPOCH) / np.timedelta64(1, "D")).astype(np.int32)

    doc = {
        "_id": symbol,
        "n": len(d),
        "start": pd.Timestamp(dates[0]).to_pydatetime(),
        "end": pd.Timestamp(dates[-1]).to_pydatetime(),
        "d": Binary(days.tobytes()),
    }
    for key, dtype in _BLOBS:
        src = cols[_OUT[key].lower()]
        doc[key] = Binary(d[src].to_numpy(dtype).tobytes())
    return doc


def decode(doc: dict) -> pd.DataFrame:
    """Reverse `encode`. Column names and order match what
    `load_stock_dataframe()` has always returned, so callers see no difference."""
    days = np.frombuffer(doc["d"], np.int32)
    out = {
        "Symbol": doc["_id"],
        "Date": EPOCH + days.astype("timedelta64[D]"),
    }
    for key, dtype in _BLOBS:
        out[_OUT[key]] = np.frombuffer(doc[key], dtype)
    return pd.DataFrame(out)


# ── Cache ─────────────────────────────────────────────────────────────────────


def _cache_put(symbol: str, df: pd.DataFrame) -> None:
    _cache[symbol] = df
    _cache.move_to_end(symbol)
    while len(_cache) > _CACHE_MAX:
        _cache.popitem(last=False)


def clear_cache() -> None:
    """Drop every cached frame AND the universe list. Called by
    `refresh_in_memory_cache()` so the existing 'reload after download'
    contract still holds."""
    with _lock:
        _cache.clear()
        _universe.clear()


def invalidate(symbols: Iterable[str]) -> None:
    """Evict just these symbols, keeping the rest of the cache and the universe.

    `upsert_frame()` used to call `clear_cache()`, which also dropped the
    universe list. In the daily download — which upserts one symbol at a time —
    that forced a full 2,207-document rescan plus a wasted 50-symbol read-ahead
    on *every* iteration: measured at 0.89 s per symbol, roughly 32 minutes of
    pure overhead across a full refresh. Evicting only what changed keeps the
    same correctness guarantee at a fraction of the cost.
    """
    syms = [s.strip().upper() for s in symbols if s]
    if not syms:
        return
    with _lock:
        for s in syms:
            _cache.pop(s, None)
        # A genuinely new listing invalidates the universe list; an update to an
        # existing one does not.
        if _universe and any(s not in _universe for s in syms):
            _universe.clear()


def cache_stats() -> dict:
    with _lock:
        return {
            "cached_symbols": len(_cache),
            "max": _CACHE_MAX,
            "universe_known": len(_universe),
        }


# ── Reads ─────────────────────────────────────────────────────────────────────


def list_symbols() -> list[str]:
    """Every symbol held in the store, ordered. The order is retained so
    `get_symbol()` can read ahead along the sequence callers iterate."""
    global _universe
    with _lock:
        if _universe:
            return list(_universe)
    syms = [d["_id"] for d in _coll().find({}, {"_id": 1}).sort("_id", 1)]
    with _lock:
        _universe = syms
    return list(syms)


def last_dates() -> dict[str, pd.Timestamp]:
    """Newest stored bar per symbol, for incremental download planning.

    Reads only the `end` field — 2,200 tiny documents — so the downloader can
    decide what to fetch without pulling a single bar into memory.
    """
    return {
        d["_id"]: pd.Timestamp(d["end"])
        for d in _coll().find({}, {"end": 1})
        if d.get("end") is not None
    }


def get_many(symbols: Iterable[str]) -> dict[str, pd.DataFrame]:
    """Fetch several symbols in one round-trip, populating the cache."""
    wanted = [s for s in symbols if s]
    if not wanted:
        return {}
    out: dict[str, pd.DataFrame] = {}
    missing: list[str] = []
    with _lock:
        for s in wanted:
            hit = _cache.get(s)
            if hit is not None:
                _cache.move_to_end(s)
                out[s] = hit
            else:
                missing.append(s)
    if missing:
        for doc in _coll().find({"_id": {"$in": missing}}):
            df = decode(doc)
            out[doc["_id"]] = df
            with _lock:
                _cache_put(doc["_id"], df)
    return out


def get_symbol(symbol: str) -> pd.DataFrame:
    """One symbol's full history, or an empty frame if absent.

    On a miss this also pulls the next `_READAHEAD` symbols in universe order.
    Every scan loop walks that same order, so the batch is consumed from cache
    on the following iterations — batched throughput without any call site
    having to know about batching.
    """
    sym = symbol.strip().upper()
    with _lock:
        hit = _cache.get(sym)
        if hit is not None:
            _cache.move_to_end(sym)
            return hit.copy()

    batch = [sym]
    try:
        universe = list_symbols()
        if sym in universe:
            i = universe.index(sym)
            batch = universe[i : i + _READAHEAD]
    except Exception as e:  # read-ahead is an optimisation, never a hard failure
        log.debug(f"[ohlcv] read-ahead skipped for {sym}: {e}")

    found = get_many(batch)
    df = found.get(sym)
    return df.copy() if df is not None else pd.DataFrame()


# ── Writes ────────────────────────────────────────────────────────────────────


def upsert_frame(df: pd.DataFrame) -> int:
    """Replace stored history for every symbol present in `df`.

    Whole-symbol replacement rather than per-bar append: the existing download
    path already merges, validates and de-duplicates a complete frame, so the
    store just persists the result. Returns the number of symbols written.
    """
    from pymongo import ReplaceOne

    cols = {c.lower(): c for c in df.columns}
    ops = [
        ReplaceOne({"_id": str(sym).upper()}, encode(str(sym).upper(), g), upsert=True)
        for sym, g in df.groupby(cols["symbol"])
    ]
    if not ops:
        return 0
    written = 0
    for i in range(0, len(ops), 200):  # modest batches: M0 is shared
        res = _coll().bulk_write(ops[i : i + 200], ordered=False)
        written += res.upserted_count + res.modified_count
    # Evict only what changed — see `invalidate()` for why this is not clear_cache().
    invalidate(str(s).upper() for s in df[cols["symbol"]].unique())
    return len(ops)


def stats() -> dict:
    """Row/symbol counts and freshness, for health checks and the migration
    verifier."""
    c = _coll()
    n_syms = c.count_documents({})
    agg = list(
        c.aggregate(
            [
                {
                    "$group": {
                        "_id": None,
                        "bars": {"$sum": "$n"},
                        "newest": {"$max": "$end"},
                        "oldest": {"$min": "$start"},
                    }
                }
            ]
        )
    )
    a = agg[0] if agg else {}
    return {
        "symbols": n_syms,
        "bars": a.get("bars", 0),
        "oldest": a.get("oldest"),
        "newest": a.get("newest"),
    }
