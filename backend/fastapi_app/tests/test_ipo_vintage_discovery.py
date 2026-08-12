"""
Regression test for discover_ipo_listings() / run_ipo_vintage_study() reading
the OHLCV universe through the backend-agnostic accessors (get_cached_symbols /
load_stock_dataframe) instead of the CSV-only `_IN_MEMORY_STOCK_CACHE` global.

That global stays permanently empty under the Mongo OHLCV backend (which
production actually runs — render.yaml sets OHLCV_BACKEND=mongo), which
silently disabled auto-discovery of new IPO listings. This test proves the
fix by monkeypatching the same two accessor functions every other caller
(the Scan Coordinator, scanners) already goes through, so it passes
regardless of which backend is active — and would have failed against the
pre-fix code, since that code never called these functions at all.
"""

from __future__ import annotations

import asyncio

import pandas as pd

import services.ohlc_downloader as ohlc
from engines.strategies.runner import discover_ipo_listings

# ── Minimal fake async Mongo, only the subset discover_ipo_listings() calls ──


class _AsyncCursor:
    def __init__(self, items):
        self._items = list(items)

    def __aiter__(self):
        return self

    async def __anext__(self):
        if not self._items:
            raise StopAsyncIteration
        return self._items.pop(0)


class FakeIpoListingsCollection:
    def __init__(self, existing=None):
        self.docs: dict[str, dict] = {d["symbol"]: d for d in (existing or [])}
        self.upserts: list[dict] = []

    def find(self, query=None, projection=None):
        return _AsyncCursor(list(self.docs.values()))

    async def update_one(self, query, update, upsert=False):
        doc = update["$set"]
        self.docs[doc["symbol"]] = doc
        self.upserts.append(doc)


class FakeDB:
    def __init__(self, collection: FakeIpoListingsCollection):
        self._collection = collection

    def get_collection(self, name: str):
        assert name == "ipo_listings"
        return self._collection


# ── Synthetic universe ────────────────────────────────────────────────────────


def _frame(first: str, last: str) -> pd.DataFrame:
    """Two-bar frame — only iloc[0]/iloc[-1] are read by discover_ipo_listings."""
    return pd.DataFrame(
        {
            "Date": pd.to_datetime([first, last]),
            "Open": [100.0, 100.0],
            "High": [101.0, 101.0],
            "Low": [99.0, 99.0],
            "Close": [100.0, 100.0],
            "Volume": [1000, 1000],
        }
    )


UNIVERSE = {
    # Old stock clipped by the ~5yr window start — must NOT be treated as a
    # new listing.
    "OLDCO": _frame("2020-01-01", "2026-08-01"),
    # Genuinely recent listing — first bar sits well after the window start
    # and well within MAX_LISTING_AGE_DAYS of the universe's latest bar.
    "NEWCO": _frame("2026-06-01", "2026-08-01"),
    # Benchmark index — must be skipped regardless (symbol starts with "^").
    "^NSEI": _frame("2020-01-01", "2026-08-01"),
}


def test_discover_ipo_listings_uses_backend_agnostic_accessors(monkeypatch):
    """Proves discover_ipo_listings() reads through get_cached_symbols() /
    load_stock_dataframe() — the same accessors that work under both the CSV
    and Mongo OHLCV backends — rather than the CSV-only in-memory global."""

    monkeypatch.setattr(ohlc, "get_cached_symbols", lambda: list(UNIVERSE.keys()))
    monkeypatch.setattr(
        ohlc, "load_stock_dataframe", lambda sym: UNIVERSE.get(sym, pd.DataFrame())
    )

    # Sabotage the old CSV-only path so a regression back to reading it
    # directly would be caught immediately (empty cache -> "cannot
    # auto-detect listings" -> 0 added, silently NOT the assertion below).
    monkeypatch.setattr(ohlc, "_IN_MEMORY_STOCK_CACHE", {})

    collection = FakeIpoListingsCollection()
    db = FakeDB(collection)

    added = asyncio.run(discover_ipo_listings(db))

    assert added == 1, "exactly NEWCO should be auto-detected as a new listing"
    assert "NEWCO" in collection.docs
    assert "OLDCO" not in collection.docs
    assert "^NSEI" not in collection.docs
    assert collection.docs["NEWCO"]["source"] == "auto"
    assert collection.docs["NEWCO"]["listing_date"] == "2026-06-01"


def test_discover_ipo_listings_never_overwrites_a_manual_entry(monkeypatch):
    """A human-entered listing_date (source="manual") must survive rediscovery."""

    monkeypatch.setattr(ohlc, "get_cached_symbols", lambda: list(UNIVERSE.keys()))
    monkeypatch.setattr(
        ohlc, "load_stock_dataframe", lambda sym: UNIVERSE.get(sym, pd.DataFrame())
    )
    monkeypatch.setattr(ohlc, "_IN_MEMORY_STOCK_CACHE", {})

    collection = FakeIpoListingsCollection(
        existing=[
            {
                "symbol": "NEWCO",
                "company_name": "New Co Ltd",
                "listing_date": "2026-05-15",  # human-corrected date
                "source": "manual",
            }
        ]
    )
    db = FakeDB(collection)

    added = asyncio.run(discover_ipo_listings(db))

    assert added == 0, "a manual entry must never be reclassified as auto"
    assert collection.docs["NEWCO"]["source"] == "manual"
    assert collection.docs["NEWCO"]["listing_date"] == "2026-05-15"


def test_discover_ipo_listings_returns_zero_on_empty_universe(monkeypatch):
    monkeypatch.setattr(ohlc, "get_cached_symbols", lambda: [])
    db = FakeDB(FakeIpoListingsCollection())
    added = asyncio.run(discover_ipo_listings(db))
    assert added == 0
