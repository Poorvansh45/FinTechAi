"""
FinAI Edge — Mainboard Universe Sync
======================================
Automatically keeps the scanner universe current with newly-listed NSE
MAINBOARD stocks. NEVER adds SME (NSE Emerge) listings.

WHY THIS EXISTS
----------------
`scripts/refresh_upstox_symbols.py` builds `upstox_nse_stock_list.csv` (the
Download stage's symbol list — see services/ohlc_downloader.py), but it is
run manually, "on demand / periodically... NOT on every scan" (its own
docstring). A newly-listed IPO never enters the universe until someone
remembers to rerun it by hand. This module closes that gap, on the existing
daily scheduler (schedulers/daily_refresh.py), with no manual step.

CLASSIFICATION — VERIFIED, NOT ASSUMED
----------------------------------------
Upstox's public instrument master exposes `instrument_type`, which was
confirmed (by inspecting live data, then cross-checking against NSE's own
official EQUITY_L.csv archive — https://nsearchives.nseindia.com/content/
equities/EQUITY_L.csv) to be NSE's own SERIES code, republished verbatim:
    EQ / BE / BZ  -> mainboard  (counts matched NSE's official file exactly:
                                  BE=250, BZ=28)
    SM / ST       -> SME (NSE Emerge)      -- e.g. "Ambani Orgochem", "KCK
                                               Industries" — never mainboard
Anything else (SG = sovereign gold bonds, index/derivative rows, an
unrecognised future series code) is excluded and logged — fail-safe, never
silently added.

`classify_upstox_row()` is intentionally a small, pure, swappable function:
if Upstox ever drops/changes this field, a differently-sourced classifier
(e.g. reading NSE's own EQUITY_L.csv/SME_EQUITY_L.csv SERIES column
directly) can be substituted via the `classifier` parameter of
`run_universe_sync()` without touching the sync orchestration below it.

WHY STATE LIVES IN MONGO, NOT THE CSV
----------------------------------------
`upstox_nse_stock_list.csv` is a git-tracked file. On Render's ephemeral
filesystem it reverts to the committed version on every redeploy — writing
new symbols into it alone would silently lose them at the next deploy. The
durable source of truth is therefore a small Mongo document
(`universe_sync_state`, `_id="mainboard_universe_sync"`) holding
`auto_added` (every symbol Sync has ever decided belongs in the universe)
and `seen_isins` (every ISIN ever classified, mainboard or not — used only
to detect "first time ever observed" for logging/reporting). Every run
re-ensures the CSV contains everything in `auto_added`, which self-heals
after any redeploy, and re-derives `newly discovered` purely from
`seen_isins`, which does not reset.

WHY THE PRE-EXISTING ~278 BE/BZ STOCKS ARE NOT BACKFILLED
--------------------------------------------------------------
The current universe CSV was built with a narrower `instrument_type=="EQ"`
filter and has never included BE/BZ mainboard stocks. Naively diffing
"mainboard-eligible now" against "in the CSV now" would try to add all
~278 of them the first time this runs — an unrequested, large, unexpected
universe expansion. Instead, the FIRST run ever (no `universe_sync_state`
doc exists) seeds `seen_isins` with every ISIN classified that run —
including all existing BE/BZ stocks — and adds NOTHING to the universe.
Only ISINs that appear in some LATER run, not present in `seen_isins` at
that time, are genuinely new listings and get added.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from datetime import datetime, timezone
from enum import Enum
from typing import Any

import pandas as pd

from scripts.refresh_upstox_symbols import OUTPUT_COLUMNS, fetch_instrument_master
from services.ohlc_downloader import get_downloader_paths

log = logging.getLogger("finai_edge.universe_sync")

STATE_COLLECTION = "universe_sync_state"
STATE_DOC_ID = "mainboard_universe_sync"


class ListingClass(str, Enum):
    MAINBOARD = "mainboard"
    SME = "sme"
    UNKNOWN = "unknown"


# Verified against NSE's own official EQUITY_L.csv (BE=250, BZ=28 — exact
# match) and by inspecting real company names under each code — see module
# docstring.
MAINBOARD_SERIES: frozenset[str] = frozenset({"EQ", "BE", "BZ"})
SME_SERIES: frozenset[str] = frozenset({"SM", "ST"})

ClassifierFn = Callable[[str, str], ListingClass]


def classify_upstox_row(segment: str, instrument_type: str) -> ListingClass:
    """Deterministic, verified mainboard/SME classifier for one Upstox
    instrument-master row. Pure function of (segment, instrument_type) —
    the swappable seam described in the module docstring."""
    if segment != "NSE_EQ":
        return ListingClass.UNKNOWN
    if instrument_type in MAINBOARD_SERIES:
        return ListingClass.MAINBOARD
    if instrument_type in SME_SERIES:
        return ListingClass.SME
    return ListingClass.UNKNOWN


# ── Classification pass over the instrument master ─────────────────────────


def _classify_master(
    master_df: pd.DataFrame, classifier: ClassifierFn
) -> dict[str, Any]:
    """Splits the full instrument master into mainboard / sme / unknown,
    applying the same mutual-fund-ISIN exclusion refresh_upstox_symbols.py
    already uses (INF-prefixed ISINs are mutual fund units, not equities)."""
    nse_eq = master_df[master_df["segment"] == "NSE_EQ"].copy()

    classes = [
        classifier(row["segment"], row["instrument_type"])
        for _, row in nse_eq.iterrows()
    ]
    nse_eq["_class"] = classes

    is_fund = nse_eq["isin"].astype(str).str.startswith("INF", na=False)

    mainboard = nse_eq[(nse_eq["_class"] == ListingClass.MAINBOARD) & ~is_fund].copy()
    sme = nse_eq[nse_eq["_class"] == ListingClass.SME]
    unknown = nse_eq[(nse_eq["_class"] == ListingClass.UNKNOWN) | is_fund]

    mainboard["company_name"] = (
        mainboard["name"]
        .fillna("")
        .astype(str)
        .str.strip()
        .replace("", pd.NA)
        .fillna(mainboard["trading_symbol"])
    )
    mainboard["exchange"] = "NSE"

    unknown_series_sample = sorted(
        {
            str(v)
            for v in unknown.loc[~is_fund, "instrument_type"].unique()
            if pd.notna(v)
        }
    )[:10]

    return {
        "mainboard": mainboard,
        "sme_count": len(sme),
        "unknown_count": len(unknown),
        "unknown_series_sample": unknown_series_sample,
        "nse_eq_rows": len(nse_eq),
    }


# ── Mongo state ──────────────────────────────────────────────────────────────


async def _load_state(db) -> dict:
    doc = await db.get_collection(STATE_COLLECTION).find_one({"_id": STATE_DOC_ID})
    if doc is None:
        return {"seen_isins": [], "auto_added": {}, "last_synced_at": None}
    return doc


async def _save_state(db, state: dict) -> None:
    await db.get_collection(STATE_COLLECTION).update_one(
        {"_id": STATE_DOC_ID},
        {
            "$set": {
                "seen_isins": state["seen_isins"],
                "auto_added": state["auto_added"],
                "last_synced_at": datetime.now(timezone.utc),
            }
        },
        upsert=True,
    )


# ── CSV merge (purely additive — never rewrites/removes an existing row) ────


def _merge_csv(csv_path: str, auto_added: dict[str, dict]) -> dict[str, Any]:
    """Ensures every row in `auto_added` (the Mongo-durable source of truth)
    is present in the universe CSV, keyed by ISIN, without ever touching an
    existing row. Self-heals the CSV after a Render redeploy, since the CSV
    itself is git-tracked and reverts on every deploy — `auto_added` doesn't."""
    import os

    if os.path.exists(csv_path):
        existing = pd.read_csv(csv_path)
        existing.columns = existing.columns.str.strip()
    else:
        existing = pd.DataFrame(columns=OUTPUT_COLUMNS)

    existing_isins = set(existing["isin"].astype(str)) if "isin" in existing else set()
    before_snapshot = existing.copy()

    to_append = []
    duplicates_prevented = 0
    for isin, row in auto_added.items():
        if isin in existing_isins:
            duplicates_prevented += 1
            continue
        to_append.append({col: row.get(col, "") for col in OUTPUT_COLUMNS})

    if to_append:
        merged = pd.concat([existing, pd.DataFrame(to_append)], ignore_index=True)
        merged.to_csv(csv_path, index=False)
    else:
        merged = existing

    # Verify every pre-existing row survived untouched (isin-keyed compare) —
    # reported, not just assumed, per the "preserve existing entries" contract.
    compare_cols = [c for c in OUTPUT_COLUMNS if c != "isin"]
    existing_unchanged = True
    if not before_snapshot.empty:
        after_by_isin = merged.set_index("isin")
        for _, row in before_snapshot.iterrows():
            isin = str(row["isin"])
            if isin not in after_by_isin.index:
                existing_unchanged = False
                break
            after_row = after_by_isin.loc[isin]
            if isinstance(after_row, pd.DataFrame):  # duplicate isin edge case
                after_row = after_row.iloc[0]
            if list(after_row[compare_cols]) != list(row[compare_cols]):
                existing_unchanged = False
                break

    return {
        "csv_rows_before": len(before_snapshot),
        "csv_rows_after": len(merged),
        "newly_added_symbols": [r["trading_symbol"] for r in to_append],
        "duplicates_prevented": duplicates_prevented,
        "existing_entries_unchanged": existing_unchanged,
    }


# ── Orchestrator ──────────────────────────────────────────────────────────────


async def run_universe_sync(
    db,
    dry_run: bool = False,
    classifier: ClassifierFn = classify_upstox_row,
) -> dict[str, Any]:
    """Fetch the Upstox instrument master, classify every NSE_EQ row,
    determine which mainboard symbols are genuinely new (never seen before),
    and add only those to the universe CSV — SME and unrecognised series are
    never added. Idempotent: rerunning with nothing new is a no-op.

    `dry_run=True` computes and returns the full report WITHOUT writing to
    Mongo state or the CSV — used for verification before enabling this for
    real, and safe to run against a live database.
    """
    report: dict[str, Any] = {"dry_run": dry_run, "error": None}

    loop = asyncio.get_running_loop()
    try:
        master_df = await loop.run_in_executor(None, fetch_instrument_master)
    except Exception as e:
        log.error(f"[universe_sync] Upstox instrument-master fetch failed: {e}")
        report["error"] = str(e)
        return report

    report["fetched_rows"] = len(master_df)

    classified = _classify_master(master_df, classifier)
    mainboard_df = classified["mainboard"]
    report["mainboard_total"] = len(mainboard_df)
    report["sme_excluded"] = classified["sme_count"]
    report["unknown_excluded"] = classified["unknown_count"]
    report["unknown_series_sample"] = classified["unknown_series_sample"]
    report["nse_eq_rows"] = classified["nse_eq_rows"]

    if classified["unknown_series_sample"]:
        log.warning(
            f"[universe_sync] {classified['unknown_count']} row(s) with unrecognised "
            f"series excluded (fail-safe): {classified['unknown_series_sample']}"
        )

    state = await _load_state(db)
    seen_isins: set[str] = set(state.get("seen_isins") or [])
    auto_added: dict[str, dict] = dict(state.get("auto_added") or {})

    bootstrap = not seen_isins and not auto_added and state.get("last_synced_at") is None
    report["bootstrap"] = bootstrap

    all_seen_this_run = set(mainboard_df["isin"].astype(str))
    # Also fold SME + unknown ISINs into the seen-set: once a listing has been
    # observed at all (any classification), it should never be re-evaluated
    # as "newly discovered" again just because its series code is later
    # reclassified in a future Upstox snapshot — that would need a deliberate
    # review, not a silent auto-add.
    nse_eq_all = master_df[master_df["segment"] == "NSE_EQ"]
    all_seen_this_run |= set(nse_eq_all["isin"].astype(str))

    if bootstrap:
        # First run ever: baseline the whole current mainboard-eligible set
        # as "already known" WITHOUT adding any of it to the universe — this
        # is what prevents backfilling the pre-existing ~278 BE/BZ stocks.
        newly_discovered_isins: set[str] = set()
        report["newly_discovered_isins"] = []
    else:
        newly_discovered_isins = {
            isin
            for isin in mainboard_df["isin"].astype(str)
            if isin not in seen_isins
        }
        report["newly_discovered_isins"] = sorted(newly_discovered_isins)

    if newly_discovered_isins:
        mb_by_isin = mainboard_df.set_index("isin")
        for isin in newly_discovered_isins:
            r = mb_by_isin.loc[isin]
            if isinstance(r, pd.DataFrame):  # defensive: duplicate isin in master
                r = r.iloc[0]
            auto_added[isin] = {
                "instrument_key": r["instrument_key"],
                "trading_symbol": r["trading_symbol"],
                "isin": isin,
                "company_name": r["company_name"],
                "exchange": r["exchange"],
                "segment": r["segment"],
                "added_at": datetime.now(timezone.utc).isoformat(),
            }
        log.info(
            f"[universe_sync] {len(newly_discovered_isins)} new mainboard "
            f"listing(s) detected: "
            f"{[auto_added[i]['trading_symbol'] for i in newly_discovered_isins]}"
        )

    new_seen = seen_isins | all_seen_this_run

    csv_path = get_downloader_paths()["symbols_csv"]
    if dry_run:
        merge_report = _dry_run_merge_report(csv_path, auto_added)
    else:
        merge_report = _merge_csv(csv_path, auto_added)
        await _save_state(
            db, {"seen_isins": sorted(new_seen), "auto_added": auto_added}
        )

    report.update(merge_report)
    log.info(
        f"[universe_sync] {'DRY RUN — ' if dry_run else ''}"
        f"bootstrap={bootstrap} mainboard={report['mainboard_total']} "
        f"sme_excluded={report['sme_excluded']} unknown_excluded={report['unknown_excluded']} "
        f"newly_added={len(merge_report['newly_added_symbols'])} "
        f"duplicates_prevented={merge_report['duplicates_prevented']} "
        f"csv_rows {merge_report['csv_rows_before']}->{merge_report['csv_rows_after']}"
    )
    return report


def _dry_run_merge_report(csv_path: str, auto_added: dict[str, dict]) -> dict[str, Any]:
    """Same shape as _merge_csv()'s report, computed without writing anything."""
    import os

    if os.path.exists(csv_path):
        existing = pd.read_csv(csv_path)
        existing.columns = existing.columns.str.strip()
    else:
        existing = pd.DataFrame(columns=OUTPUT_COLUMNS)

    existing_isins = set(existing["isin"].astype(str)) if "isin" in existing else set()
    would_add = []
    duplicates_prevented = 0
    for isin, row in auto_added.items():
        if isin in existing_isins:
            duplicates_prevented += 1
            continue
        would_add.append(row["trading_symbol"])

    return {
        "csv_rows_before": len(existing),
        "csv_rows_after": len(existing) + len(would_add),
        "newly_added_symbols": would_add,
        "duplicates_prevented": duplicates_prevented,
        "existing_entries_unchanged": True,  # dry run never writes, trivially true
    }
