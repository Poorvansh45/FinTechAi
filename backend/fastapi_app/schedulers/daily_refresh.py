"""
FinAI Edge — Daily Scheduler (v2)
=====================================
Runs all scanner pipelines on startup (if stale) and daily at 15:45 IST.

Pipeline:
  1. Trigger EOD Ingest/Download -> Updates Stock_Data.csv
  2. Load Stock_Data.csv
  3. Execute Screeners (Technical, FVG, Volume, Momentum, SMC) using local data
  4. Save results to MongoDB caches
"""

import os
import asyncio
import logging
import math
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional

import pandas as pd
import numpy as np
from pymongo import UpdateOne

from services.ohlc_downloader import (
    download_incremental_ohlc,
    get_downloader_paths,
    load_stock_dataframe,
    get_cached_symbols
)

log = logging.getLogger("finai_edge.scheduler")

NIFTY_SYMBOL = "^NSEI"
BULK_BATCH_SIZE = 100

def _safe(v) -> Optional[float]:
    try:
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else round(f, 4)
    except Exception:
        return None


# ── Core per-symbol computation ───────────────────────────────────────────────

def _compute_symbol_local(
    symbol: str,
    df: pd.DataFrame,
    nifty_1m_return: float,
) -> Optional[Dict[str, Any]]:
    """
    Compute indicators, FVG, SMC, Momentum, and Volume Surge locally for a single symbol.
    """
    try:
        df["Close"]   = pd.to_numeric(df["Close"], errors="coerce")
        df["High"]    = pd.to_numeric(df["High"],  errors="coerce")
        df["Low"]     = pd.to_numeric(df["Low"],   errors="coerce")
        df["Volume"]  = pd.to_numeric(df["Volume"],errors="coerce")
        df.dropna(subset=["Close"], inplace=True)
        df.sort_values("Date", inplace=True)
        df.reset_index(drop=True, inplace=True)

        if len(df) < 30:
            return None

        close  = df["Close"].values
        volume = df["Volume"].values
        high   = df["High"].values
        low    = df["Low"].values
        ltp    = float(close[-1])

        # ── Indicators ──────────────────────────────────────────────────
        def ema(arr, period):
            s = pd.Series(arr)
            return s.ewm(span=period, adjust=False).mean().values

        ema_9   = ema(close, 9)
        ema_50  = ema(close, 50)
        ema_200 = ema(close, 200)

        ema50_val   = _safe(ema_50[-1])
        ema200_val  = _safe(ema_200[-1])
        ema50_dist  = _safe((ltp - ema_50[-1]) / ema_50[-1] * 100) if ema_50[-1] else None
        ema200_dist = _safe((ltp - ema_200[-1]) / ema_200[-1] * 100) if ema_200[-1] else None

        # RSI (Wilder's smoothing — matches TradingView / TA-Lib)
        delta   = pd.Series(close).diff()
        gain    = delta.clip(lower=0)
        loss    = (-delta.clip(upper=0))
        avg_gain = gain.ewm(alpha=1/14, min_periods=14, adjust=False).mean()
        avg_loss = loss.ewm(alpha=1/14, min_periods=14, adjust=False).mean()
        rs      = avg_gain / avg_loss.replace(0, np.nan)
        rsi_14  = _safe(100 - (100 / (1 + rs.iloc[-1])))

        # MACD
        ema_12  = ema(close, 12)
        ema_26  = ema(close, 26)
        macd_line   = ema_12 - ema_26
        signal_line = ema(macd_line, 9)
        macd_hist   = _safe(macd_line[-1] - signal_line[-1])
        macd_val    = _safe(macd_line[-1])

        # Volume
        avg_vol_20  = _safe(float(pd.Series(volume).rolling(20, min_periods=5).mean().iloc[-1]))
        curr_vol    = _safe(float(volume[-1]))
        vol_ratio   = _safe(curr_vol / avg_vol_20) if avg_vol_20 and avg_vol_20 > 0 else None

        # 52-week
        wk52_high = _safe(float(high[-252:].max())) if len(high) >= 252 else _safe(float(high.max()))
        wk52_low  = _safe(float(low[-252:].min())) if len(low) >= 252 else _safe(float(low.min()))
        wk52_dist = _safe((ltp - wk52_high) / wk52_high * 100) if wk52_high else None

        # 1-month return for relative strength
        stock_1m = _safe((ltp - float(close[-21])) / float(close[-21]) * 100) if len(close) >= 21 else None
        rs_vs_nifty = _safe(stock_1m - nifty_1m_return) if stock_1m is not None else None

        # ── FVG (lazy import) ─────────────────────────────────────────
        fvg_data = {}
        try:
            from scanners.fvg import get_latest_fvgs_for_symbol
            fvg_result = get_latest_fvgs_for_symbol(
                df, symbol, ltp, rsi=rsi_14, ema_200_dist=ema200_dist
            )
            fvg_data = fvg_result
        except Exception:
            pass

        # ── Momentum score ────────────────────────────────────────────
        mom_score = 0
        try:
            from scanners.momentum import compute_momentum_score, get_momentum_category
            mom_score = compute_momentum_score(
                rsi=rsi_14,
                ema_50_dist_pct=ema50_dist,
                ema_200_dist_pct=ema200_dist,
                volume_ratio=vol_ratio,
                week52_high_dist_pct=wk52_dist,
                relative_strength=rs_vs_nifty,
                macd_hist=macd_hist,
            )
            mom_category = get_momentum_category(mom_score)
        except Exception:
            mom_category = "Unknown"

        # ── Volume surge ──────────────────────────────────────────────
        surge_data = {}
        try:
            from scanners.volume import detect_volume_surges
            surge_data = detect_volume_surges(df, symbol)
        except Exception:
            pass

        # ── SMC Analysis ──────────────────────────────────────────────
        smc_data = {}
        try:
            from scanners.smc_scanner import run_full_smc_analysis
            smc_data = run_full_smc_analysis(
                df, symbol, swing_len=5, rsi=rsi_14, volume_ratio=vol_ratio
            )
        except Exception as smc_exc:
            log.warning(f"[Scheduler] SMC analysis failed for {symbol}: {smc_exc}")

        return {
            "symbol":      symbol,
            "smc_data":    smc_data,
            "price":       round(ltp, 2),
            "ltp":         round(ltp, 2),
            "volume":      curr_vol,
            "avg_volume_20d": avg_vol_20,
            "volume_ratio": vol_ratio,
            "week52_high": wk52_high,
            "week52_low":  wk52_low,
            "week52_high_dist_pct": wk52_dist,
            "indicators": {
                "ema_9":             _safe(ema_9[-1]),
                "ema_50":            ema50_val,
                "ema_200":           ema200_val,
                "ema_50_dist_pct":   ema50_dist,
                "ema_200_dist_pct":  ema200_dist,
                "rsi_14":            rsi_14,
                "macd":              macd_val,
                "macd_hist":         macd_hist,
            },
            # Momentum fields
            "momentum_score":   mom_score,
            "category":         mom_category,
            "rsi":              rsi_14,
            "ema_50_dist_pct":  ema50_dist,
            "ema_200_dist_pct": ema200_dist,
            "relative_strength": rs_vs_nifty,
            "above_ema50":      ema50_dist > 0 if ema50_dist is not None else None,
            "above_ema200":     ema200_dist > 0 if ema200_dist is not None else None,
            # FVG fields
            **({k: v for k, v in fvg_data.items()} if fvg_data else {}),
            # Volume surge fields
            **({k: v for k, v in surge_data.items() if k not in ("symbol",)} if surge_data else {}),
            "updated_at": datetime.now(timezone.utc),
        }

    except Exception as e:
        log.error(f"[Scheduler] Error computing {symbol}: {e}")
        return None


async def _bulk_write_results(db, batch_data: List[tuple]) -> None:
    """
    Executes bulk MongoDB write operations for a batch of computed symbols.
    """
    screener_ops = []
    fvg_ops = []
    surge_ops = []
    momentum_ops = []
    smc_ops = []
    zones_ops = []

    screener_col = db.get_collection("screener_cache")
    fvg_col      = db.get_collection("fvg_cache")
    surge_col    = db.get_collection("volume_surge_cache")
    momentum_col = db.get_collection("momentum_cache")
    smc_col      = db.get_collection("smc_scanner_results")
    zones_col    = db.get_collection("smc_zones")

    for sym, result in batch_data:
        try:
            from utils.helpers import normalize_symbol
            sym = normalize_symbol(sym)
            result["symbol"] = normalize_symbol(result["symbol"])
            # ── screener_cache (technical) ───────────────────────
            screener_doc = {
                "symbol":      result["symbol"],
                "price":       result["price"],
                "volume":      result["volume"],
                "avg_volume_20d": result.get("avg_volume_20d"),
                "indicators":  result["indicators"],
                "updated_at":  result["updated_at"],
            }
            screener_ops.append(UpdateOne(
                {"symbol": sym}, {"$set": screener_doc}, upsert=True
            ))

            # ── fvg_cache ────────────────────────────────────────
            if result.get("has_fvg_bullish") or result.get("top_bullish_fvgs"):
                fvg_doc = {
                    "symbol":              result["symbol"],
                    "ltp":                 result["ltp"],
                    "has_fvg_bullish":     result.get("has_fvg_bullish", False),
                    "has_fvg_bearish":     result.get("has_fvg_bearish", False),
                    "total_fvgs_bullish":  result.get("total_fvgs_bullish", 0),
                    "top_bullish_fvgs":    result.get("top_bullish_fvgs", []),
                    "top_bearish_fvgs":    result.get("top_bearish_fvgs", []),
                    "nearest_bullish_fvg": result.get("nearest_bullish_fvg"),
                    "best_fvg_score":      result.get("best_fvg_score", 0),
                    "indicators":          result["indicators"],
                    "updated_at":          result["updated_at"],
                }
                fvg_ops.append(UpdateOne(
                    {"symbol": sym}, {"$set": fvg_doc}, upsert=True
                ))

            # ── volume_surge_cache ───────────────────────────────
            if result.get("surge_stats") or result.get("surge_history"):
                surge_doc = {
                    "symbol":               result["symbol"],
                    "ltp":                  result["ltp"],
                    "has_current_surge":    result.get("has_current_surge", False),
                    "current_volume_ratio": result.get("current_volume_ratio"),
                    "surge_history":        result.get("surge_history", []),
                    "surge_stats":          result.get("surge_stats", {}),
                    "updated_at":           result["updated_at"],
                }
                surge_ops.append(UpdateOne(
                    {"symbol": sym}, {"$set": surge_doc}, upsert=True
                ))

            # ── momentum_cache ───────────────────────────────────
            mom_doc = {
                "symbol":              result["symbol"],
                "ltp":                 result["ltp"],
                "momentum_score":      result.get("momentum_score", 0),
                "category":            result.get("category", "Unknown"),
                "rsi":                 result.get("rsi"),
                "ema_50_dist_pct":     result.get("ema_50_dist_pct"),
                "ema_200_dist_pct":    result.get("ema_200_dist_pct"),
                "volume_ratio":        result.get("volume_ratio"),
                "week52_high_dist_pct": result.get("week52_high_dist_pct"),
                "relative_strength":   result.get("relative_strength"),
                "above_ema50":         result.get("above_ema50"),
                "above_ema200":        result.get("above_ema200"),
                "updated_at":          result["updated_at"],
            }
            momentum_ops.append(UpdateOne(
                {"symbol": sym}, {"$set": mom_doc}, upsert=True
            ))

            # ── SMC ──────────────────────────────────────────────
            smc_res = result.get("smc_data")
            if smc_res:
                from services.smc_service import _serialize
                smc_clean = _serialize(smc_res)
                smc_clean["updated_at"] = result["updated_at"]
                smc_ops.append(UpdateOne(
                    {"symbol": sym}, {"$set": smc_clean}, upsert=True
                ))

                all_zones = (
                    smc_res.get("demand_zones", []) +
                    smc_res.get("supply_zones", []) +
                    smc_res.get("internal_demand_zones", []) +
                    smc_res.get("internal_supply_zones", [])
                )
                for zone in all_zones:
                    zone_clean = _serialize(zone)
                    zone_clean["symbol"] = sym
                    zones_ops.append(UpdateOne(
                        {"symbol": sym, "zone_high": zone["zone_high"], "zone_low": zone["zone_low"]},
                        {"$set": zone_clean},
                        upsert=True,
                    ))

        except Exception as e:
            log.warning(f"[Scheduler] DB doc preparation failed for {sym}: {e}")

    # Write in bulk
    try:
        if screener_ops:  await screener_col.bulk_write(screener_ops, ordered=False)
        if fvg_ops:       await fvg_col.bulk_write(fvg_ops, ordered=False)
        if surge_ops:     await surge_col.bulk_write(surge_ops, ordered=False)
        if momentum_ops:  await momentum_col.bulk_write(momentum_ops, ordered=False)
        if smc_ops:       await smc_col.bulk_write(smc_ops, ordered=False)
        if zones_ops:     await zones_col.bulk_write(zones_ops, ordered=False)
    except Exception as e:
        log.error(f"[Scheduler] Bulk write operations failed: {e}")


# ── Batch pipeline ────────────────────────────────────────────────────────────

async def run_daily_scan(app_state, force: bool = False) -> None:
    """
    Main scan entry point. Called on startup (if stale) and by APScheduler.
    Uses the unified local Stock_Data.csv file.
    """
    db         = app_state.db
    market_svc = app_state.market_service

    if db is None:
        log.warning("[Scheduler] No DB — skipping scan")
        return

    log.info("[Scheduler] Starting EOD pipeline (Local Stock_Data.csv source)…")
    start_time = datetime.now(timezone.utc)
    meta_col = db.get_collection("scan_meta")

    try:
        # 1. Trigger Incremental Sync / Downloader first
        try:
            log.info("[Scheduler] Syncing local stock data file incrementally...")
            await download_incremental_ohlc()
        except Exception as e:
            log.error(f"[Scheduler] Incremental ingestion failed: {e}. Attempting calculation with existing file.")

        # 2. Load cached symbols from cache
        symbols = get_cached_symbols()
        if not symbols:
            log.error("[Scheduler] No stocks found in cached Stock_Data.csv — aborting scan")
            return

        # Normalize and deduplicate symbols list
        from utils.helpers import normalize_symbol
        symbols = [normalize_symbol(s) for s in symbols if s]
        symbols = list(dict.fromkeys(symbols)) # deduplicate keeping order

        log.info(f"[Scheduler] Loaded database with {len(symbols)} cached tickers")

        # 4. Check if today's scan already ran
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
                    log.info(f"[Scheduler] Scan ran {age_hours:.1f}h ago — skipping")
                    return

        # Update metadata status to running
        await meta_col.update_one(
            {"_id": "daily_scan"},
            {"$set": {
                "status": "RUNNING",
                "started_at": start_time,
                "total_symbols": len(symbols),
                "symbols_processed": 0,
                "symbols_errored": 0,
            }},
            upsert=True
        )

        # 5. Calculate Nifty baseline return from Stock_Data.csv
        nifty_1m_return = 0.0
        try:
            nifty_df = load_stock_dataframe(NIFTY_SYMBOL)
            if not nifty_df.empty and len(nifty_df) >= 21:
                closes = nifty_df["Close"].values
                nifty_1m_return = (closes[-1] - closes[-21]) / closes[-21] * 100 if closes[-21] else 0.0
            log.info(f"[Scheduler] Nifty50 1M return from Stock_Data.csv: {nifty_1m_return:.2f}%")
        except Exception as e:
            log.warning(f"[Scheduler] Nifty baseline load from Stock_Data.csv failed: {e}")

        # 6. Compute metrics locally in-memory using cached DataFrames
        processed = 0
        errors = 0
        
        batch_data = []

        loop = asyncio.get_running_loop()

        for symbol in symbols:
            try:
                df_group = load_stock_dataframe(symbol)
                if df_group.empty:
                    continue

                # Take last 2 years of daily data (approx. 504 rows) for scanner alignment
                df_symbol = df_group.tail(504).reset_index(drop=True)
                if len(df_symbol) < 30:
                    continue

                # Run in thread pool to prevent blocking the event loop
                result = await loop.run_in_executor(
                    None, _compute_symbol_local, symbol, df_symbol, nifty_1m_return
                )

                if result:
                    batch_data.append((symbol, result))
                    processed += 1
                else:
                    errors += 1

                # Execute bulk updates once batch matches threshold
                if len(batch_data) >= BULK_BATCH_SIZE:
                    await _bulk_write_results(db, batch_data)
                    batch_data = []
                    log.info(f"[Scheduler] Processed {processed}/{len(symbols)} tickers...")
                    await meta_col.update_one(
                        {"_id": "daily_scan"},
                        {"$set": {
                            "symbols_processed": processed,
                            "symbols_errored": errors,
                        }}
                    )

            except Exception as e:
                log.warning(f"[Scheduler] Failed to compute results for {symbol}: {e}")
                errors += 1

        # Write remaining items
        if batch_data:
            await _bulk_write_results(db, batch_data)
            await meta_col.update_one(
                {"_id": "daily_scan"},
                {"$set": {
                    "symbols_processed": processed,
                    "symbols_errored": errors,
                }}
            )

        # 7. Update zone proximity search
        try:
            from services.zone_search_service import run_zone_proximity_search
            await run_zone_proximity_search(db)
            log.info("[Scheduler] Zone proximity search updated successfully")
        except Exception as e:
            log.error(f"[Scheduler] Zone proximity search update failed: {e}")

        elapsed = (datetime.now(timezone.utc) - start_time).total_seconds()
        
        # Save completion stats
        screener_cache_count = await db.get_collection("screener_cache").count_documents({})
        await meta_col.update_one(
            {"_id": "daily_scan"},
            {"$set": {
                "status":            "COMPLETED",
                "last_ran":          datetime.now(timezone.utc),
                "last_scan_time":    datetime.now(timezone.utc),
                "record_count":      screener_cache_count,
                "symbols_processed": screener_cache_count,
                "symbols_errored":   errors,
                "total_symbols":     screener_cache_count,
                "elapsed_seconds":   round(elapsed, 1),
                "scan_duration":     round(elapsed, 1),
            }},
            upsert=True,
        )
        
        log.info(f"[Scheduler] Daily scan completed. Synced {screener_cache_count} symbols in {elapsed:.1f}s ({errors} errors).")

    except Exception as exc:
        log.error(f"[Scheduler] Scan execution failed: {exc}", exc_info=True)
        await meta_col.update_one(
            {"_id": "daily_scan"},
            {"$set": {
                "status": "FAILED",
                "error": str(exc),
                "last_ran": datetime.now(timezone.utc),
                "last_scan_time": datetime.now(timezone.utc),
            }},
            upsert=True
        )


async def get_latest_nse_trading_day(market_svc) -> datetime.date:
    """
    Fetches the latest EOD date of a benchmark symbol (Nifty 50) to determine 
    the last completed trading day, holiday-aware.
    Falls back to timezone-aware calendar calculations if the fetch fails.
    """
    try:
        # Fetch last 5 EOD candles for ^NSEI to identify the latest completed trading day
        candles = await market_svc.get_historical("^NSEI", interval="1d", period="5d")
        if candles:
            last_date = pd.to_datetime(candles[-1].timestamp).date()
            log.info(f"[Scheduler] Benchmark Nifty 50 indicates latest NSE EOD date is: {last_date}")
            return last_date
    except Exception as e:
        log.warning(f"[Scheduler] Failed to fetch benchmark EOD date: {e}. Falling back to calendar logic.")

    # Fallback Calendar Logic
    india_tz = timezone(timedelta(hours=5, minutes=30))
    now_india = datetime.now(india_tz)
    today_local = now_india.date()
    current_hour = now_india.hour
    weekday = now_india.weekday()
    
    if weekday == 5:  # Saturday
        return today_local - timedelta(days=1)
    elif weekday == 6:  # Sunday
        return today_local - timedelta(days=2)
    elif weekday == 0 and current_hour < 16:  # Monday morning
        return today_local - timedelta(days=3)
    elif current_hour < 16:  # Other weekday morning
        return today_local - timedelta(days=1)
    else:  # Weekday evening
        return today_local


async def perform_startup_recovery(app_state) -> None:
    """
    Executes the startup check and backfills missing candles dynamically.
    Recalculates scanners if any backfill occurred.
    """
    db = getattr(app_state, "db", None)
    market_svc = getattr(app_state, "market_service", None)
    if db is None or market_svc is None:
        log.warning("[Scheduler] DB or Market Service missing — skipping startup recovery")
        return
        
    log.info("[Scheduler] Starting startup recovery check...")
    
    # Step 1: Ensure cache is populated
    from services.ohlc_downloader import refresh_in_memory_cache, get_cached_symbols, load_stock_dataframe, get_downloader_paths
    paths = get_downloader_paths()
    output_csv = paths["output_csv"]
    
    if not os.path.exists(output_csv):
        log.info("[Scheduler] Stock_Data.csv is missing. Triggering first-time sync...")
        await download_incremental_ohlc()
        log.info("[Scheduler] Initial ingestion complete. Skipping automatic scan calculation on startup.")
        return

    # Populate in-memory cache
    refresh_in_memory_cache()
    
    # Step 2: Determine latest completed NSE trading day
    latest_completed_day = await get_latest_nse_trading_day(market_svc)
    
    # Step 3: Check latest date present in Stock_Data.csv for each symbol
    symbols = get_cached_symbols()
    if not symbols:
        log.warning("[Scheduler] No cached symbols found in Stock_Data.csv. Ingesting universe...")
        await download_incremental_ohlc()
        log.info("[Scheduler] Ingestion complete. Skipping automatic scan calculation on startup.")
        return
        
    needs_backfill = False
    for sym in symbols:
        df = load_stock_dataframe(sym)
        if df.empty:
            needs_backfill = True
            break
        # load_stock_dataframe returns capitalized Date
        last_date = pd.to_datetime(df.iloc[-1]["Date"]).date()
        if last_date < latest_completed_day:
            needs_backfill = True
            log.info(f"[Scheduler] Stock {sym} last date is {last_date}, which is before latest trading day {latest_completed_day}.")
            break

    if needs_backfill:
        log.info("[Scheduler] Missing EOD candles detected. Commencing incremental backfill...")
        await download_incremental_ohlc()
        log.info("[Scheduler] Backfill sync complete. Skipping automatic scan calculation on startup.")
    else:
        log.info("[Scheduler] Stock_Data.csv is already up-to-date with latest EOD data. Skipping backfill.")


async def run_pre_market_check(app_state) -> None:
    """Pre-market check redirects to startup recovery."""
    await perform_startup_recovery(app_state)


async def maybe_run_on_startup(app_state) -> None:
    """Invoked on FastAPI startup."""
    await perform_startup_recovery(app_state)


def setup_scheduler(app_state) -> None:
    """
    Registers APScheduler jobs.
    """
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.cron import CronTrigger

        scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")
        
        # 1. Pre-market check at 08:00 AM IST
        scheduler.add_job(
            run_pre_market_check,
            CronTrigger(hour=8, minute=0),
            args=[app_state],
            id="pre_market_check",
            replace_existing=True,
            misfire_grace_time=600,
        )

        # 2. Daily EOD scan at 09:00 AM IST
        scheduler.add_job(
            run_daily_scan,
            CronTrigger(hour=9, minute=0),
            args=[app_state],
            id="daily_scan",
            replace_existing=True,
            misfire_grace_time=600,
        )
        
        scheduler.start()
        log.info("[Scheduler] APScheduler EOD scan jobs registered")
        return scheduler

    except ImportError:
        log.warning("[Scheduler] apscheduler not installed — manual triggers only.")
        return None
