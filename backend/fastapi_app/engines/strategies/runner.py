"""
Strategy scan runner — applies a Strategy across the whole universe and persists
results to `{strategy}_cache`, mirroring how technical/fvg/momentum caches work.

Reused by:
  - the daily scan job (schedulers/daily_refresh) to keep results fresh, and
  - the manual populate/refresh path.

The universe comes from the in-memory OHLC cache (a fast dict copy per symbol —
no disk I/O), so a full pass is cheap relative to the ingestion.
"""

from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Optional

from engines.indicators import IndicatorEngine
from .base import Strategy, SymbolContext, MarketContext

log = logging.getLogger("finai_edge.strategy_runner")

MIN_ROWS = 210  # need EMA200 warmup

# Records the scan_id + wall-clock time of the last write to each strategy
# cache collection, purely so GET endpoints (api/screener.py) can log/report
# "which scan produced what you're reading right now" without any Mongo schema
# change (nothing is persisted — this is process-local, log/response only).
_CACHE_META: dict[str, dict[str, Any]] = {}

ProgressCallback = Callable[[int, int], Awaitable[None]]


def _new_scan_id(prefix: str) -> str:
    """Fallback scan_id generator for any caller that runs a strategy scan
    without one from run_daily_scan() (e.g. a manual populate script)."""
    now = datetime.now(timezone.utc)
    return f"{prefix}-{now:%Y%m%d-%H%M%S}-{uuid.uuid4().hex[:6]}"


async def run_strategy_scan(
    db,
    strategy: Strategy,
    *,
    company_map: Optional[dict] = None,
    market: Optional[MarketContext] = None,
) -> int:
    """Evaluate `strategy` for every cached symbol; replace its result cache.
    Returns the number of qualifying results."""
    from services.ohlc_downloader import get_cached_symbols, load_stock_dataframe

    company_map = company_map or {}
    market = market or MarketContext()
    symbols = get_cached_symbols()

    t0 = time.time()
    results: list[dict] = []
    evaluated = 0
    for sym in symbols:
        if sym.startswith("^"):  # skip index benchmark
            continue
        df = load_stock_dataframe(sym)
        if df.empty or len(df) < MIN_ROWS:
            continue
        try:
            ind = IndicatorEngine.compute(df)
            ctx = SymbolContext(
                symbol=sym,
                df=df,
                indicators=ind,
                company_name=company_map.get(sym, sym),
                market=market,
            )
            res = strategy.evaluate(ctx)
            evaluated += 1
            if res is not None:
                results.append(res.to_doc())
        except Exception as e:  # one bad symbol must not abort the scan
            log.warning(f"[{strategy.name}] evaluate failed for {sym}: {e}")

    col = db.get_collection(f"{strategy.name}_cache")
    await col.delete_many({})
    if results:
        await col.insert_many(results)

    log.info(
        f"[{strategy.name}] scan complete: {len(results)} matches from "
        f"{evaluated} evaluated symbols in {time.time() - t0:.1f}s"
    )
    return len(results)


async def run_launchpad_scan(
    db, scan_id: Optional[str] = None, progress_cb: Optional[ProgressCallback] = None,
    indicator_map: Optional[dict[str, Any]] = None, publish: bool = True,
) -> int:
    """
    LaunchPad scan — reads OHLCV DIRECTLY (independent of `fvg_scan_results` and
    the generic ICT FVG scanner). Pipeline per symbol:

        OHLCV → cheap pre-filter (rows, CMP ≥ ₹100)
              → IndicatorEngine (EMA/ATR/…) → EMA200 band
              → LaunchPadStrategy.evaluate (detects the bullish FVG itself and
                applies LaunchPad's OWN close-below-floor validity + location
                + confidence)
              → launchpad_cache

    Performance: the two cheap gates (price ≥ ₹100, EMA200 band) reject most of
    the ~4200 universe before any FVG work, and the FVG detector is a vectorised
    numpy pass over only the last ~250 candles — so a full pass is practical.

    `indicator_map`, when supplied by the Scan Coordinator's Indicators stage,
    is consulted per symbol instead of calling `IndicatorEngine.compute(df)`
    again — the canonical EMA/RSI/MACD/ATR were already computed once. Falls
    back to self-computing for any symbol missing from the map, or when no map
    is given at all (standalone/manual invocation keeps working unchanged).

    `publish` controls how results reach Mongo: True (default) does the
    original self-contained delete_many+insert_many directly against the live
    `launchpad_cache` — unchanged behavior for any standalone caller. False
    (the Coordinator's usage) writes into `launchpad_cache_staging` instead;
    the Coordinator publishes it atomically alongside every other stage's
    output in one "Publish" step, so no partial/empty cache is ever visible.

    `progress_cb(done, total)`, if given, is awaited every 500 symbols scanned
    so a caller (e.g. the Coordinator) can publish live stepper progress.
    """
    from services.ohlc_downloader import get_cached_symbols, load_stock_dataframe
    from engines.indicators import IndicatorEngine
    from engines.strategies.launchpad import (
        LaunchPadStrategy,
        EMA_DIST_MIN,
        EMA_DIST_MAX,
        MIN_PRICE,
    )
    from .base import SymbolContext

    scan_id = scan_id or _new_scan_id("LP")
    log.info(f"[{scan_id}] [launchpad] scan starting")

    t0 = time.time()
    strat = LaunchPadStrategy()
    company = await build_company_map(db)
    symbols = get_cached_symbols()

    results: list[dict] = []
    scanned = fvg_checked = 0
    for i, sym in enumerate(symbols):
        if sym.startswith("^"):        # skip index benchmark
            continue
        df = load_stock_dataframe(sym)
        if df.empty or len(df) < MIN_ROWS:
            continue

        # Cheap gate 1: price filter (last close ≥ ₹100) — no indicator work yet.
        try:
            price = float(df["Close"].iloc[-1])
        except Exception:
            continue
        if price < MIN_PRICE:
            continue

        # Cheap gate 2: EMA200 trend band. Reuse the precomputed indicator set
        # when available (no second IndicatorEngine.compute for this symbol).
        ind = indicator_map.get(sym) if indicator_map else None
        if ind is None:
            ind = IndicatorEngine.compute(df)
        scanned += 1
        if ind.ema_200_dist_pct is None or not (EMA_DIST_MIN <= ind.ema_200_dist_pct <= EMA_DIST_MAX):
            continue

        # Direct FVG detection + validity + location + confidence, inside evaluate.
        fvg_checked += 1
        try:
            ctx = SymbolContext(
                symbol=sym, df=df, indicators=ind, company_name=company.get(sym, sym)
            )
            res = strat.evaluate(ctx)
        except Exception as e:
            log.warning(f"[launchpad] evaluate failed for {sym}: {e}")
            continue
        if res is not None:
            results.append(res.to_doc())

        if (i + 1) % 500 == 0:
            log.info(f"[{scan_id}] [launchpad] scanned {i + 1}/{len(symbols)} symbols so far")
            if progress_cb:
                await progress_cb(i + 1, len(symbols))

    if publish:
        col = db.get_collection("launchpad_cache")
        before_count = await col.count_documents({})
        log.info(f"[{scan_id}] [launchpad] Mongo before delete_many: {before_count} docs")
        await col.delete_many({})
        after_delete_count = await col.count_documents({})
        log.info(f"[{scan_id}] [launchpad] Mongo after delete_many: {after_delete_count} docs")
        if results:
            await col.insert_many(results)
        after_insert_count = await col.count_documents({})
        log.info(f"[{scan_id}] [launchpad] Mongo after insert_many: {after_insert_count} docs")
    else:
        from engines.orchestration.publish import write_staged
        after_insert_count = await write_staged(db, "launchpad_cache", results)

    _CACHE_META["launchpad_cache"] = {
        "scan_id": scan_id, "written_at": datetime.now(timezone.utc), "count": after_insert_count,
    }
    if progress_cb:
        await progress_cb(len(symbols), len(symbols))
    log.info(
        f"[launchpad] direct OHLCV scan: {len(results)} matches "
        f"(EMA-band survivors {fvg_checked}, indicators computed {scanned}) "
        f"in {time.time() - t0:.1f}s"
    )
    log.info(f"[{scan_id}] [launchpad] scan finished: {len(results)} matches, {time.time() - t0:.1f}s")
    return len(results)


# Backward-compatible alias — LaunchPad no longer reads any FVG cache, but callers
# that still import the old name keep working.
run_launchpad_from_cache = run_launchpad_scan


async def run_alphazone_scan(
    db, scan_id: Optional[str] = None, progress_cb: Optional[ProgressCallback] = None,
    indicator_map: Optional[dict[str, Any]] = None, publish: bool = True,
) -> int:
    """
    Alpha Zone scan — reads OHLCV DIRECTLY (independent of `smc_scanner_results`
    and the shared SMC scanner). Pipeline per symbol:

        OHLCV → cheap pre-filter (rows, CMP ≥ ₹200)
              → IndicatorEngine (EMA200 dist, ATR) → EMA200 band [-35%, +40%]
              → dedicated internal bullish OB detector (close-below-floor validity)
              → nearest valid zone price is reacting to (In / ≤1.5% / ≤3%)
              → Institutional Score + Confidence + ATR trade plan (RR 3.0)
              → alpha_zone_cache

    Two O(1) gates reject most of the ~4200 universe before OB work, and OB
    detection is a bounded (~500-bar) numpy pass — so a full scan is practical.

    `indicator_map` / `publish` behave exactly as documented on
    `run_launchpad_scan` above — reuse the Coordinator's precomputed indicators
    instead of recomputing, and stage-not-publish when driven by the
    Coordinator so the atomic "Publish" step controls when this cache updates.

    `progress_cb(done, total)`, if given, is awaited every 500 symbols scanned
    so a caller (e.g. the Coordinator) can publish live stepper progress.
    """
    from services.ohlc_downloader import get_cached_symbols, load_stock_dataframe
    from engines.indicators import IndicatorEngine
    from engines.strategies.alpha_zone_ob import nearest_reacting_ob
    from engines.strategies.alpha_zone import build_alphazone_result

    MIN_PRICE = 200.0
    EMA_DIST_MIN, EMA_DIST_MAX = -35.0, 40.0

    scan_id = scan_id or _new_scan_id("AZ")
    log.info(f"[{scan_id}] [alpha_zone] scan starting")

    t0 = time.time()
    company = await build_company_map(db)
    symbols = get_cached_symbols()

    results: list[dict] = []
    scanned = ob_checked = 0
    for i, sym in enumerate(symbols):
        if sym.startswith("^"):
            continue
        df = load_stock_dataframe(sym)
        if df.empty or len(df) < MIN_ROWS:
            continue
        try:
            price = float(df["Close"].iloc[-1])
        except Exception:
            continue
        if price < MIN_PRICE:                       # gate 1: ₹200 floor
            continue

        # gate 2: EMA200 band. Reuse the precomputed indicator set when available.
        ind = indicator_map.get(sym) if indicator_map else None
        if ind is None:
            ind = IndicatorEngine.compute(df)
        scanned += 1
        if ind.ema_200_dist_pct is None or not (EMA_DIST_MIN <= ind.ema_200_dist_pct <= EMA_DIST_MAX):
            continue

        ob_checked += 1
        try:
            ob = nearest_reacting_ob(df, price)
            if ob is None:
                continue
            res = build_alphazone_result(
                symbol=sym,
                company_name=company.get(sym, sym),
                ltp=price,
                ob=ob,
                ema200_dist_pct=ind.ema_200_dist_pct,
                atr=ind.atr_14,
                avg_volume=ind.avg_volume_20,
            )
        except Exception as e:
            log.warning(f"[alpha_zone] evaluate failed for {sym}: {e}")
            continue
        if res is not None:
            results.append(res)

        if (i + 1) % 500 == 0:
            log.info(f"[{scan_id}] [alpha_zone] scanned {i + 1}/{len(symbols)} symbols so far")
            if progress_cb:
                await progress_cb(i + 1, len(symbols))

    if publish:
        col = db.get_collection("alpha_zone_cache")
        before_count = await col.count_documents({})
        log.info(f"[{scan_id}] [alpha_zone] Mongo before delete_many: {before_count} docs")
        await col.delete_many({})
        after_delete_count = await col.count_documents({})
        log.info(f"[{scan_id}] [alpha_zone] Mongo after delete_many: {after_delete_count} docs")
        if results:
            await col.insert_many(results)
        after_insert_count = await col.count_documents({})
        log.info(f"[{scan_id}] [alpha_zone] Mongo after insert_many: {after_insert_count} docs")
    else:
        from engines.orchestration.publish import write_staged
        after_insert_count = await write_staged(db, "alpha_zone_cache", results)

    _CACHE_META["alpha_zone_cache"] = {
        "scan_id": scan_id, "written_at": datetime.now(timezone.utc), "count": after_insert_count,
    }
    if progress_cb:
        await progress_cb(len(symbols), len(symbols))
    log.info(
        f"[alpha_zone] direct OHLCV scan: {len(results)} matches "
        f"(EMA-band survivors {ob_checked}, indicators computed {scanned}) "
        f"in {time.time() - t0:.1f}s"
    )
    log.info(f"[{scan_id}] [alpha_zone] scan finished: {len(results)} matches, {time.time() - t0:.1f}s")
    return len(results)


# Backward-compatible alias — Alpha Zone no longer reads the SMC cache.
run_alphazone_from_cache = run_alphazone_scan


async def discover_ipo_listings(db) -> int:
    """Auto-populate `ipo_listings` from the OHLCV cache — no scraper, no
    external provider, no manual entry.

    The insight: for a genuinely recent listing, the FIRST bar in its price
    history IS its listing candle. `Stock_Data.csv` holds a rolling ~5-year
    window, so a symbol whose first bar sits well after the window's start
    didn't exist before that date — it listed then. A symbol whose first bar is
    at (or near) the window start is simply an older stock clipped by the
    window, and is skipped.

    Only listings inside the tracked vintage age bound are added, so this can't
    balloon the collection. Manually-added rows (`source="manual"`) are never
    overwritten — the POST endpoint stays authoritative for anything a human
    entered, including a corrected listing date.

    Caveat worth knowing: this detects "first day of trading under this symbol",
    which is an IPO in the overwhelming majority of cases but also catches
    re-listings, demergers and ticker changes. The setup's mechanics (breakout
    over the first-day range) are identical either way, so they're kept.
    """
    import pandas as pd
    import services.ohlc_downloader as ohlc
    from .ipo_vintage import MAX_LISTING_AGE_DAYS

    # Read the cache off the MODULE, not a from-import: refresh_in_memory_cache()
    # rebinds the module global, so a local name bound before the refresh would
    # still point at the old (empty) dict.
    if not ohlc._IN_MEMORY_STOCK_CACHE:
        ohlc.refresh_in_memory_cache()
    cache = ohlc._IN_MEMORY_STOCK_CACHE
    if not cache:
        log.warning("[ipo_vintage] discover: OHLCV cache empty — cannot auto-detect listings")
        return 0

    # Window start = the earliest date across the whole cache; anything first
    # seen within WINDOW_BUFFER_DAYS of it is a clipped old stock, not a listing.
    WINDOW_BUFFER_DAYS = 60
    firsts: dict[str, pd.Timestamp] = {}
    latest = None
    for sym, df in cache.items():
        if sym.startswith("^") or df.empty:
            continue
        d0 = df["date"].iloc[0]
        firsts[sym] = d0
        last = df["date"].iloc[-1]
        latest = last if latest is None else max(latest, last)
    if not firsts or latest is None:
        return 0

    window_start = min(firsts.values())
    earliest_real = window_start + pd.Timedelta(days=WINDOW_BUFFER_DAYS)
    age_cutoff = latest - pd.Timedelta(days=MAX_LISTING_AGE_DAYS)

    # Real company names come from the freshly-refreshed universe CSV — new
    # listings aren't in `screener_cache` yet (that's populated by the technical
    # stage), so build_company_map() would return the bare ticker for exactly
    # the symbols this function cares about.
    names: dict[str, str] = {}
    try:
        import os
        from services.ohlc_downloader import get_downloader_paths
        csv_path = get_downloader_paths()["symbols_csv"]
        if os.path.exists(csv_path):
            udf = pd.read_csv(csv_path)
            udf.columns = udf.columns.str.strip()
            for _, r in udf.iterrows():
                t, n = str(r.get("trading_symbol", "")).strip(), str(r.get("company_name", "")).strip()
                if t and n:
                    names[t.upper()] = n
    except Exception as e:
        log.warning(f"[ipo_vintage] discover: could not load company names: {e}")

    col = db.get_collection("ipo_listings")
    existing = {d["symbol"]: d async for d in col.find({}, {"_id": 0, "symbol": 1, "source": 1})}

    added = 0
    for sym, first_bar in firsts.items():
        if first_bar <= earliest_real or first_bar < age_cutoff:
            continue
        prev = existing.get(sym)
        if prev and prev.get("source") == "manual":
            continue     # never clobber a human-entered listing date
        company = names.get(sym.upper(), sym)
        await col.update_one(
            {"symbol": sym},
            {"$set": {
                "symbol": sym,
                "company_name": company or sym,
                "listing_date": first_bar.strftime("%Y-%m-%d"),
                "source": "auto",
            }},
            upsert=True,
        )
        added += 1

    log.info(
        f"[ipo_vintage] discover: {added} listing(s) auto-detected from first-bar-in-history "
        f"(window starts {window_start:%Y-%m-%d}, tracking listings after {age_cutoff:%Y-%m-%d})"
    )
    return added


async def run_ipo_vintage_study(db) -> dict:
    """Build the historical study over EVERY listing in the price history and
    persist it to `ipo_vintage_meta` (`_id="study"`).

    Two deliberate differences from the live scan:
      • No age bound — the live scanner only tracks recent listings (they're the
        actionable ones), but the evidence base should be every listing in the
        5-year window, which is a far larger sample (~670 vs ~260).
      • Runs through the SAME `build_ipo_vintage_result`, so the study describes
        this scanner's actual rules rather than a parallel reimplementation.

    Persisted (not computed per request) because the full pass takes tens of
    seconds — far too slow for a GET.
    """
    import pandas as pd
    import services.ohlc_downloader as ohlc
    from .ipo_vintage import build_ipo_vintage_result
    from .ipo_vintage_backtest import build_ipo_vintage_study

    if not ohlc._IN_MEMORY_STOCK_CACHE:
        ohlc.refresh_in_memory_cache()
    cache = ohlc._IN_MEMORY_STOCK_CACHE
    if not cache:
        return {}

    firsts = {
        s: df["date"].iloc[0]
        for s, df in cache.items()
        if not s.startswith("^") and not df.empty
    }
    if not firsts:
        return {}
    window_start = min(firsts.values())
    cutoff = window_start + pd.Timedelta(days=60)

    t0 = time.time()
    docs: list[dict] = []
    listings = 0
    for sym, first_bar in firsts.items():
        if first_bar <= cutoff:
            continue
        listings += 1
        try:
            r = build_ipo_vintage_result(
                symbol=sym, company_name=sym,
                df=ohlc.load_stock_dataframe(sym),
                listing_date=first_bar, max_age_days=None,
            )
        except Exception:
            continue
        if r:
            docs.append(r)

    study = build_ipo_vintage_study(docs, headline_horizon=15)
    study["listings_evaluated"] = listings
    study["triggered"] = len(docs)
    study["trigger_rate_pct"] = round(len(docs) / listings * 100.0, 1) if listings else 0.0
    study["sample_start"] = window_start.strftime("%Y-%m-%d")
    study["generated_at"] = datetime.now(timezone.utc)

    await db.get_collection("ipo_vintage_meta").update_one(
        {"_id": "study"}, {"$set": study}, upsert=True,
    )
    log.info(
        f"[ipo_vintage] study: {len(docs)} triggered / {listings} listings "
        f"since {window_start:%Y-%m-%d} in {time.time() - t0:.1f}s"
    )
    return study


async def run_ipo_vintage_scan(
    db, scan_id: Optional[str] = None, progress_cb: Optional[ProgressCallback] = None,
    publish: bool = True,
) -> int:
    """
    IPO Vintage — opening-range breakout on recently listed stocks (no ML).

    Unlike LaunchPad/Alpha Zone, this does NOT scan the full ~2150-symbol
    universe — its universe is the small, explicitly tracked `ipo_listings`
    collection (recently listed stocks only), so a full pass is cheap regardless
    of where in the coordinator pipeline it runs. For each tracked listing,
    `build_ipo_vintage_result` checks whether a session has yet CLOSED above the
    opening candle's HIGH; it reads the same OHLCV cache every other strategy
    uses, so there is no separate ingestion job.

    Missing-listing-candle symbols are counted and logged separately rather than
    silently dropped: a listing whose opening bar isn't in `Stock_Data.csv` is a
    real data-coverage gap (stock listed before the 5-year window starts, or the
    universe CSV predates the listing so it was never downloaded), and a silent
    drop makes the scanner look empty when the real fault is upstream.

    `publish` / `progress_cb` behave exactly as documented on
    `run_launchpad_scan` above.
    """
    from services.ohlc_downloader import load_stock_dataframe
    from .ipo_vintage import build_ipo_vintage_result

    scan_id = scan_id or _new_scan_id("IV")
    log.info(f"[{scan_id}] [ipo_vintage] scan starting")
    t0 = time.time()

    # Keep the tracked universe current automatically — a new listing appears
    # the moment its price history lands, with no manual POST required.
    try:
        await discover_ipo_listings(db)
    except Exception as e:
        log.warning(f"[{scan_id}] [ipo_vintage] listing auto-discovery failed: {e}")

    listings = await db.get_collection("ipo_listings").find({}, {"_id": 0}).to_list(length=5000)

    results: list[dict] = []
    no_price_data: list[str] = []   # symbol absent from the OHLCV cache entirely
    no_signal = 0                   # has data, just hasn't broken its opening range
    for i, listing in enumerate(listings):
        symbol = listing.get("symbol")
        if not symbol:
            continue
        df = load_stock_dataframe(symbol)
        if df.empty:
            no_price_data.append(symbol)
            continue
        try:
            res = build_ipo_vintage_result(
                symbol=symbol,
                company_name=listing.get("company_name") or symbol,
                df=df,
                listing_date=listing.get("listing_date"),
                issue_price=listing.get("issue_price"),
            )
        except Exception as e:
            log.warning(f"[ipo_vintage] evaluate failed for {symbol}: {e}")
            continue
        if res is not None:
            results.append(res)
        else:
            no_signal += 1

        if progress_cb and (i + 1) % 50 == 0:
            await progress_cb(i + 1, len(listings))

    if publish:
        col = db.get_collection("ipo_vintage_cache")
        await col.delete_many({})
        if results:
            await col.insert_many(results)
        after_count = len(results)
    else:
        from engines.orchestration.publish import write_staged
        after_count = await write_staged(db, "ipo_vintage_cache", results)

    _CACHE_META["ipo_vintage_cache"] = {
        "scan_id": scan_id, "written_at": datetime.now(timezone.utc), "count": after_count,
    }
    if progress_cb:
        await progress_cb(len(listings), len(listings))

    by_status = {"live": 0, "stopped": 0, "expired": 0}
    for r in results:
        st = r.get("setup_status", "expired")
        by_status[st] = by_status.get(st, 0) + 1
    log.info(
        f"[{scan_id}] [ipo_vintage] scan finished: {by_status['live']} LIVE setups "
        f"(+{by_status['stopped']} stopped, {by_status['expired']} expired = track record only) "
        f"from {len(listings)} tracked listings — {no_signal} tracked but no breakout yet — "
        f"in {time.time() - t0:.1f}s"
    )
    # Refresh the historical study alongside the live setups so the proof panel
    # never drifts out of sync with the cards.
    try:
        await run_ipo_vintage_study(db)
    except Exception as e:
        log.warning(f"[{scan_id}] [ipo_vintage] study build failed: {e}")

    if no_price_data:
        # Loud on purpose: this is a data-coverage gap (stale universe CSV or a
        # listing predating Stock_Data.csv), not "no setups today".
        log.warning(
            f"[{scan_id}] [ipo_vintage] {len(no_price_data)} tracked listing(s) have NO price data "
            f"in the OHLCV cache and were skipped: {', '.join(no_price_data[:20])}"
            f"{'…' if len(no_price_data) > 20 else ''} "
            f"— refresh the universe (scripts/refresh_upstox_symbols.py) and re-run the download."
        )
    return len(results)


async def build_company_map(db) -> dict:
    """Symbol → company_name, sourced from the existing screener_cache."""
    out: dict = {}
    async for d in db.get_collection("screener_cache").find({}, {"symbol": 1, "company_name": 1, "_id": 0}):
        if d.get("symbol"):
            out[d["symbol"]] = d.get("company_name") or d["symbol"]
    return out
