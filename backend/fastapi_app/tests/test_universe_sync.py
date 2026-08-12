"""
Phase 3 — Mainboard Universe Sync tests.

Classification tests run against tests/fixtures/upstox_instrument_master_sample.json
— a small, real (live-fetched, then trimmed) slice of the actual Upstox NSE
instrument master, covering every case that matters: EQ/BE/BZ (mainboard),
SM/ST (SME — must never be added), SG (sovereign gold bonds — not equity),
a mutual-fund ISIN tagged EQ (must still be excluded), and rows from other
segments entirely (NSE_FO/NSE_COM/NSE_INDEX). No live network calls.

Orchestration tests (idempotency, dedup, bootstrap-doesn't-backfill, manual
entries preserved, failed fetch doesn't corrupt the universe) use a fake
Mongo double (reusing test_orchestration.py's FakeDB/FakeCollection, which
already implements the subset of the motor async API these modules call)
and a temp-directory CSV, so nothing touches a real database or the real
universe file.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pandas as pd
import pytest

import services.universe_sync as usync
from services.universe_sync import (
    MAINBOARD_SERIES,
    SME_SERIES,
    ListingClass,
    classify_upstox_row,
    run_universe_sync,
)
from tests.test_orchestration import FakeDB

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "upstox_instrument_master_sample.json"


def load_fixture_df() -> pd.DataFrame:
    with open(FIXTURE_PATH, encoding="utf-8") as f:
        rows = json.load(f)
    return pd.DataFrame(rows)


# ── 1. Classification (per-code, from real data) ──────────────────────────


@pytest.mark.parametrize("series", sorted(MAINBOARD_SERIES))
def test_mainboard_series_codes_accepted(series):
    assert classify_upstox_row("NSE_EQ", series) == ListingClass.MAINBOARD


@pytest.mark.parametrize("series", sorted(SME_SERIES))
def test_sme_series_codes_rejected(series):
    assert classify_upstox_row("NSE_EQ", series) == ListingClass.SME


def test_unknown_series_rejected_and_would_be_logged():
    assert classify_upstox_row("NSE_EQ", "SG") == ListingClass.UNKNOWN
    assert classify_upstox_row("NSE_EQ", "XX_NEVER_SEEN") == ListingClass.UNKNOWN


def test_non_nse_eq_segment_never_classified_as_mainboard_or_sme():
    for seg in ("NSE_FO", "NSE_COM", "NSE_INDEX"):
        assert classify_upstox_row(seg, "EQ") == ListingClass.UNKNOWN


def test_classify_master_against_real_fixture_matches_expected_buckets():
    """End-to-end classification pass over the real fixture rows."""
    df = load_fixture_df()
    result = usync._classify_master(df, classify_upstox_row)

    mainboard_symbols = set(result["mainboard"]["trading_symbol"])
    assert {"RELIANCE", "TCS", "INFY", "HDFCBANK"} <= mainboard_symbols  # EQ
    assert {"TRANSPEK", "VELJAN", "JOCIL"} <= mainboard_symbols  # BE
    assert {"SANWARIA", "SUPREMEENG"} <= mainboard_symbols  # BZ

    # SME must never appear in the mainboard bucket.
    assert "AMBANIORGO" not in mainboard_symbols
    assert "APRAMEYA" not in mainboard_symbols
    assert "KCK" not in mainboard_symbols
    assert "PRIZOR" not in mainboard_symbols
    assert result["sme_count"] >= 6  # 3 SM + 3 ST fixture rows

    # Mutual-fund ISIN tagged EQ must still be excluded despite instrument_type=="EQ".
    assert "SMALLIETF" not in mainboard_symbols
    assert "CHEMICAL" not in mainboard_symbols

    # Sovereign gold bonds (SG) are non-equity and must be excluded.
    assert "SG" in result["unknown_series_sample"]


# ── 2. Orchestration (fake DB, temp CSV, no network) ──────────────────────


def _patch_fetch(monkeypatch, df: pd.DataFrame):
    monkeypatch.setattr(usync, "fetch_instrument_master", lambda: df)


def _patch_csv_path(monkeypatch, tmp_path: Path) -> Path:
    csv_path = tmp_path / "upstox_nse_stock_list.csv"
    monkeypatch.setattr(
        usync, "get_downloader_paths", lambda: {"symbols_csv": str(csv_path)}
    )
    return csv_path


def test_bootstrap_run_does_not_backfill_existing_be_bz(monkeypatch, tmp_path):
    """First run ever must seed the baseline and add NOTHING — this is what
    prevents an unexpected mass-import of the pre-existing ~278 BE/BZ stocks
    the first time Sync runs."""
    _patch_fetch(monkeypatch, load_fixture_df())
    _patch_csv_path(monkeypatch, tmp_path)
    db = FakeDB()

    report = asyncio.run(run_universe_sync(db))

    assert report["bootstrap"] is True
    assert report["newly_added_symbols"] == []
    assert report["mainboard_total"] >= 9  # 4 EQ + 3 BE + 2 BZ in the fixture
    assert report["sme_excluded"] >= 6
    assert report["csv_rows_after"] == 0  # nothing added, CSV stays empty


def test_second_run_with_no_new_listings_adds_nothing(monkeypatch, tmp_path):
    _patch_fetch(monkeypatch, load_fixture_df())
    _patch_csv_path(monkeypatch, tmp_path)
    db = FakeDB()

    asyncio.run(run_universe_sync(db))  # bootstrap
    report2 = asyncio.run(run_universe_sync(db))  # same snapshot again

    assert report2["bootstrap"] is False
    assert report2["newly_added_symbols"] == []
    assert report2["newly_discovered_isins"] == []


def test_newly_discovered_mainboard_symbol_gets_added(monkeypatch, tmp_path):
    """A symbol NOT present in the first snapshot, present in the second,
    must be detected and added — the actual "new IPO appears" scenario."""
    fixture = load_fixture_df()
    _patch_csv_path(monkeypatch, tmp_path)
    db = FakeDB()

    _patch_fetch(monkeypatch, fixture)
    asyncio.run(run_universe_sync(db))  # bootstrap on the baseline fixture

    new_ipo_row = {
        "segment": "NSE_EQ",
        "name": "BRAND NEW MAINBOARD IPO LTD",
        "instrument_type": "EQ",
        "instrument_key": "NSE_EQ|INE_NEWIPO_TEST",
        "isin": "INE_NEWIPO_TEST",
        "trading_symbol": "NEWIPOTEST",
        "exchange": "NSE",
    }
    with_new_ipo = pd.concat(
        [fixture, pd.DataFrame([new_ipo_row])], ignore_index=True
    )
    _patch_fetch(monkeypatch, with_new_ipo)
    report2 = asyncio.run(run_universe_sync(db))

    assert report2["bootstrap"] is False
    assert "NEWIPOTEST" in report2["newly_added_symbols"]
    assert report2["csv_rows_after"] == 1


def test_new_sme_listing_is_never_added_even_after_bootstrap(monkeypatch, tmp_path):
    """The SME-exclusion counterpart to the mainboard-detection test above —
    a brand-new SME listing appearing in a later snapshot must still never
    be added to the universe."""
    fixture = load_fixture_df()
    _patch_csv_path(monkeypatch, tmp_path)
    db = FakeDB()

    _patch_fetch(monkeypatch, fixture)
    asyncio.run(run_universe_sync(db))  # bootstrap

    new_sme_row = {
        "segment": "NSE_EQ",
        "name": "BRAND NEW SME IPO LTD",
        "instrument_type": "SM",
        "instrument_key": "NSE_EQ|INE_NEWSME_TEST",
        "isin": "INE_NEWSME_TEST",
        "trading_symbol": "NEWSMETEST",
        "exchange": "NSE",
    }
    with_new_sme = pd.concat([fixture, pd.DataFrame([new_sme_row])], ignore_index=True)
    _patch_fetch(monkeypatch, with_new_sme)
    report2 = asyncio.run(run_universe_sync(db))

    assert "NEWSMETEST" not in report2["newly_added_symbols"]
    assert report2["csv_rows_after"] == 0


def test_duplicate_symbol_not_duplicated_across_runs(monkeypatch, tmp_path):
    fixture = load_fixture_df()
    _patch_csv_path(monkeypatch, tmp_path)
    db = FakeDB()

    _patch_fetch(monkeypatch, fixture)
    asyncio.run(run_universe_sync(db))  # bootstrap

    new_ipo_row = {
        "segment": "NSE_EQ",
        "name": "BRAND NEW MAINBOARD IPO LTD",
        "instrument_type": "EQ",
        "instrument_key": "NSE_EQ|INE_NEWIPO_TEST",
        "isin": "INE_NEWIPO_TEST",
        "trading_symbol": "NEWIPOTEST",
        "exchange": "NSE",
    }
    with_new_ipo = pd.concat([fixture, pd.DataFrame([new_ipo_row])], ignore_index=True)
    _patch_fetch(monkeypatch, with_new_ipo)

    report_a = asyncio.run(run_universe_sync(db))  # discovers + adds it
    report_b = asyncio.run(run_universe_sync(db))  # same snapshot again — idempotent
    report_c = asyncio.run(run_universe_sync(db))  # and again

    assert report_a["csv_rows_after"] == 1
    assert report_b["csv_rows_after"] == 1
    assert report_c["csv_rows_after"] == 1
    assert report_b["newly_added_symbols"] == []
    assert report_c["newly_added_symbols"] == []


def test_manual_or_preexisting_csv_entries_are_never_modified(monkeypatch, tmp_path):
    """A row already in the universe CSV before Sync ever runs (e.g. hand-
    edited, or from the manual refresh_upstox_symbols.py script) must survive
    byte-for-byte — Sync is purely additive."""
    csv_path = _patch_csv_path(monkeypatch, tmp_path)
    pd.DataFrame(
        [
            {
                "instrument_key": "NSE_EQ|INE_HANDMADE",
                "trading_symbol": "HANDMADE",
                "isin": "INE_HANDMADE",
                "company_name": "Hand Maintained Entry Ltd (do not touch)",
                "exchange": "NSE",
                "segment": "NSE_EQ",
            }
        ]
    ).to_csv(csv_path, index=False)
    before = pd.read_csv(csv_path)

    fixture = load_fixture_df()
    _patch_fetch(monkeypatch, fixture)
    db = FakeDB()
    report = asyncio.run(run_universe_sync(db))  # bootstrap, adds nothing

    after = pd.read_csv(csv_path)
    pd.testing.assert_frame_equal(before, after)
    assert report["existing_entries_unchanged"] is True


def test_failed_upstox_fetch_does_not_corrupt_existing_universe(monkeypatch, tmp_path):
    csv_path = _patch_csv_path(monkeypatch, tmp_path)
    pd.DataFrame(
        [
            {
                "instrument_key": "NSE_EQ|INE_EXISTING",
                "trading_symbol": "EXISTING",
                "isin": "INE_EXISTING",
                "company_name": "Existing Co Ltd",
                "exchange": "NSE",
                "segment": "NSE_EQ",
            }
        ]
    ).to_csv(csv_path, index=False)
    before_bytes = csv_path.read_bytes()

    def _boom():
        raise RuntimeError("simulated Upstox outage")

    monkeypatch.setattr(usync, "fetch_instrument_master", _boom)
    db = FakeDB()

    report = asyncio.run(run_universe_sync(db))

    assert report["error"] == "simulated Upstox outage"
    assert csv_path.read_bytes() == before_bytes  # untouched
    assert db.store.get(usync.STATE_COLLECTION, []) == []  # state never written


def test_dry_run_reports_without_writing_anything(monkeypatch, tmp_path):
    csv_path = _patch_csv_path(monkeypatch, tmp_path)
    fixture = load_fixture_df()
    _patch_fetch(monkeypatch, fixture)
    db = FakeDB()

    report = asyncio.run(run_universe_sync(db, dry_run=True))

    assert report["dry_run"] is True
    assert not csv_path.exists()  # dry run never writes the CSV
    assert db.store.get(usync.STATE_COLLECTION, []) == []  # nor Mongo state
