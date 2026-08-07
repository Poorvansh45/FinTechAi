"""
MongoDB OHLCV store — encoding fidelity and cache behaviour.

No MongoDB required: the collection is replaced with an in-memory double, so
these run in CI exactly as the other suites do.

The load-bearing test is `test_round_trip_is_bit_exact`. float32 storage was
measured to move LaunchPad's historical FVG win-rate by 1.1% and avg-loss by
4.8% on NATIONALUM — a threshold-crossing effect in the backtest, not drift.
float64 makes the round-trip lossless, so scanner output is identical to the
CSV path. If someone "optimises" the dtype later, this fails.
"""

import numpy as np
import pandas as pd
import pytest

from services import ohlcv_store as store


# ── In-memory stand-in for the collection ────────────────────────────────────

class FakeCollection:
    def __init__(self):
        self.docs: dict[str, dict] = {}
        self.find_calls = 0          # round-trips, for the batching assertions

    def find(self, query=None, projection=None):
        self.find_calls += 1
        query = query or {}
        ids = query.get("_id")
        if isinstance(ids, dict) and "$in" in ids:
            out = [self.docs[i] for i in ids["$in"] if i in self.docs]
        elif isinstance(ids, str):
            out = [self.docs[ids]] if ids in self.docs else []
        else:
            out = list(self.docs.values())
        if projection:
            keep = set(projection) | {"_id"}
            out = [{k: v for k, v in d.items() if k in keep} for d in out]
        return _Cursor(out)

    def find_one(self, query):
        got = list(self.find(query))
        return got[0] if got else None

    def count_documents(self, _):
        return len(self.docs)

    def bulk_write(self, ops, ordered=True):
        for op in ops:
            doc = getattr(op, "_doc", None) or op._replacement
            self.docs[doc["_id"]] = doc
        return _BulkResult(len(ops))


class _BulkResult:
    def __init__(self, n):
        self.upserted_count = n
        self.modified_count = 0


class _Cursor:
    def __init__(self, items):
        self.items = items

    def sort(self, key, direction=1):
        self.items.sort(key=lambda d: d.get(key), reverse=direction < 0)
        return self

    def __iter__(self):
        return iter(self.items)


def make_frame(symbol="TEST", n=300, seed=0):
    """A frame shaped exactly like the CSV loader produces."""
    rng = np.random.default_rng(seed)
    close = 100 + np.cumsum(rng.normal(0, 2, n))
    close = np.abs(close) + 1.0
    return pd.DataFrame({
        "Symbol": symbol,
        "Date": pd.date_range("2021-01-01", periods=n, freq="D"),
        "Open": close * 1.001,
        "High": close * 1.02,
        "Low": close * 0.98,
        "Close": close,
        # spans the range where float32 would silently corrupt (>16.7M)
        "Volume": rng.integers(1_000, 1_800_000_000, n).astype(np.int64),
    })


@pytest.fixture
def coll(monkeypatch):
    c = FakeCollection()
    monkeypatch.setattr(store, "_coll", lambda: c)
    store.clear_cache()
    yield c
    store.clear_cache()


# ── Encoding fidelity ────────────────────────────────────────────────────────

def test_round_trip_is_bit_exact():
    """float64 storage must be lossless — exact equality, not a tolerance."""
    df = make_frame(n=500)
    got = store.decode(store.encode("TEST", df))

    for col in ("Open", "High", "Low", "Close"):
        assert np.array_equal(df[col].to_numpy(np.float64),
                              got[col].to_numpy(np.float64)), f"{col} not bit-exact"
    assert np.array_equal(df["Volume"].to_numpy(np.int64),
                          got["Volume"].to_numpy(np.int64))
    assert (df["Date"].to_numpy("datetime64[D]")
            == got["Date"].to_numpy("datetime64[D]")).all()


def test_large_volumes_survive():
    """The full CSV's max is 1,807,991,128. float32 would corrupt anything above
    16.7M, which is most liquid stocks."""
    df = make_frame(n=10)
    df["Volume"] = np.array([1_807_991_128, 2_000_000_000, 16_777_217, 0,
                             1, 999_999_999, 123, 4_000_000_000,
                             1_500_000_000, 42], dtype=np.int64)
    got = store.decode(store.encode("BIGVOL", df))
    assert np.array_equal(df["Volume"].to_numpy(np.int64),
                          got["Volume"].to_numpy(np.int64))


def test_decoded_columns_match_csv_loader_contract():
    """Callers were written against load_stock_dataframe()'s capitalised columns."""
    got = store.decode(store.encode("TEST", make_frame()))
    assert list(got.columns) == ["Symbol", "Date", "Open", "High", "Low", "Close", "Volume"]
    assert (got["Symbol"] == "TEST").all()


def test_encode_accepts_lowercase_columns():
    """The CSV path hands over lowercase names; the provider path capitalises."""
    df = make_frame().rename(columns=str.lower)
    got = store.decode(store.encode("TEST", df))
    assert len(got) == len(df)
    assert np.array_equal(got["Close"].to_numpy(), df["close"].to_numpy())


def test_encode_sorts_by_date():
    df = make_frame(n=50).sample(frac=1, random_state=3)   # shuffled
    got = store.decode(store.encode("TEST", df))
    assert got["Date"].is_monotonic_increasing


def test_metadata_fields():
    df = make_frame(n=120)
    doc = store.encode("TEST", df)
    assert doc["_id"] == "TEST" and doc["n"] == 120
    assert doc["start"] == df["Date"].iloc[0].to_pydatetime()
    assert doc["end"] == df["Date"].iloc[-1].to_pydatetime()


# ── Reads ────────────────────────────────────────────────────────────────────

def test_get_symbol_returns_empty_when_absent(coll):
    assert store.get_symbol("NOPE").empty


def test_get_symbol_reads_and_caches(coll):
    coll.docs["AAA"] = store.encode("AAA", make_frame("AAA"))
    first = store.get_symbol("AAA")
    calls = coll.find_calls
    second = store.get_symbol("AAA")
    assert len(first) == len(second)
    assert coll.find_calls == calls, "second read should be served from cache"


def test_caller_cannot_mutate_the_cache(coll):
    """get_symbol hands out copies — a scanner mutating its frame must not
    poison the next caller."""
    coll.docs["AAA"] = store.encode("AAA", make_frame("AAA"))
    a = store.get_symbol("AAA")
    a.loc[0, "Close"] = -12345.0
    assert store.get_symbol("AAA").loc[0, "Close"] != -12345.0


def test_read_ahead_batches_a_sequential_walk(coll):
    """The access pattern every scan loop uses. Unbatched this was measured at
    116 ms/symbol (256 s per scan) versus 6.7 ms batched."""
    syms = [f"S{i:03d}" for i in range(120)]
    for s in syms:
        coll.docs[s] = store.encode(s, make_frame(s, n=60))
    store.clear_cache()

    for s in syms:
        assert not store.get_symbol(s).empty
    # 120 symbols at a 50-wide read-ahead is a handful of round-trips, not 120.
    assert coll.find_calls <= 12, f"expected batched reads, got {coll.find_calls}"


def test_lru_is_bounded(coll):
    for i in range(store._CACHE_MAX + 80):
        s = f"X{i:04d}"
        coll.docs[s] = store.encode(s, make_frame(s, n=30))
    store.clear_cache()
    for s in sorted(coll.docs):
        store.get_symbol(s)
    assert store.cache_stats()["cached_symbols"] <= store._CACHE_MAX


def test_get_many_single_round_trip(coll):
    syms = [f"M{i}" for i in range(20)]
    for s in syms:
        coll.docs[s] = store.encode(s, make_frame(s, n=40))
    store.clear_cache()
    before = coll.find_calls
    got = store.get_many(syms)
    assert len(got) == 20
    assert coll.find_calls - before == 1


def test_clear_cache_forces_a_refetch(coll):
    coll.docs["AAA"] = store.encode("AAA", make_frame("AAA"))
    store.get_symbol("AAA")
    store.clear_cache()
    before = coll.find_calls
    store.get_symbol("AAA")
    assert coll.find_calls > before


def test_list_symbols_is_sorted(coll):
    for s in ("ZED", "ALPHA", "MID"):
        coll.docs[s] = store.encode(s, make_frame(s, n=10))
    assert store.list_symbols() == ["ALPHA", "MID", "ZED"]


# ── Invalidation ─────────────────────────────────────────────────────────────

def test_invalidate_evicts_only_the_named_symbol(coll):
    for s in ("AAA", "BBB"):
        coll.docs[s] = store.encode(s, make_frame(s, n=40))
    store.get_symbol("AAA")
    store.get_symbol("BBB")
    store.invalidate(["AAA"])
    cached = set(store._cache)
    assert "AAA" not in cached and "BBB" in cached


def test_invalidate_keeps_the_universe_for_a_known_symbol(coll):
    """The regression guard for the daily refresh. Dropping the universe on
    every upsert forced a full rescan per symbol — measured at 0.89 s each,
    ~32 minutes across a refresh."""
    for s in ("AAA", "BBB", "CCC"):
        coll.docs[s] = store.encode(s, make_frame(s, n=40))
    store.list_symbols()
    before = coll.find_calls
    store.invalidate(["AAA"])
    store.list_symbols()
    assert coll.find_calls == before, "universe should not need refetching"


def test_invalidate_drops_the_universe_for_an_unknown_symbol(coll):
    """A newly listed IPO must show up, so an unseen symbol does invalidate."""
    coll.docs["AAA"] = store.encode("AAA", make_frame("AAA", n=40))
    store.list_symbols()
    store.invalidate(["BRANDNEW"])
    assert store._universe == []


def test_daily_refresh_pattern_does_not_rescan_per_symbol(coll):
    """get_symbol -> upsert_frame, repeated, is exactly what the download loop
    does. It must not degrade into one full collection scan per symbol."""
    syms = [f"D{i:03d}" for i in range(60)]
    for s in syms:
        coll.docs[s] = store.encode(s, make_frame(s, n=40))
    store.clear_cache()
    store.list_symbols()
    before = coll.find_calls
    for s in syms:
        df = store.get_symbol(s)
        store.upsert_frame(df.rename(columns={
            "Symbol": "symbol", "Date": "date", "Open": "open", "High": "high",
            "Low": "low", "Close": "close", "Volume": "volume"}))
    assert coll.find_calls - before <= 8, (
        f"{coll.find_calls - before} reads for 60 symbols — cache is thrashing")


# ── Connection handling ──────────────────────────────────────────────────────

def test_client_init_is_thread_safe(monkeypatch):
    """Two threads racing the lazy init used to build two MongoClients, leaking
    the loser's socket pool against M0's 500-connection ceiling."""
    import threading

    store.close()
    built = []

    class FakeClient:
        def __init__(self, *a, **k):
            built.append(1)

        def get_default_database(self, _):
            return {store.COLLECTION: object()}

        def close(self):
            pass

    import pymongo
    monkeypatch.setattr(pymongo, "MongoClient", FakeClient)

    barrier = threading.Barrier(8)

    def go():
        barrier.wait()
        store._coll()

    threads = [threading.Thread(target=go) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(built) == 1, f"{len(built)} clients built — lazy init is racy"
    store.close()


def test_close_is_idempotent():
    store.close()
    store.close()          # must not raise on an already-closed client
