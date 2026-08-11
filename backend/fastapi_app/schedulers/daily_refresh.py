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

import logging
import math
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import numpy as np
import pandas as pd

from engines.indicators import IndicatorSet
from services.ohlc_downloader import (
    download_incremental_ohlc,
    get_cached_symbols,
    get_downloader_paths,
    load_stock_dataframe,
)

log = logging.getLogger("finai_edge.scheduler")

NIFTY_SYMBOL = "^NSEI"
BULK_BATCH_SIZE = 100

# In-memory registry of currently-running full scans, keyed by scan_id. Purely
# observational — read/written only from logging, never consulted by any
# control-flow decision (no lock), so it cannot change scan behavior. Its
# purpose is to make concurrent/overlapping run_daily_scan() calls visible in
# the logs (see `CONCURRENCY WARNING`).
_ACTIVE_SCANS: dict[str, dict[str, Any]] = {}


def _new_scan_id() -> str:
    now = datetime.now(timezone.utc)
    return f"SCAN-{now:%Y%m%d-%H%M%S}-{uuid.uuid4().hex[:6]}"


def _safe(v) -> float | None:
    try:
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else round(f, 4)
    except Exception:
        return None


# ── Core per-symbol computation ───────────────────────────────────────────────

# Module-level reference set by run_daily_scan before processing
_company_name_map: dict[str, str] = {}


def _compute_symbol_local(
    symbol: str,
    df: pd.DataFrame,
    nifty_1m_return: float,
    indicators: IndicatorSet | None = None,
) -> dict[str, Any] | None:
    """
    Compute FVG, SMC, Momentum, and Volume Surge locally for a single symbol.

    `indicators`, when supplied by the Scan Coordinator's Indicators stage, is
    the single canonical EMA/RSI/MACD computation for this symbol — reused
    here instead of recomputing it a second time. When absent (standalone/
    manual invocation, e.g. a populate script), this function falls back to
    computing it itself so it keeps working outside the coordinator.
    """
    try:
        df["Close"] = pd.to_numeric(df["Close"], errors="coerce")
        df["High"] = pd.to_numeric(df["High"], errors="coerce")
        df["Low"] = pd.to_numeric(df["Low"], errors="coerce")
        df["Volume"] = pd.to_numeric(df["Volume"], errors="coerce")
        df.dropna(subset=["Close"], inplace=True)
        df.sort_values("Date", inplace=True)
        df.reset_index(drop=True, inplace=True)

        if len(df) < 30:
            return None

        close = df["Close"].values
        volume = df["Volume"].values
        high = df["High"].values
        low = df["Low"].values
        ltp = float(close[-1])

        # ── Indicators ──────────────────────────────────────────────────
        if indicators is not None:
            ema9_val = indicators.ema_9
            ema50_val = indicators.ema_50
            ema200_val = indicators.ema_200
            ema50_dist = indicators.ema_50_dist_pct
            ema200_dist = indicators.ema_200_dist_pct
            rsi_14 = indicators.rsi_14
            macd_val = indicators.macd
            macd_hist = indicators.macd_hist
        else:
            # Fallback: canonical EMA from the Indicator Engine's own functions
            # (same math as IndicatorEngine.compute, computed inline here only
            # because no precomputed IndicatorSet was supplied).
            from engines.indicators import ema as _ema_engine

            def ema(arr, period):
                return _ema_engine(pd.Series(arr), period).values

            ema_9 = ema(close, 9)
            ema_50 = ema(close, 50)
            ema_200 = ema(close, 200)

            ema9_val = _safe(ema_9[-1])
            ema50_val = _safe(ema_50[-1])
            ema200_val = _safe(ema_200[-1])
            ema50_dist = (
                _safe((ltp - ema_50[-1]) / ema_50[-1] * 100) if ema_50[-1] else None
            )
            ema200_dist = (
                _safe((ltp - ema_200[-1]) / ema_200[-1] * 100) if ema_200[-1] else None
            )

            # RSI (Wilder's smoothing — matches TradingView / TA-Lib)
            delta = pd.Series(close).diff()
            gain = delta.clip(lower=0)
            loss = -delta.clip(upper=0)
            avg_gain = gain.ewm(alpha=1 / 14, min_periods=14, adjust=False).mean()
            avg_loss = loss.ewm(alpha=1 / 14, min_periods=14, adjust=False).mean()
            rs = avg_gain / avg_loss.replace(0, np.nan)
            rsi_14 = _safe(100 - (100 / (1 + rs.iloc[-1])))

            # MACD
            ema_12 = ema(close, 12)
            ema_26 = ema(close, 26)
            macd_line = ema_12 - ema_26
            signal_line = ema(macd_line, 9)
            macd_hist = _safe(macd_line[-1] - signal_line[-1])
            macd_val = _safe(macd_line[-1])

        # Volume
        avg_vol_20 = _safe(
            float(pd.Series(volume).rolling(20, min_periods=5).mean().iloc[-1])
        )
        curr_vol = _safe(float(volume[-1]))
        vol_ratio = (
            _safe(curr_vol / avg_vol_20) if avg_vol_20 and avg_vol_20 > 0 else None
        )

        # 52-week
        wk52_high = (
            _safe(float(high[-252:].max()))
            if len(high) >= 252
            else _safe(float(high.max()))
        )
        wk52_low = (
            _safe(float(low[-252:].min()))
            if len(low) >= 252
            else _safe(float(low.min()))
        )
        wk52_dist = _safe((ltp - wk52_high) / wk52_high * 100) if wk52_high else None

        # 1-month return for relative strength
        stock_1m = (
            _safe((ltp - float(close[-21])) / float(close[-21]) * 100)
            if len(close) >= 21
            else None
        )
        rs_vs_nifty = (
            _safe(stock_1m - nifty_1m_return) if stock_1m is not None else None
        )

        # ── FVG (lazy import) ─────────────────────────────────────────
        fvg_data = {}
        try:
            from scanners.fvg import get_latest_fvgs_for_symbol

            fvg_result = get_latest_fvgs_for_symbol(
                df, symbol, ltp, rsi=rsi_14, ema_200_dist=ema200_dist
            )
            fvg_data = fvg_result
        except Exception as e:
            log.debug(f"[{symbol}] FVG computation failed: {e}")

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

            # company_name is injected via a closure variable from the caller
            cn = _company_name_map.get(symbol, "") if _company_name_map else ""
            surge_data = detect_volume_surges(df, symbol, company_name=cn)
        except Exception as e:
            log.debug(f"[{symbol}] volume surge computation failed: {e}")

        # ── Pure ICT FVG ──────────────────────────────────────────────
        fvg_pure_data = {}
        try:
            from scanners.fvg import analyze_fvg_for_symbol

            cn = _company_name_map.get(symbol, "") if _company_name_map else ""
            fvg_pure_data = analyze_fvg_for_symbol(df, symbol, company_name=cn)
        except Exception as fe_pure:
            log.warning(f"[Scheduler] Pure FVG analysis failed for {symbol}: {fe_pure}")

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
            "symbol": symbol,
            "company_name": _company_name_map.get(symbol, "")
            if _company_name_map
            else "",
            "fvg_pure_data": fvg_pure_data,
            "smc_data": smc_data,
            "price": round(ltp, 2),
            "ltp": round(ltp, 2),
            "volume": curr_vol,
            "avg_volume_20d": avg_vol_20,
            "volume_ratio": vol_ratio,
            "week52_high": wk52_high,
            "week52_low": wk52_low,
            "week52_high_dist_pct": wk52_dist,
            "indicators": {
                "ema_9": ema9_val,
                "ema_50": ema50_val,
                "ema_200": ema200_val,
                "ema_50_dist_pct": ema50_dist,
                "ema_200_dist_pct": ema200_dist,
                "rsi_14": rsi_14,
                "macd": macd_val,
                "macd_hist": macd_hist,
            },
            # Momentum fields
            "momentum_score": mom_score,
            "category": mom_category,
            "rsi": rsi_14,
            "ema_50_dist_pct": ema50_dist,
            "ema_200_dist_pct": ema200_dist,
            "relative_strength": rs_vs_nifty,
            "above_ema50": ema50_dist > 0 if ema50_dist is not None else None,
            "above_ema200": ema200_dist > 0 if ema200_dist is not None else None,
            # FVG fields
            **({k: v for k, v in fvg_data.items()} if fvg_data else {}),
            # Volume surge fields
            **(
                {k: v for k, v in surge_data.items() if k not in ("symbol",)}
                if surge_data
                else {}
            ),
            "updated_at": datetime.now(timezone.utc),
        }

    except Exception as e:
        log.error(f"[Scheduler] Error computing {symbol}: {e}")
        return None


def _build_cache_docs(batch_data: list[tuple]) -> dict[str, list[dict]]:
    """
    Shapes each computed symbol's result into its per-collection document —
    identical shaping logic to the old `_bulk_write_results`, but returns
    plain docs grouped by collection name instead of issuing live upserts.
    The Scan Coordinator accumulates these across the whole Technical stage
    and publishes them all atomically at the end (see engines/orchestration).
    """
    docs: dict[str, list[dict]] = {
        "screener_cache": [],
        "fvg_cache": [],
        "fvg_scan_results": [],
        "volume_surge_cache": [],
        "momentum_cache": [],
        "smc_scanner_results": [],
        "smc_zones": [],
    }

    for sym, result in batch_data:
        try:
            from utils.helpers import normalize_symbol

            sym = normalize_symbol(sym)
            result["symbol"] = normalize_symbol(result["symbol"])

            # ── screener_cache (technical) ───────────────────────
            docs["screener_cache"].append(
                {
                    "symbol": result["symbol"],
                    "price": result["price"],
                    "volume": result["volume"],
                    "avg_volume_20d": result.get("avg_volume_20d"),
                    "indicators": result["indicators"],
                    "updated_at": result["updated_at"],
                }
            )

            # ── fvg_cache ────────────────────────────────────────
            if result.get("has_fvg_bullish") or result.get("top_bullish_fvgs"):
                docs["fvg_cache"].append(
                    {
                        "symbol": result["symbol"],
                        "ltp": result["ltp"],
                        "has_fvg_bullish": result.get("has_fvg_bullish", False),
                        "has_fvg_bearish": result.get("has_fvg_bearish", False),
                        "total_fvgs_bullish": result.get("total_fvgs_bullish", 0),
                        "top_bullish_fvgs": result.get("top_bullish_fvgs", []),
                        "top_bearish_fvgs": result.get("top_bearish_fvgs", []),
                        "nearest_bullish_fvg": result.get("nearest_bullish_fvg"),
                        "best_fvg_score": result.get("best_fvg_score", 0),
                        "indicators": result["indicators"],
                        "updated_at": result["updated_at"],
                    }
                )

            # ── fvg_scan_results ─────────────────────────────────
            fvg_pure = result.get("fvg_pure_data")
            if fvg_pure:
                fvg_pure = dict(fvg_pure)
                fvg_pure["symbol"] = result["symbol"]
                docs["fvg_scan_results"].append(fvg_pure)

            # ── volume_surge_cache ───────────────────────────────
            # Always write when surge_stats is a dict (even 0 surges)
            if isinstance(result.get("surge_stats"), dict):
                recent_events = result.get("recent_surge_events", [])
                latest_day_return = (
                    recent_events[0].get("day_return") if recent_events else None
                )

                docs["volume_surge_cache"].append(
                    {
                        "symbol": result["symbol"],
                        "company_name": result.get("company_name", ""),
                        "ltp": result["ltp"],
                        "price": result["ltp"],  # alias for frontend
                        "volume": result.get("volume"),
                        "avg_volume_20d": result.get("avg_volume_20d"),
                        "volume_ratio": result.get("current_volume_ratio")
                        or result.get("volume_ratio"),
                        "current_volume_ratio": result.get("current_volume_ratio"),
                        "day_return_pct": latest_day_return,
                        "has_current_surge": result.get("has_current_surge", False),
                        "surge_history": result.get("surge_history", []),
                        "surge_stats": result.get("surge_stats", {}),
                        "recent_surge_events": recent_events,
                        "updated_at": result["updated_at"],
                    }
                )

            # ── momentum_cache ───────────────────────────────────
            docs["momentum_cache"].append(
                {
                    "symbol": result["symbol"],
                    "ltp": result["ltp"],
                    "momentum_score": result.get("momentum_score", 0),
                    "category": result.get("category", "Unknown"),
                    "rsi": result.get("rsi"),
                    "ema_50_dist_pct": result.get("ema_50_dist_pct"),
                    "ema_200_dist_pct": result.get("ema_200_dist_pct"),
                    "volume_ratio": result.get("volume_ratio"),
                    "week52_high_dist_pct": result.get("week52_high_dist_pct"),
                    "relative_strength": result.get("relative_strength"),
                    "above_ema50": result.get("above_ema50"),
                    "above_ema200": result.get("above_ema200"),
                    "updated_at": result["updated_at"],
                }
            )

            # ── SMC ──────────────────────────────────────────────
            smc_res = result.get("smc_data")
            if smc_res:
                from services.smc_service import _serialize

                smc_clean = _serialize(smc_res)
                smc_clean["symbol"] = sym
                smc_clean["updated_at"] = result["updated_at"]
                docs["smc_scanner_results"].append(smc_clean)

                all_zones = (
                    smc_res.get("demand_zones", [])
                    + smc_res.get("supply_zones", [])
                    + smc_res.get("internal_demand_zones", [])
                    + smc_res.get("internal_supply_zones", [])
                )
                for zone in all_zones:
                    zone_clean = _serialize(zone)
                    zone_clean["symbol"] = sym
                    docs["smc_zones"].append(zone_clean)

        except Exception as e:
            log.warning(f"[Scheduler] DB doc preparation failed for {sym}: {e}")

    return docs


# ── Batch pipeline ────────────────────────────────────────────────────────────


async def run_daily_scan(
    app_state, force: bool = False, trigger: str = "unknown"
) -> None:
    """
    Main scan entry point. Called on startup (if stale) and by APScheduler.

    Thin, name-preserving delegator to the Scan Coordinator
    (engines/orchestration/coordinator.py::run_full_scan), which owns the
    full pipeline (Download -> Indicators -> Technical -> LaunchPad ->
    Alpha Zone -> Publish -> Completed), the stage-by-stage scan_meta model,
    and atomic cache publication. Kept as a separate function -- rather than
    having every caller import the coordinator directly -- so the scheduler
    and api/screener.py's trigger-scan endpoint don't need to change.
    """
    from engines.orchestration import run_full_scan

    await run_full_scan(app_state, force=force, trigger=trigger)


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
            log.info(
                f"[Scheduler] Benchmark Nifty 50 indicates latest NSE EOD date is: {last_date}"
            )
            return last_date
    except Exception as e:
        log.warning(
            f"[Scheduler] Failed to fetch benchmark EOD date: {e}. Falling back to calendar logic."
        )

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
        log.warning(
            "[Scheduler] DB or Market Service missing — skipping startup recovery"
        )
        return

    log.info("[Scheduler] Starting startup recovery check...")

    # Step 1: Ensure cache is populated
    from services.ohlc_downloader import refresh_in_memory_cache

    paths = get_downloader_paths()
    output_csv = paths["output_csv"]

    if not os.path.exists(output_csv):
        log.info("[Scheduler] Stock_Data.csv is missing. Triggering first-time sync...")
        await download_incremental_ohlc()
        log.info(
            "[Scheduler] Initial ingestion complete. Skipping automatic scan calculation on startup."
        )
        return

    # Populate in-memory cache
    refresh_in_memory_cache()

    # Step 2: Determine latest completed NSE trading day
    latest_completed_day = await get_latest_nse_trading_day(market_svc)

    # Step 3: Check latest date present in Stock_Data.csv for each symbol
    symbols = get_cached_symbols()
    if not symbols:
        log.warning(
            "[Scheduler] No cached symbols found in Stock_Data.csv. Ingesting universe..."
        )
        await download_incremental_ohlc()
        log.info(
            "[Scheduler] Ingestion complete. Skipping automatic scan calculation on startup."
        )
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
            log.info(
                f"[Scheduler] Stock {sym} last date is {last_date}, which is before latest trading day {latest_completed_day}."
            )
            break

    if needs_backfill:
        log.info(
            "[Scheduler] Missing EOD candles detected. Commencing incremental backfill..."
        )
        await download_incremental_ohlc()
        log.info(
            "[Scheduler] Backfill sync complete. Skipping automatic scan calculation on startup."
        )
    else:
        log.info(
            "[Scheduler] Stock_Data.csv is already up-to-date with latest EOD data. Skipping backfill."
        )


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
            kwargs={"trigger": "cron"},
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
