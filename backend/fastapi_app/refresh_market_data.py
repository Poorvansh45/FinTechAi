#!/usr/bin/env python
"""
FinAI Edge — Manual Market Data Refresh CLI Tool
===============================================
Enables manual execution of the EOD scanner pipelines.
Runs under an asyncio loop and performs full validation and caching.
"""

import argparse
import asyncio
import logging
import os
import sys
from datetime import datetime, timezone

import certifi
from motor.motor_asyncio import AsyncIOMotorClient

# Add parent directory to sys.path so we can import local modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config import get_settings
from schedulers.daily_refresh import run_daily_scan
from services.market_service import get_market_service
from services.universe_cache import get_universe

# Ensure log directory exists
os.makedirs(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs"), exist_ok=True
)

# Configure logging to console and log file
log_format = "[Ingest-CLI] %(asctime)s %(levelname)s: %(message)s"
logging.basicConfig(
    level=logging.INFO,
    format=log_format,
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(
            os.path.join(
                os.path.dirname(os.path.abspath(__file__)), "logs", "ingestion.log"
            ),
            encoding="utf-8",
        ),
    ],
)
log = logging.getLogger("ingest_cli")


class MockAppState:
    def __init__(self, db, market_service):
        self.db = db
        self.market_service = market_service


async def main():
    parser = argparse.ArgumentParser(
        description="FinAI Edge Manual Stock Ingestion & Scanner"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit scanning to first N symbols (for fast dev testing)",
    )
    parser.add_argument(
        "--symbols",
        type=str,
        default=None,
        help="Comma-separated list of symbols to scan (e.g. RELIANCE,TCS)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch data and run indicators logic without writing to MongoDB",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force run even if today's scan metadata says it already completed",
    )
    args = parser.parse_args()

    settings = get_settings()
    log.info("Starting manual stock ingestion & scanner...")
    log.info(f"Environment: {settings.environment}")
    log.info(f"Dry Run: {args.dry_run}")
    log.info(f"Force Run: {args.force}")

    # 1. MongoDB Connection
    log.info("Connecting to MongoDB...")
    try:
        mongo_client = AsyncIOMotorClient(
            settings.mongodb_uri,
            serverSelectionTimeoutMS=5000,
            tlsCAFile=certifi.where(),
        )
        await mongo_client.admin.command("ping")
        db = mongo_client.get_default_database("finai_edge")
        log.info("MongoDB connection successful.")
    except Exception as e:
        log.error(f"MongoDB connection failed: {e}")
        sys.exit(1)

    # 2. Market Service Initialization
    log.info("Initializing Market Data Service...")
    market_svc = get_market_service()

    # 3. Universe Discovery
    symbols = []
    if args.symbols:
        symbols = [
            sym.strip() + ".NS" if "." not in sym else sym.strip()
            for sym in args.symbols.split(",")
        ]
        log.info(f"Using explicitly specified symbols: {symbols}")
    else:
        log.info("Loading stock universe...")
        try:
            symbols = await get_universe(db)
        except Exception as e:
            log.error(f"Failed to load stock list universe: {e}")
            mongo_client.close()
            sys.exit(1)

    if not symbols:
        log.error("Stock universe is empty. Aborting.")
        mongo_client.close()
        sys.exit(1)

    log.info(f"Stock universe loaded. Total symbols: {len(symbols)}")

    if args.limit:
        symbols = symbols[: args.limit]
        log.info(f"Limit applied. Scanning first {len(symbols)} symbols.")

    # 4. App State and execution
    app_state = MockAppState(db if not args.dry_run else None, market_svc)

    # Temporarily monkey-patch get_universe if we have custom/limited symbols or dry-run mock
    if args.symbols or args.limit:

        async def mock_get_universe(database_instance):
            return symbols

        import services.universe_cache

        original_get_universe = services.universe_cache.get_universe
        services.universe_cache.get_universe = mock_get_universe

    start_time = datetime.now(timezone.utc)
    try:
        log.info("Starting scan execution...")
        await run_daily_scan(
            app_state,
            force=args.force or args.limit is not None or args.symbols is not None,
        )
        log.info("Scan execution finished successfully.")
    except Exception:
        log.exception("Scan pipeline crashed")
    finally:
        # Restore monkey-patched functions if modified
        if args.symbols or args.limit:
            import services.universe_cache

            services.universe_cache.get_universe = original_get_universe
        mongo_client.close()

    elapsed = (datetime.now(timezone.utc) - start_time).total_seconds()
    log.info(f"Manual execution completed in {elapsed:.1f}s.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("CLI execution interrupted by user.")
        sys.exit(0)
