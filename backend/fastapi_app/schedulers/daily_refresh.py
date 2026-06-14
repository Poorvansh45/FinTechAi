"""
FinAI Edge — Daily Scheduler (v2)
=====================================
Runs all scanner pipelines on startup (if stale) and daily at 15:45 IST.

Pipeline:
  1. Technical screener  (screener_cache)
  2. Volume surge        (volume_surge_cache)
  3. FVG scanner         (fvg_cache)
  4. Momentum scanner    (momentum_cache)
  5. SMC scanner         (smc_zones + smc_scanner_results)

Scheduler logic:
  - On startup: check if today's scan already ran → skip if yes
  - Daily cron: 15:45 IST (10:15 UTC)
  - Each symbol processed in semaphore-limited async batches (max 10 concurrent)
"""

import asyncio
import logging
import math
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional

import pandas as pd
import numpy as np

log = logging.getLogger("finai_edge.scheduler")

NIFTY_SYMBOL = "^NSEI"
BATCH_SIZE   = 10      # concurrent symbols per batch
RATE_SLEEP   = 0.3     # seconds between batches (yfinance rate-limit)


def _safe(v) -> Optional[float]:
    try:
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else round(f, 4)
    except Exception:
        return None


# ── Core per-symbol computation ───────────────────────────────────────────────

async def _compute_symbol(
    symbol: str,
    market_svc,
    nifty_1m_return: float,
) -> Optional[Dict[str, Any]]:
    """
    Fetch 2-year history + compute all indicators for one symbol.
    Returns a combined record ready for upsert into all caches.
    """
    try:
        candles = await market_svc.get_historical(symbol, interval="1d", period="2y")
        if not candles or len(candles) < 60:
            return None

        df = pd.DataFrame([c.model_dump() for c in candles])
        df.rename(columns={"timestamp": "Date", "date": "Date", "open": "Open", "high": "High",
                           "low": "Low", "close": "Close", "volume": "Volume"}, inplace=True)
        df["Date"]    = pd.to_datetime(df["Date"])
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
        # Wilder's EMA: alpha = 1/period (not span-based EMA)
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
        wk52_high = _safe(float(high[-252:].max()))
        wk52_low  = _safe(float(low[-252:].min()))
        wk52_dist = _safe((ltp - wk52_high) / wk52_high * 100) if wk52_high else None

        # 1-month return for relative strength
        stock_1m = _safe((ltp - float(close[-21])) / float(close[-21]) * 100) if len(close) >= 21 else None
        rs_vs_nifty = _safe(stock_1m - nifty_1m_return) if stock_1m is not None else None

        # ── FVG (lazy import) ─────────────────────────────────────────
        fvg_data = {}
        try:
            from scanners.fvg import get_latest_fvgs_for_symbol
            fvg_result = await asyncio.to_thread(
                get_latest_fvgs_for_symbol, df, symbol, ltp,
                rsi=rsi_14, ema_200_dist=ema200_dist
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
            surge_data = await asyncio.to_thread(detect_volume_surges, df, symbol)
        except Exception:
            pass

        # ── SMC Analysis ──────────────────────────────────────────────
        smc_data = {}
        try:
            from scanners.smc_scanner import run_full_smc_analysis
            smc_data = await asyncio.to_thread(
                run_full_smc_analysis, df, symbol,
                swing_len=5, rsi=rsi_14, volume_ratio=vol_ratio
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
        import traceback
        log.warning(f"[Scheduler] Error computing {symbol}: {e}\n{traceback.format_exc()}")
        return None


# ── Batch pipeline ────────────────────────────────────────────────────────────

async def run_daily_scan(app_state, force: bool = False) -> None:
    """
    Main scan entry point. Called on startup (if stale) and by APScheduler.

    Writes to:
      screener_cache       — technical screener data
      fvg_cache            — FVG scanner
      volume_surge_cache   — volume surge per-surge history
      momentum_cache       — momentum scorer
      smc_scanner_results  — SMC scanner results
      smc_zones            — SMC demand/supply zones
      scan_meta            — scan timestamp and status
    """
    db         = app_state.db
    market_svc = app_state.market_service

    if db is None:
        log.warning("[Scheduler] No DB — skipping scan")
        return

    log.info("[Scheduler] Starting daily scan pipeline…")
    start_time = datetime.now(timezone.utc)

    # ── Check if today's scan already ran ─────────────────────────────
    meta_col = db.get_collection("scan_meta")
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

    # ── Get NSE universe ──────────────────────────────────────────────
    try:
        from services.universe_cache import get_universe
        symbols = await get_universe(db)
    except Exception as e:
        log.error(f"[Scheduler] Failed to get universe: {e}")
        return

    if not symbols:
        log.error("[Scheduler] Empty universe — aborting")
        return

    log.info(f"[Scheduler] Universe: {len(symbols)} symbols")

    # ── Update status to running ─────────────────────────────────────
    await meta_col.update_one(
        {"_id": "daily_scan"},
        {"$set": {
            "status": "running",
            "started_at": start_time,
            "total_symbols": len(symbols),
            "symbols_processed": 0,
            "symbols_errored": 0,
        }},
        upsert=True
    )

    # ── Nifty 50 baseline (1-month return) ────────────────────────────
    nifty_1m_return = 0.0
    try:
        nifty_candles = await market_svc.get_historical(NIFTY_SYMBOL, interval="1d", period="3mo")
        if nifty_candles and len(nifty_candles) >= 21:
            closes = [c.close for c in nifty_candles if c.close]
            nifty_1m_return = (closes[-1] - closes[-21]) / closes[-21] * 100 if closes[-21] else 0.0
        log.info(f"[Scheduler] Nifty50 1M return: {nifty_1m_return:.2f}%")
    except Exception as e:
        log.warning(f"[Scheduler] Nifty fetch failed: {e}")

    # ── Process in batches ────────────────────────────────────────────
    screener_col    = db.get_collection("screener_cache")
    fvg_col         = db.get_collection("fvg_cache")
    surge_col       = db.get_collection("volume_surge_cache")
    momentum_col    = db.get_collection("momentum_cache")
    smc_col         = db.get_collection("smc_scanner_results")
    zones_col       = db.get_collection("smc_zones")

    total     = len(symbols)
    processed = 0
    errors    = 0
    status    = "complete"

    try:
        for batch_start in range(0, total, BATCH_SIZE):
            batch = symbols[batch_start : batch_start + BATCH_SIZE]
            tasks = [_compute_symbol(sym, market_svc, nifty_1m_return) for sym in batch]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            for sym, result in zip(batch, results):
                if isinstance(result, Exception) or result is None:
                    errors += 1
                    continue

                try:
                    # ── screener_cache (technical) ───────────────────────
                    screener_doc = {
                        "symbol":      result["symbol"],
                        "price":       result["price"],
                        "volume":      result["volume"],
                        "avg_volume_20d": result.get("avg_volume_20d"),
                        "indicators":  result["indicators"],
                        "updated_at":  result["updated_at"],
                    }
                    await screener_col.update_one(
                        {"symbol": sym}, {"$set": screener_doc}, upsert=True
                    )

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
                        await fvg_col.update_one(
                            {"symbol": sym}, {"$set": fvg_doc}, upsert=True
                        )

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
                        await surge_col.update_one(
                            {"symbol": sym}, {"$set": surge_doc}, upsert=True
                        )

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
                    await momentum_col.update_one(
                        {"symbol": sym}, {"$set": mom_doc}, upsert=True
                    )

                    # ── SMC ──────────────────────────────────────────────
                    smc_res = result.get("smc_data")
                    if smc_res:
                        from services.smc_service import _serialize
                        smc_clean = _serialize(smc_res)
                        smc_clean["updated_at"] = result["updated_at"]
                        await smc_col.update_one(
                            {"symbol": sym}, {"$set": smc_clean}, upsert=True
                        )

                        all_zones = (
                            smc_res.get("demand_zones", []) +
                            smc_res.get("supply_zones", []) +
                            smc_res.get("internal_demand_zones", []) +
                            smc_res.get("internal_supply_zones", [])
                        )
                        for zone in all_zones:
                            zone_clean = _serialize(zone)
                            zone_clean["symbol"] = sym
                            await zones_col.update_one(
                                {"symbol": sym, "zone_high": zone["zone_high"], "zone_low": zone["zone_low"]},
                                {"$set": zone_clean},
                                upsert=True,
                            )

                    processed += 1

                except Exception as e:
                    log.warning(f"[Scheduler] DB write failed for {sym}: {e}")
                    errors += 1

            # Rate limit pause between batches
            await asyncio.sleep(RATE_SLEEP)

            if (batch_start // BATCH_SIZE) % 20 == 0:
                pct = (batch_start + len(batch)) / total * 100
                log.info(f"[Scheduler] Progress: {batch_start + len(batch)}/{total} ({pct:.0f}%) — errors: {errors}")
                await meta_col.update_one(
                    {"_id": "daily_scan"},
                    {"$set": {
                        "symbols_processed": processed,
                        "symbols_errored": errors,
                    }}
                )

        # ── Update zone proximity search ──────────────────────────────────
        try:
            from services.zone_search_service import run_zone_proximity_search
            await run_zone_proximity_search(db)
            log.info("[Scheduler] Zone proximity search updated successfully")
        except Exception as e:
            log.error(f"[Scheduler] Zone proximity search update failed: {e}")

    except Exception as scan_err:
        status = "failed"
        log.error(f"[Scheduler] Daily scan pipeline crashed: {scan_err}", exc_info=True)
        raise scan_err
    finally:
        elapsed = (datetime.now(timezone.utc) - start_time).total_seconds()
        # ── Update scan meta ──────────────────────────────────────────────
        await meta_col.update_one(
            {"_id": "daily_scan"},
            {"$set": {
                "status":            status,
                "last_ran":          datetime.now(timezone.utc),
                "symbols_processed": processed,
                "symbols_errored":   errors,
                "total_symbols":     total,
                "elapsed_seconds":   round(elapsed, 1),
            }},
            upsert=True,
        )

    log.info(
        f"[Scheduler] Scan complete — {processed}/{total} symbols "
        f"in {elapsed:.0f}s ({errors} errors)"
    )


async def maybe_run_on_startup(app_state) -> None:
    """Check if scan is stale on startup and trigger if needed."""
    db = getattr(app_state, "db", None)
    if db is None:
        return

    try:
        meta_col  = db.get_collection("scan_meta")
        last_meta = await meta_col.find_one({"_id": "daily_scan"})
        if last_meta:
            last_ran = last_meta.get("last_ran")
            if last_ran:
                if hasattr(last_ran, "tzinfo") and last_ran.tzinfo is None:
                    last_ran = last_ran.replace(tzinfo=timezone.utc)
                age_hours = (datetime.now(timezone.utc) - last_ran).total_seconds() / 3600
                if age_hours < 6:
                    log.info(f"[Scheduler] Startup: scan ran {age_hours:.1f}h ago — OK")
                    return

        log.info("[Scheduler] Startup: scan is stale — triggering background scan…")
        asyncio.create_task(run_daily_scan(app_state, force=True))

    except Exception as e:
        log.error(f"[Scheduler] Startup check failed: {e}")


def setup_scheduler(app_state) -> None:
    """
    Register the APScheduler job for daily 15:45 IST (10:15 UTC).
    Call this from main.py after DB is connected.
    """
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.cron import CronTrigger

        scheduler = AsyncIOScheduler(timezone="UTC")
        scheduler.add_job(
            run_daily_scan,
            CronTrigger(hour=10, minute=15),   # 15:45 IST = 10:15 UTC
            args=[app_state],
            id="daily_scan",
            replace_existing=True,
            misfire_grace_time=600,
        )
        scheduler.start()
        log.info("[Scheduler] APScheduler started — daily scan at 15:45 IST")
        return scheduler

    except ImportError:
        log.warning("[Scheduler] apscheduler not installed — manual trigger only. pip install apscheduler")
        return None
