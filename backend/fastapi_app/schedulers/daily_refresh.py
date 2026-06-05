"""
FinAI Edge — Daily Screener Refresh Scheduler
===============================================
Runs the full screener pipeline once per day at 6:00 PM IST (12:30 UTC).
Uses asyncio-based scheduling — no external dependencies required.

Pipeline:
  1. Get NSE universe from cache (or Groww API)
  2. Download OHLC from market data service
  3. Compute indicators (RSI, EMA50/200, MACD, dist%)
  4. Upsert to screener_cache

Activated from main.py lifespan on startup.
"""

import asyncio
import logging
from datetime import datetime, timezone, time as dt_time

log = logging.getLogger("finai_edge.daily_refresh")

# 6:00 PM IST = 12:30 UTC
REFRESH_HOUR_UTC   = 12
REFRESH_MINUTE_UTC = 30


def _seconds_until_next_run() -> float:
    """Seconds from now until next 6 PM IST (12:30 UTC)."""
    now    = datetime.now(timezone.utc)
    target = now.replace(hour=REFRESH_HOUR_UTC, minute=REFRESH_MINUTE_UTC, second=0, microsecond=0)
    if now >= target:
        # Already past today's run — schedule for tomorrow
        from datetime import timedelta
        target += timedelta(days=1)
    return (target - now).total_seconds()


async def daily_screener_refresh(db):
    """
    Runs the complete screener pipeline: universe → OHLC → indicators → MongoDB.
    Called by the scheduler loop below.
    """
    from services.universe_cache import get_universe_cached, is_universe_fresh

    log.info("🔄 Daily screener refresh starting…")
    try:
        # 1. Universe (cached — no Groww call if same day)
        if await is_universe_fresh(db):
            log.info("  Universe: cache hit ✓")
        stocks = await get_universe_cached(db)
        if not stocks:
            log.error("  Universe empty — aborting refresh")
            return

        log.info(f"  Universe: {len(stocks)} stocks loaded")

        # 2. Trigger ingest scripts as subprocesses to avoid blocking the event loop
        import subprocess, sys, os
        scripts_dir = os.path.join(os.path.dirname(__file__), "..", "scripts")
        python      = sys.executable

        for script_name, label in [
            ("populate_screener.py",   "Technical indicators"),
            ("volume_surge_ingest.py", "Volume surge stats"),
            ("fvg_ingest.py",          "FVG zones"),
        ]:
            script_path = os.path.join(scripts_dir, script_name)
            if not os.path.exists(script_path):
                log.warning(f"  {label}: script not found ({script_path})")
                continue

            log.info(f"  Running {label}…")
            proc = await asyncio.create_subprocess_exec(
                python, script_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )
            stdout, _ = await proc.communicate()
            if proc.returncode == 0:
                log.info(f"  {label}: ✅ complete")
            else:
                log.error(f"  {label}: ❌ exit {proc.returncode}")
                if stdout:
                    log.error(stdout.decode()[-500:])   # last 500 chars of output

        log.info("✅ Daily screener refresh complete")

    except Exception as e:
        log.error(f"Daily screener refresh failed: {e}", exc_info=True)


async def start_daily_scheduler(db):
    """
    Asyncio loop that fires daily_screener_refresh at 6 PM IST every day.
    Call this from main.py lifespan (create_task).
    """
    log.info(f"Daily refresh scheduler started — fires at {REFRESH_HOUR_UTC:02d}:{REFRESH_MINUTE_UTC:02d} UTC (6 PM IST)")

    while True:
        wait_secs = _seconds_until_next_run()
        next_run  = datetime.now(timezone.utc)
        log.info(f"  Next refresh in {wait_secs/3600:.1f} hours ({next_run} UTC)")
        await asyncio.sleep(wait_secs)
        await daily_screener_refresh(db)
        # Small sleep to avoid double-firing on the exact boundary
        await asyncio.sleep(60)
