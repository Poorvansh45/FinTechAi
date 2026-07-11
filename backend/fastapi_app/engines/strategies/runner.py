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
from typing import Optional

from engines.indicators import IndicatorEngine
from .base import Strategy, SymbolContext, MarketContext

log = logging.getLogger("finai_edge.strategy_runner")

MIN_ROWS = 210  # need EMA200 warmup


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


async def run_launchpad_scan(db) -> int:
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
    Populates `launchpad_cache` (delete_many + insert_many, a complete rebuild).
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

    t0 = time.time()
    strat = LaunchPadStrategy()
    company = await build_company_map(db)
    symbols = get_cached_symbols()

    results: list[dict] = []
    scanned = fvg_checked = 0
    for sym in symbols:
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

        # Cheap gate 2: EMA200 trend band (IndicatorEngine also gives us ATR/RSI).
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

    col = db.get_collection("launchpad_cache")
    await col.delete_many({})
    if results:
        await col.insert_many(results)
    log.info(
        f"[launchpad] direct OHLCV scan: {len(results)} matches "
        f"(EMA-band survivors {fvg_checked}, indicators computed {scanned}) "
        f"in {time.time() - t0:.1f}s"
    )
    return len(results)


# Backward-compatible alias — LaunchPad no longer reads any FVG cache, but callers
# that still import the old name keep working.
run_launchpad_from_cache = run_launchpad_scan


async def run_alphazone_scan(db) -> int:
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
    Populates `alpha_zone_cache` (delete_many + insert_many, a complete rebuild).
    """
    from services.ohlc_downloader import get_cached_symbols, load_stock_dataframe
    from engines.indicators import IndicatorEngine
    from engines.strategies.alpha_zone_ob import nearest_reacting_ob
    from engines.strategies.alpha_zone import build_alphazone_result

    MIN_PRICE = 200.0
    EMA_DIST_MIN, EMA_DIST_MAX = -35.0, 40.0

    t0 = time.time()
    company = await build_company_map(db)
    symbols = get_cached_symbols()

    results: list[dict] = []
    scanned = ob_checked = 0
    for sym in symbols:
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

        ind = IndicatorEngine.compute(df)           # gate 2: EMA200 band
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
            )
        except Exception as e:
            log.warning(f"[alpha_zone] evaluate failed for {sym}: {e}")
            continue
        if res is not None:
            results.append(res)

    col = db.get_collection("alpha_zone_cache")
    await col.delete_many({})
    if results:
        await col.insert_many(results)
    log.info(
        f"[alpha_zone] direct OHLCV scan: {len(results)} matches "
        f"(EMA-band survivors {ob_checked}, indicators computed {scanned}) "
        f"in {time.time() - t0:.1f}s"
    )
    return len(results)


# Backward-compatible alias — Alpha Zone no longer reads the SMC cache.
run_alphazone_from_cache = run_alphazone_scan


async def build_company_map(db) -> dict:
    """Symbol → company_name, sourced from the existing screener_cache."""
    out: dict = {}
    async for d in db.get_collection("screener_cache").find({}, {"symbol": 1, "company_name": 1, "_id": 0}):
        if d.get("symbol"):
            out[d["symbol"]] = d.get("company_name") or d["symbol"]
    return out
