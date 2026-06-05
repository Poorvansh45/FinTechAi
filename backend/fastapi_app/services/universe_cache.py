"""
FinAI Edge — Daily Universe Cache
===================================
Date-keyed MongoDB cache for the Groww NSE instrument universe.
Prevents repeated Groww API calls — fetches once per calendar day.

Usage:
    from services.universe_cache import get_universe_cached

    stocks = await get_universe_cached(db)
    # Returns List[dict] with keys: trading_symbol, groww_symbol, company_name
"""

import logging
from datetime import date, datetime, timezone
from typing import Optional

log = logging.getLogger("finai_edge.universe_cache")

COLLECTION = "instrument_cache"


async def get_universe_cached(db, groww=None) -> list:
    """
    Returns the NSE EQ universe from MongoDB cache if today's data exists,
    otherwise fetches from Groww API and stores it.

    Args:
        db:    AsyncIOMotorDatabase instance
        groww: Authenticated GrowwAPI instance (needed on cache miss)

    Returns:
        List of dicts: [{trading_symbol, groww_symbol, company_name, ...}]
    """
    today = date.today().isoformat()
    col   = db[COLLECTION]

    # Cache hit — return stored universe
    cached = await col.find_one({"_id": today})
    if cached and cached.get("stocks"):
        log.info(f"Universe cache HIT for {today} ({cached['count']} stocks)")
        return cached["stocks"]

    # Cache miss — need Groww API
    if groww is None:
        # Try loading from CSV as fallback
        log.warning(f"Universe cache MISS for {today} — no Groww instance provided, falling back to CSV")
        return await _load_from_csv(db)

    log.info(f"Universe cache MISS for {today} — fetching from Groww API…")
    try:
        import pandas as pd
        instruments_df = groww.get_all_instruments()

        nse_eq = instruments_df[
            (instruments_df["exchange"] == "NSE") &
            (instruments_df["segment"]  == "CASH") &
            (instruments_df["series"]   == "EQ") &
            (~instruments_df["isin"].str.startswith("INF", na=False))
        ].copy()

        if "company_name" not in nse_eq.columns and "name" in nse_eq.columns:
            nse_eq = nse_eq.rename(columns={"name": "company_name"})
        if "company_name" not in nse_eq.columns:
            nse_eq["company_name"] = nse_eq["trading_symbol"]

        stocks = nse_eq.to_dict("records")

        # Store in MongoDB with today's date as key
        await col.replace_one(
            {"_id": today},
            {
                "_id":        today,
                "stocks":     stocks,
                "count":      len(stocks),
                "fetched_at": datetime.now(timezone.utc),
            },
            upsert=True,
        )

        # TTL index — auto-expire after 3 days
        await col.create_index("fetched_at", expireAfterSeconds=3 * 24 * 3600)

        log.info(f"Universe cached: {len(stocks)} NSE EQ stocks for {today}")
        return stocks

    except Exception as e:
        log.error(f"Groww universe fetch failed: {e}")
        return await _load_from_csv(db)


async def _load_from_csv(db) -> list:
    """Fallback: read stocks from groww_nse_stock_list.csv."""
    import os
    import pandas as pd

    csv_path = os.path.join(
        os.path.dirname(__file__), "..", "scripts", "groww_nse_stock_list.csv"
    )
    if not os.path.exists(csv_path):
        log.error(f"CSV not found: {csv_path}")
        return []

    df = pd.read_csv(csv_path)
    df.columns = df.columns.str.strip()
    if "company_name" not in df.columns:
        df["company_name"] = df["trading_symbol"]

    stocks = df.to_dict("records")
    log.info(f"Loaded {len(stocks)} stocks from CSV fallback")
    return stocks


async def is_universe_fresh(db) -> bool:
    """Returns True if today's universe is already cached."""
    today  = date.today().isoformat()
    cached = await db[COLLECTION].find_one({"_id": today}, {"count": 1})
    return cached is not None and cached.get("count", 0) > 0
