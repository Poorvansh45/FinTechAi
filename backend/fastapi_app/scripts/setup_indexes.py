"""
FinAI Edge — MongoDB Index Setup
====================================
Creates all required indexes for the scanner collections.
Run once on setup or after wiping the database.

Usage:
    python -m scripts.setup_indexes

Or import and call from main.py lifespan:
    from scripts.setup_indexes import create_indexes
    await create_indexes(db)
"""

import asyncio
import logging

from motor.motor_asyncio import AsyncIOMotorDatabase

log = logging.getLogger("finai_edge.setup_indexes")


async def create_indexes(db: AsyncIOMotorDatabase) -> None:
    """Create all required indexes for the FinAI Edge MongoDB collections."""

    # ── screener_cache ────────────────────────────────────────────────
    await db.screener_cache.create_index("symbol", unique=True, background=True)
    await db.screener_cache.create_index("indicators.rsi_14", background=True)
    await db.screener_cache.create_index("indicators.ema_50_dist_pct", background=True)
    await db.screener_cache.create_index("indicators.ema_200_dist_pct", background=True)
    await db.screener_cache.create_index("volume", background=True)
    await db.screener_cache.create_index("updated_at", background=True)
    log.info("  screener_cache: indexes created")

    # ── fvg_cache ─────────────────────────────────────────────────────
    await db.fvg_cache.create_index("symbol", unique=True, background=True)
    await db.fvg_cache.create_index("has_fvg_bullish", background=True)
    await db.fvg_cache.create_index("best_fvg_score", background=True)
    await db.fvg_cache.create_index([("top_bullish_fvgs.status", 1)], background=True)
    await db.fvg_cache.create_index([("top_bullish_fvgs.strength", 1)], background=True)
    log.info("  fvg_cache: indexes created")

    # ── volume_surge_cache ────────────────────────────────────────────
    await db.volume_surge_cache.create_index("symbol", unique=True, background=True)
    await db.volume_surge_cache.create_index("has_current_surge", background=True)
    await db.volume_surge_cache.create_index("current_volume_ratio", background=True)
    await db.volume_surge_cache.create_index(
        "surge_stats.avg_1d_return", background=True
    )
    await db.volume_surge_cache.create_index("surge_stats.win_rate_1d", background=True)
    await db.volume_surge_cache.create_index("ltp", background=True)
    log.info("  volume_surge_cache: indexes created")

    # ── momentum_cache ────────────────────────────────────────────────
    await db.momentum_cache.create_index("symbol", unique=True, background=True)
    await db.momentum_cache.create_index("momentum_score", background=True)
    await db.momentum_cache.create_index("category", background=True)
    await db.momentum_cache.create_index("rsi", background=True)
    await db.momentum_cache.create_index("ema_50_dist_pct", background=True)
    await db.momentum_cache.create_index("ema_200_dist_pct", background=True)
    await db.momentum_cache.create_index("volume_ratio", background=True)
    await db.momentum_cache.create_index("week52_high_dist_pct", background=True)
    await db.momentum_cache.create_index("above_ema50", background=True)
    await db.momentum_cache.create_index("above_ema200", background=True)
    log.info("  momentum_cache: indexes created")

    # ── smc_zones ─────────────────────────────────────────────────────
    await db.smc_zones.create_index(
        [("symbol", 1), ("zone_high", 1), ("zone_low", 1)], unique=True, background=True
    )
    await db.smc_zones.create_index("status", background=True)
    await db.smc_zones.create_index("direction", background=True)
    await db.smc_zones.create_index("symbol", background=True)
    log.info("  smc_zones: indexes created")

    # ── smc_scanner_results ───────────────────────────────────────────
    await db.smc_scanner_results.create_index("symbol", unique=True, background=True)
    await db.smc_scanner_results.create_index("smc_score", background=True)
    await db.smc_scanner_results.create_index(
        "structure.last_bullish_event", background=True
    )
    await db.smc_scanner_results.create_index("current_zone", background=True)
    await db.smc_scanner_results.create_index(
        "nearest_demand.distance_pct", background=True
    )
    await db.smc_scanner_results.create_index(
        "nearest_demand.touch_count", background=True
    )
    await db.smc_scanner_results.create_index(
        "nearest_demand.zone_age_days", background=True
    )
    log.info("  smc_scanner_results: indexes created")

    # ── zone_proximity_results ────────────────────────────────────────
    await db.zone_proximity_results.create_index("symbol", background=True)
    await db.zone_proximity_results.create_index("distance_pct", background=True)
    await db.zone_proximity_results.create_index("updated_at", background=True)
    log.info("  zone_proximity_results: indexes created")

    # ── ipo_listings / ipo_vintage_cache ──────────────────────────────
    await db.ipo_listings.create_index("symbol", unique=True, background=True)
    await db.ipo_listings.create_index("listing_date", background=True)
    await db.ipo_vintage_cache.create_index("symbol", unique=True, background=True)
    await db.ipo_vintage_cache.create_index("confidence", background=True)
    await db.ipo_vintage_cache.create_index("setup_status", background=True)
    log.info("  ipo_listings / ipo_vintage_cache: indexes created")

    # ── watchlists ────────────────────────────────────────────────────
    await db.watchlists.create_index("created_by", background=True)
    await db.watchlist_stocks.create_index(
        [("watchlist_id", 1), ("symbol", 1)], unique=True, background=True
    )
    await db.watchlist_stocks.create_index("source_module", background=True)
    await db.watchlist_history.create_index("watchlist_id", background=True)
    log.info("  watchlists: indexes created")

    # ── portfolios / users ────────────────────────────────────────────
    await db.portfolios.create_index("user_id", background=True)
    await db.portfolios.create_index("created_at", background=True)
    log.info("  portfolios: indexes created")

    # ── instrument_cache (universe) ───────────────────────────────────
    try:
        await db.instrument_cache.create_index(
            "fetched_at", expireAfterSeconds=3 * 24 * 3600, background=True
        )
    except Exception as e:
        log.debug(f"instrument_cache TTL index: already exists or skipped: {e}")
    log.info("  instrument_cache: TTL index created")

    # ── Workspace: media (Phase 1) ────────────────────────────────────
    await db.ws_media.create_index(
        [("user_id", 1), ("linked_type", 1), ("linked_id", 1)], background=True
    )
    await db.ws_media.create_index(
        [("user_id", 1), ("created_at", -1)], background=True
    )
    log.info("  ws_media: indexes created")

    log.info("All MongoDB indexes created successfully ✓")


if __name__ == "__main__":
    import os

    import certifi
    from dotenv import load_dotenv
    from motor.motor_asyncio import AsyncIOMotorClient

    load_dotenv("../.env")
    MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/finai_edge")

    async def main():
        client = AsyncIOMotorClient(MONGODB_URI, tlsCAFile=certifi.where())
        db = client.get_default_database("finai_edge")
        await create_indexes(db)
        client.close()

    asyncio.run(main())
