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


def test_discover_ipo_listings_excludes_bse_first_listings(monkeypatch):
    """A company that traded on BSE prior to listing on NSE must be marked
    with is_fresh_ipo=False and excluded from the fresh IPO count."""
    universe = {
        "OLDCO": _frame("2020-01-01", "2026-08-01"),
        "FRESH_IPO": _frame("2026-06-01", "2026-08-01"),
        "BSE_FIRST": _frame("2026-06-01", "2026-08-01"),
    }
    monkeypatch.setattr(ohlc, "get_cached_symbols", lambda: list(universe.keys()))
    monkeypatch.setattr(
        ohlc, "load_stock_dataframe", lambda sym: universe.get(sym, pd.DataFrame())
    )
    monkeypatch.setattr(ohlc, "_IN_MEMORY_STOCK_CACHE", {})

    # Mock check_bse_trading_prior_to
    from engines.strategies import runner

    def fake_bse_check(isin, nse_date, fetch_fn=None, symbol=None, **kwargs):
        if "BSE_FIRST" in str(symbol) or "BSE_FIRST" in str(isin):
            return True, 500, "2018-01-01"
        return False, 0, None

    monkeypatch.setattr(runner, "check_bse_trading_prior_to", fake_bse_check)

    collection = FakeIpoListingsCollection()
    db = FakeDB(collection)

    added = asyncio.run(discover_ipo_listings(db))

    # Only FRESH_IPO is counted as a fresh IPO addition
    assert added == 1
    assert collection.docs["FRESH_IPO"]["is_fresh_ipo"] is True
    assert collection.docs["BSE_FIRST"]["is_fresh_ipo"] is False
    assert collection.docs["BSE_FIRST"]["bse_first_date"] == "2018-01-01"
    assert collection.docs["BSE_FIRST"]["bse_prior_bars"] == 500


def test_check_bse_trading_prior_to_helper():
    """Direct unit test of check_bse_trading_prior_to helper."""
    from engines.strategies.runner import check_bse_trading_prior_to

    # 1. Invalid or non-INE ISIN
    assert check_bse_trading_prior_to("", pd.Timestamp("2024-01-01")) == (
        False,
        0,
        None,
    )
    assert check_bse_trading_prior_to("INF123456", pd.Timestamp("2024-01-01")) == (
        False,
        0,
        None,
    )

    # 2. Fresh IPO (BSE returns empty dataframe before NSE listing)
    def mock_fetch_empty(key, start, end):
        return pd.DataFrame()

    has_prior, count, earliest = check_bse_trading_prior_to(
        "INE123456789", pd.Timestamp("2024-01-15"), fetch_fn=mock_fetch_empty
    )
    assert has_prior is False
    assert count == 0
    assert earliest is None

    # 3. BSE-first listing (BSE returns historical bars)
    def mock_fetch_bse_history(key, start, end):
        return pd.DataFrame(
            {
                "date": [pd.Timestamp("2018-05-10"), pd.Timestamp("2023-12-01")],
                "close": [150.0, 320.0],
            }
        )

    has_prior, count, earliest = check_bse_trading_prior_to(
        "INE987654321", pd.Timestamp("2024-01-15"), fetch_fn=mock_fetch_bse_history
    )
    assert has_prior is True
    assert count == 2
    assert earliest == "2018-05-10"

