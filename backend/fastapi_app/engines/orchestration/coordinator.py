"""
Scan Coordinator — the single orchestrator for "Run Full Scan".

Owns the entire pipeline end to end:

    Download -> Indicators -> Technical -> LaunchPad -> Alpha Zone -> IPO Vintage -> Publish -> Completed

No stage writes to a live collection until "Publish": every stage that
produces a cache (indicators, technical's screener/fvg/momentum/volume/SMC
caches, LaunchPad, Alpha Zone) writes into `{name}_staging`, and only after
every stage has succeeded does "Publish" atomically rename each staging
collection into place (`engines/orchestration/publish.py`). Old data stays
live and fully queryable for the entire duration of a scan — nothing is ever
exposed empty or half-written.

`scan_meta` is written as a full document replace at the start of every scan
(not incremental `$set` onto whatever was left by a previous run), so a run
never inherits stale fields from an unrelated prior scan — this is what
closes the exact bug where a killed process left `symbols_processed`/
`total_symbols` stuck at a previous run's numbers under a live `RUNNING`
status. Each stage owns its own status/processed/total/timestamps/errors/
failed_symbols sub-document (see the schema in `_new_stage()` below).

Indicators (EMA/RSI/MACD/ATR) are computed exactly once per symbol here, kept
in memory for every later stage in this same run to consume directly, and
also persisted to a staged, atomically-published `indicator_cache` — closing
the duplicate-computation issue where the legacy technical pass and each of
LaunchPad/Alpha Zone independently called the Indicator Engine.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from pymongo.errors import DuplicateKeyError

from engines.indicators import IndicatorEngine, IndicatorSet

from .publish import PIPELINE_COLLECTIONS, publish_all, write_staged

# A scan_meta doc still marked RUNNING after this long is treated as orphaned
# (the process died mid-scan) and its lock can be reclaimed. Comfortably longer
# than a real full scan, which runs ~30-40 min end to end.
STALE_SCAN_HOURS = 3

log = logging.getLogger("finai_edge.orchestration.coordinator")

STAGE_KEYS = (
    "download",
    "indicators",
    "technical",
    "launchpad",
    "alpha_zone",
    "ipo_vintage",
)

# Collections the Technical stage stages+publishes (produced by _build_cache_docs).
TECHNICAL_COLLECTIONS = (
    "screener_cache",
    "fvg_cache",
    "fvg_scan_results",
    "volume_surge_cache",
    "momentum_cache",
    "smc_scanner_results",
    "smc_zones",
)


def _new_stage() -> dict:
    return {
        "status": "PENDING",
        "processed": 0,
        "total": 0,
        "started_at": None,
        "completed_at": None,
        "duration_s": None,
        "errors": 0,
        "failed_symbols": [],
    }


def _new_scan_doc(
    scan_id: str, trigger: str, started_at: datetime, prev: dict | None = None
) -> dict:
    """A full-document replacement — never an incremental $set onto a stale
    prior doc, so a new scan can never inherit a previous run's leftover
    progress numbers (the exact mechanism behind the reported stuck-at-2067
    bug). `prev`, when given, deliberately carries forward only `last_ran`
    and `record_count` — "when did we last successfully finish" is
    legitimate, unlike `stages`/`symbols_processed`, which always start
    fresh — so the Overview page doesn't regress to "Never" the instant a
    new scan starts."""
    doc = {
        "_id": "daily_scan",
        "scan_id": scan_id,
        "overall_status": "RUNNING",
        "status": "RUNNING",  # legacy top-level field kept in sync for old readers
        "trigger": trigger,
        "started_at": started_at,
        "completed_at": None,
        "stages": {k: _new_stage() for k in STAGE_KEYS},
    }
    if prev:
        if prev.get("last_ran"):
            doc["last_ran"] = prev["last_ran"]
        if prev.get("record_count") is not None:
            doc["record_count"] = prev["record_count"]
        # Carry the manual-trigger audit trail across the replace. Without this
        # the document swap silently erases the cooldown timestamp the API just
        # wrote, so the rate limit would evaporate the moment a scan started —
        # a user could fire another manual scan the instant this one finished.
        if prev.get("last_manual_trigger_at"):
            doc["last_manual_trigger_at"] = prev["last_manual_trigger_at"]
        if prev.get("last_manual_trigger_by"):
            doc["last_manual_trigger_by"] = prev["last_manual_trigger_by"]
    return doc


class _StageWriter:
    """Small helper bound to one scan's meta_col + scan_id, so stage-transition
    calls stay one-line at the call site instead of repeating the dotted $set
    path and _ACTIVE_SCANS bookkeeping everywhere."""

    def __init__(self, meta_col, active_scans: dict, scan_id: str):
        self.meta_col = meta_col
        self.active_scans = active_scans
        self.scan_id = scan_id

    async def start(self, stage: str, total: int = 0) -> None:
        now = datetime.now(timezone.utc)
        await self.meta_col.update_one(
            {"_id": "daily_scan"},
            {
                "$set": {
                    f"stages.{stage}.status": "RUNNING",
                    f"stages.{stage}.total": total,
                    f"stages.{stage}.started_at": now,
                }
            },
        )
        if self.scan_id in self.active_scans:
            self.active_scans[self.scan_id]["stage"] = stage
        log.info(f"[{self.scan_id}] stage={stage} RUNNING total={total}")

    async def progress(
        self,
        stage: str,
        processed: int,
        errors: int = 0,
        total: int | None = None,
    ) -> None:
        fields = {
            f"stages.{stage}.processed": processed,
            f"stages.{stage}.errors": errors,
        }
        if total is not None:
            fields[f"stages.{stage}.total"] = total
        await self.meta_col.update_one({"_id": "daily_scan"}, {"$set": fields})

    async def finish(
        self,
        stage: str,
        processed: int,
        total: int,
        errors: int,
        failed_symbols: list[str],
        started_at: datetime,
    ) -> None:
        now = datetime.now(timezone.utc)
        duration = (now - started_at).total_seconds()
        await self.meta_col.update_one(
            {"_id": "daily_scan"},
            {
                "$set": {
                    f"stages.{stage}.status": "COMPLETED",
                    f"stages.{stage}.processed": processed,
                    f"stages.{stage}.total": total,
                    f"stages.{stage}.errors": errors,
                    f"stages.{stage}.failed_symbols": failed_symbols[
                        :50
                    ],  # cap doc size
                    f"stages.{stage}.completed_at": now,
                    f"stages.{stage}.duration_s": round(duration, 1),
                }
            },
        )
        log.info(
            f"[{self.scan_id}] stage={stage} COMPLETED processed={processed}/{total} "
            f"errors={errors} duration={duration:.1f}s"
        )


async def run_full_scan(
    app_state, force: bool = False, trigger: str = "unknown"
) -> None:
    """The Scan Coordinator's entry point — replaces the old run_daily_scan body."""
    import schedulers.daily_refresh as _dr
    from schedulers.daily_refresh import (
        _ACTIVE_SCANS,
        BULK_BATCH_SIZE,
        NIFTY_SYMBOL,
        _build_cache_docs,
        _compute_symbol_local,
        _new_scan_id,
    )
    from services.ohlc_downloader import (
        download_incremental_ohlc,
        get_cached_symbols,
        get_downloader_paths,
        load_stock_dataframe,
    )

    db = app_state.db
    if db is None:
        log.warning("[Coordinator] No DB — skipping scan")
        return

    scan_id = _new_scan_id()
    currently_active = list(_ACTIVE_SCANS.keys())
    log.info(
        f"[{scan_id}] SCAN STARTED | trigger={trigger} | force={force} | "
        f"currently_active_before_this={currently_active or 'none'}"
    )
    if currently_active:
        log.warning(
            f"[{scan_id}] CONCURRENCY WARNING — {len(currently_active)} scan(s) already "
            f"running when this one started: {currently_active}"
        )
    _ACTIVE_SCANS[scan_id] = {
        "trigger": trigger,
        "started_at": datetime.now(timezone.utc),
        "stage": "starting",
    }

    start_time = datetime.now(timezone.utc)
    meta_col = db.get_collection("scan_meta")

    try:
        # Skip-check first — before any state is written, so a skip never
        # leaves scan_meta mid-stage.
        last_meta = await meta_col.find_one({"_id": "daily_scan"})
        if last_meta and not force:
            last_ran = last_meta.get("last_ran")
            prev_processed = last_meta.get("symbols_processed", 0)
            prev_total = last_meta.get("total_symbols", 0)
            if last_ran and prev_processed >= 0.9 * max(prev_total, 1):
                if hasattr(last_ran, "tzinfo") and last_ran.tzinfo is None:
                    last_ran = last_ran.replace(tzinfo=timezone.utc)
                age_hours = (start_time - last_ran).total_seconds() / 3600
                if age_hours < 6:
                    log.info(
                        f"[{scan_id}] SCAN SKIPPED — recent scan exists (force={force})"
                    )
                    _ACTIVE_SCANS.pop(scan_id, None)
                    return

        # ── Atomic claim ────────────────────────────────────────────────
        # Full document replace (a new scan NEVER inherits leftover fields from
        # a previous, unrelated run — that's the stuck-at-2067 bug), but now
        # CONDITIONAL: the filter only matches when no scan currently holds the
        # lock, so the write itself is the mutual exclusion.
        #
        # Why here and not in the API endpoint: cron, startup-staleness and the
        # manual endpoint all funnel through this function, so this is the only
        # place that can serialise all three. It is also cross-instance safe —
        # the previous in-process `_ACTIVE_SCANS` check could not see a scan
        # running in another worker/dyno, and only logged when it did.
        #
        # A RUNNING doc older than STALE_SCAN_HOURS is treated as orphaned (the
        # process died mid-scan, leaving the flag set forever) and can be
        # reclaimed — otherwise one crash would wedge scanning permanently.
        stale_cutoff = start_time - timedelta(hours=STALE_SCAN_HOURS)
        claim_filter = {
            "_id": "daily_scan",
            "$or": [
                {"overall_status": {"$ne": "RUNNING"}},
                {"overall_status": {"$exists": False}},
                {"started_at": {"$lt": stale_cutoff}},
                {"started_at": None},
            ],
        }
        try:
            await meta_col.replace_one(
                claim_filter,
                _new_scan_doc(scan_id, trigger, start_time, prev=last_meta),
                upsert=True,
            )
        except DuplicateKeyError:
            # upsert tried to INSERT because the filter didn't match, and _id
            # already exists => a scan holds the lock right now. Losing this
            # race is normal and expected, not an error.
            holder = await meta_col.find_one(
                {"_id": "daily_scan"}, {"scan_id": 1, "trigger": 1, "started_at": 1}
            )
            log.warning(
                f"[{scan_id}] SCAN REJECTED — another scan holds the lock "
                f"(scan_id={(holder or {}).get('scan_id')}, "
                f"trigger={(holder or {}).get('trigger')}, "
                f"started_at={(holder or {}).get('started_at')})"
            )
            _ACTIVE_SCANS.pop(scan_id, None)
            return

        sw = _StageWriter(meta_col, _ACTIVE_SCANS, scan_id)

        # ── Stage: Download ──────────────────────────────────────────────
        t_download = datetime.now(timezone.utc)
        await sw.start("download")
        download_errors = 0

        # Refresh universe (upstox_nse_stock_list.csv) with newly listed mainboard stocks
        try:
            from services.universe_sync import run_universe_sync

            sync_res = await run_universe_sync(db)
            if sync_res.get("newly_added_symbols"):
                log.info(
                    f"[{scan_id}] Universe sync added {len(sync_res['newly_added_symbols'])} "
                    f"new symbols to upstox_nse_stock_list.csv: {sync_res['newly_added_symbols']}"
                )
        except Exception as e:
            log.warning(f"[{scan_id}] Universe sync failed (continuing scan): {e}")

        async def _dl_progress(done: int, total: int) -> None:
            await sw.progress("download", done, total=total)

        try:
            log.info(f"[{scan_id}] Downloading OHLC…")
            await download_incremental_ohlc(progress_cb=_dl_progress)
            log.info(f"[{scan_id}] Download stage complete")
        except Exception as e:
            download_errors = 1
            log.error(
                f"[{scan_id}] Incremental ingestion failed: {e}. Using existing file."
            )

        symbols = get_cached_symbols()
        if not symbols:
            log.error(
                f"[{scan_id}] No stocks found in cached Stock_Data.csv — aborting scan"
            )
            await sw.finish("download", 0, 0, download_errors, [], t_download)
            await meta_col.update_one(
                {"_id": "daily_scan"},
                {
                    "$set": {
                        "overall_status": "FAILED",
                        "status": "FAILED",
                        "error": "no symbols available after download",
                        "completed_at": datetime.now(timezone.utc),
                    }
                },
            )
            _ACTIVE_SCANS.pop(scan_id, None)
            return

        from utils.helpers import normalize_symbol

        symbols = [normalize_symbol(s) for s in symbols if s]
        symbols = list(dict.fromkeys(symbols))
        await sw.finish(
            "download", len(symbols), len(symbols), download_errors, [], t_download
        )

        # Company name map (used by _compute_symbol_local via the module global).
        company_name_map: dict[str, str] = {}
        try:
            paths = get_downloader_paths()
            symbols_csv_path = paths["symbols_csv"]
            if __import__("os").path.exists(symbols_csv_path):
                import pandas as pd

                stock_list_df = pd.read_csv(symbols_csv_path)
                stock_list_df.columns = stock_list_df.columns.str.strip()
                for _, row in stock_list_df.iterrows():
                    sym_raw = str(row.get("trading_symbol", "")).strip()
                    name = str(row.get("company_name", "")).strip()
                    if sym_raw and name:
                        company_name_map[normalize_symbol(sym_raw)] = name
        except Exception as e:
            log.warning(f"[{scan_id}] Could not load company names: {e}")
        _dr._company_name_map = company_name_map

        # ── Stage: Indicators (centralized — computed exactly once per symbol) ──
        # Loaded + computed on a worker thread and awaited per symbol (mirrors
        # the Technical stage below) so the event loop — and /health — is
        # never blocked for more than one symbol's compute at a time. Also
        # keeps each symbol's DataFrame scoped to the worker thread's own
        # stack frame, released as soon as that symbol's compute returns,
        # rather than living in the coroutine's frame across the loop.
        loop = asyncio.get_running_loop()

        def _load_and_compute(symbol: str) -> IndicatorSet | None:
            df = load_stock_dataframe(symbol)
            if df.empty or len(df) < 30:
                return None
            return IndicatorEngine.compute(df)

        t_ind = datetime.now(timezone.utc)
        await sw.start("indicators", total=len(symbols))
        indicator_map: dict[str, IndicatorSet] = {}
        indicator_docs: list[dict] = []
        ind_errors = 0
        ind_failed: list[str] = []
        for i, sym in enumerate(symbols):
            try:
                ind = await loop.run_in_executor(None, _load_and_compute, sym)
                if ind is None:
                    continue
                indicator_map[sym] = ind
                indicator_docs.append(
                    {
                        "symbol": sym,
                        **ind.as_dict(),
                        "updated_at": datetime.now(timezone.utc),
                    }
                )
            except Exception as e:
                ind_errors += 1
                ind_failed.append(sym)
                log.warning(f"[{scan_id}] Indicator compute failed for {sym}: {e}")
            if (i + 1) % 200 == 0:
                await sw.progress("indicators", i + 1, ind_errors)
        await write_staged(db, "indicator_cache", indicator_docs)
        await sw.finish(
            "indicators",
            len(indicator_map),
            len(symbols),
            ind_errors,
            ind_failed,
            t_ind,
        )

        # ── Stage: Technical (reuses indicator_map — no recomputation) ──────
        t_tech = datetime.now(timezone.utc)
        await sw.start("technical", total=len(symbols))
        nifty_1m_return = 0.0
        try:
            nifty_df = load_stock_dataframe(NIFTY_SYMBOL)
            if not nifty_df.empty and len(nifty_df) >= 21:
                closes = nifty_df["Close"].values
                nifty_1m_return = (
                    (closes[-1] - closes[-21]) / closes[-21] * 100
                    if closes[-21]
                    else 0.0
                )
        except Exception as e:
            log.warning(f"[{scan_id}] Nifty baseline load failed: {e}")

        processed = 0
        tech_errors = 0
        tech_failed: list[str] = []
        batch_data: list[tuple] = []
        all_docs: dict[str, list[dict]] = {name: [] for name in TECHNICAL_COLLECTIONS}

        for i, symbol in enumerate(symbols):
            try:
                df_group = load_stock_dataframe(symbol)
                if df_group.empty:
                    continue
                df_symbol = df_group.tail(504).reset_index(drop=True)
                if len(df_symbol) < 30:
                    continue

                ind = indicator_map.get(symbol)
                result = await loop.run_in_executor(
                    None, _compute_symbol_local, symbol, df_symbol, nifty_1m_return, ind
                )
                if result:
                    batch_data.append((symbol, result))
                    processed += 1
                else:
                    tech_errors += 1
                    tech_failed.append(symbol)

                if len(batch_data) >= BULK_BATCH_SIZE:
                    batch_docs = _build_cache_docs(batch_data)
                    for name, docs in batch_docs.items():
                        all_docs[name].extend(docs)
                    batch_data = []
                    await sw.progress("technical", processed, tech_errors)
                    log.info(
                        f"[{scan_id}] PROGRESS technical {processed}/{len(symbols)}"
                    )

            except Exception as e:
                tech_errors += 1
                tech_failed.append(symbol)
                log.warning(f"[{scan_id}] Failed to compute results for {symbol}: {e}")

        if batch_data:
            batch_docs = _build_cache_docs(batch_data)
            for name, docs in batch_docs.items():
                all_docs[name].extend(docs)

        for name, docs in all_docs.items():
            await write_staged(db, name, docs)

        await sw.finish(
            "technical", processed, len(symbols), tech_errors, tech_failed, t_tech
        )

        # ── Stage: LaunchPad (reuses indicator_map; keeps its own FVG detection) ──
        t_lp = datetime.now(timezone.utc)
        await sw.start("launchpad", total=len(symbols))

        async def _lp_progress(done: int, total: int) -> None:
            await sw.progress("launchpad", done)

        from engines.strategies.runner import run_launchpad_scan

        lp_count = await run_launchpad_scan(
            db,
            scan_id=scan_id,
            progress_cb=_lp_progress,
            indicator_map=indicator_map,
            publish=False,
        )
        await sw.finish("launchpad", lp_count, len(symbols), 0, [], t_lp)

        # ── Stage: Alpha Zone (reuses indicator_map; keeps its own OB detection) ──
        t_az = datetime.now(timezone.utc)
        await sw.start("alpha_zone", total=len(symbols))

        async def _az_progress(done: int, total: int) -> None:
            await sw.progress("alpha_zone", done)

        from engines.strategies.runner import run_alphazone_scan

        az_count = await run_alphazone_scan(
            db,
            scan_id=scan_id,
            progress_cb=_az_progress,
            indicator_map=indicator_map,
            publish=False,
        )
        await sw.finish("alpha_zone", az_count, len(symbols), 0, [], t_az)

        # ── Stage: IPO Vintage (its own small tracked universe — NOT the ────
        # ── 2150-symbol universe above; rule-based, no ML) ──────────────────
        t_iv = datetime.now(timezone.utc)
        ipo_listings_count = await db.get_collection("ipo_listings").count_documents({})
        await sw.start("ipo_vintage", total=ipo_listings_count)

        async def _iv_progress(done: int, total: int) -> None:
            await sw.progress("ipo_vintage", done)

        from engines.strategies.runner import run_ipo_vintage_scan

        iv_count = await run_ipo_vintage_scan(
            db,
            scan_id=scan_id,
            progress_cb=_iv_progress,
            publish=False,
        )
        await sw.finish("ipo_vintage", iv_count, ipo_listings_count, 0, [], t_iv)

        # ── Publish: atomic rename swap, every collection, all at once ──────
        log.info(f"[{scan_id}] Publishing {len(PIPELINE_COLLECTIONS)} collections…")
        await publish_all(db, list(PIPELINE_COLLECTIONS))
        log.info(f"[{scan_id}] Publish complete — new data is now live")

        # Secondary derived cache (zone_proximity_results), unrelated to this
        # pipeline's own collections — run after publish so it reads the
        # freshly-published smc_scanner_results, not the pre-scan version.
        try:
            from services.zone_search_service import run_zone_proximity_search

            await run_zone_proximity_search(db)
        except Exception as e:
            log.error(f"[{scan_id}] Zone proximity search update failed: {e}")

        elapsed = (datetime.now(timezone.utc) - start_time).total_seconds()
        screener_cache_count = await db.get_collection(
            "screener_cache"
        ).count_documents({})
        now = datetime.now(timezone.utc)
        await meta_col.update_one(
            {"_id": "daily_scan"},
            {
                "$set": {
                    "overall_status": "COMPLETED",
                    "status": "COMPLETED",
                    "stage": "completed",
                    "completed_at": now,
                    "last_ran": now,
                    "last_scan_time": now,
                    "record_count": screener_cache_count,
                    "symbols_processed": processed,
                    "symbols_errored": tech_errors,
                    "total_symbols": len(symbols),
                    "elapsed_seconds": round(elapsed, 1),
                    "scan_duration": round(elapsed, 1),
                }
            },
        )
        log.info(
            f"[{scan_id}] SCAN FINISHED | duration={elapsed:.1f}s | trigger={trigger}"
        )
        _ACTIVE_SCANS.pop(scan_id, None)

    except Exception as exc:
        log.exception(f"[{scan_id}] SCAN FAILED")
        _ACTIVE_SCANS.pop(scan_id, None)
        await meta_col.update_one(
            {"_id": "daily_scan"},
            {
                "$set": {
                    "overall_status": "FAILED",
                    "status": "FAILED",
                    "stage": "failed",
                    "error": str(exc),
                    "completed_at": datetime.now(timezone.utc),
                    "last_ran": datetime.now(timezone.utc),
                    "last_scan_time": datetime.now(timezone.utc),
                }
            },
            upsert=True,
        )
