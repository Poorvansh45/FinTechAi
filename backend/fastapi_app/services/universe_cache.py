"""
FinAI Edge — Daily Universe Cache (v2)
========================================
Date-keyed MongoDB cache for the NSE stock universe.
Prevents repeated API calls — fetches once per calendar day.

Functions:
  get_universe(db)         → List of .NS ticker strings for yfinance
  get_universe_cached(db)  → List of dicts (full metadata)
  is_universe_fresh(db)    → bool
"""

import logging
import os
from datetime import date, datetime, timezone

log = logging.getLogger("finai_edge.universe_cache")

COLLECTION = "instrument_cache"

# Nifty500 hardcoded symbols as the safest zero-dependency fallback.
# These are updated as of June 2025. The scheduler uses these if
# Groww API is unavailable and no CSV is found.
FALLBACK_NSE500 = [
    "RELIANCE.NS",
    "TCS.NS",
    "HDFCBANK.NS",
    "INFY.NS",
    "ICICIBANK.NS",
    "HINDUNILVR.NS",
    "SBIN.NS",
    "BAJFINANCE.NS",
    "ITC.NS",
    "KOTAKBANK.NS",
    "LT.NS",
    "AXISBANK.NS",
    "ASIANPAINT.NS",
    "HCLTECH.NS",
    "MARUTI.NS",
    "SUNPHARMA.NS",
    "TITAN.NS",
    "WIPRO.NS",
    "ULTRACEMCO.NS",
    "NESTLEIND.NS",
    "POWERGRID.NS",
    "NTPC.NS",
    "TECHM.NS",
    "M&M.NS",
    "BAJAJFINSV.NS",
    "TATASTEEL.NS",
    "INDUSINDBK.NS",
    "ONGC.NS",
    "ADANIENT.NS",
    "JSWSTEEL.NS",
    "HINDALCO.NS",
    "COALINDIA.NS",
    "CIPLA.NS",
    "GRASIM.NS",
    "DIVISLAB.NS",
    "DRREDDY.NS",
    "EICHERMOT.NS",
    "BPCL.NS",
    "APOLLOHOSP.NS",
    "HEROMOTOCO.NS",
    "TATACONSUM.NS",
    "BRITANNIA.NS",
    "SBILIFE.NS",
    "BAJAJ-AUTO.NS",
    "HDFCLIFE.NS",
    "ADANIPORTS.NS",
    "UPL.NS",
    "PIDILITIND.NS",
    "SHREECEM.NS",
    "DABUR.NS",
    "MARICO.NS",
    "BERGEPAINT.NS",
    "COLPAL.NS",
    "HAVELLS.NS",
    "MCDOWELL-N.NS",
    "GODREJCP.NS",
    "TORNTPHARM.NS",
    "LUPIN.NS",
    "BIOCON.NS",
    "ZYDUSLIFE.NS",
    "ALKEM.NS",
    "IPCALAB.NS",
    "ABBOTINDIA.NS",
    "GLAXO.NS",
    "PFIZER.NS",
    "AUROPHARMA.NS",
    "GLENMARK.NS",
    "NATCOPHARM.NS",
    "GRANULES.NS",
    "ESCORTS.NS",
    "BALKRISIND.NS",
    "MOTHERSON.NS",
    "BOSCHLTD.NS",
    "BHARATFORG.NS",
    "EXIDEIND.NS",
    "AMARAJABAT.NS",
    "MRF.NS",
    "APOLLOTYRE.NS",
    "CEATLTD.NS",
    "PERSISTENT.NS",
    "MPHASIS.NS",
    "COFORGE.NS",
    "LTTS.NS",
    "OFSS.NS",
    "KPITTECH.NS",
    "ZENSAR.NS",
    "MASTEK.NS",
    "ASTRAL.NS",
    "SUPREMEIND.NS",
    "AARTIIND.NS",
    "VINYSCHEM.NS",
    "SOLARINDS.NS",
    "DEEPAKNTR.NS",
    "NAVINFLUOR.NS",
    "GALAXYSURF.NS",
    "ALKYLAMINE.NS",
    "GMRINFRA.NS",
    "IRB.NS",
    "NHAI.NS",
    "CONCOR.NS",
    "ADANIGREEN.NS",
    "TATAPOWER.NS",
    "TORNTPOWER.NS",
    "CESC.NS",
    "PFC.NS",
    "RECLTD.NS",
    "IOC.NS",
    "HINDPETRO.NS",
    "MRPL.NS",
    "CASTROLIND.NS",
    "GSPL.NS",
    "ZOMATO.NS",
    "PAYTM.NS",
    "POLICYBZR.NS",
    "NYKAA.NS",
    "CARTRADE.NS",
    "DELHIVERY.NS",
    "MAPMYINDIA.NS",
    "EASEMYTRIP.NS",
    "IRCTC.NS",
    "INDIAMART.NS",
    "JUSTDIAL.NS",
    "INFOEDGE.NS",
    "TRADINGBELL.NS",
    "ANGEL.NS",
    "ANGELONE.NS",
    "CHOLAFIN.NS",
    "MUTHOOTFIN.NS",
    "MANAPPURAM.NS",
    "IIFL.NS",
    "LICHSGFIN.NS",
    "PNBHOUSING.NS",
    "CANFINHOME.NS",
    "HOMEFIRST.NS",
    "APTUS.NS",
    "AAVAS.NS",
    "SBICARDS.NS",
    "CREDITACC.NS",
    "UJJIVANSFB.NS",
    "AUBANK.NS",
    "EQUITASBNK.NS",
    "SURYODAY.NS",
    "BANDHANBNK.NS",
    "IDFCFIRSTB.NS",
    "FEDERALBNK.NS",
    "SOUTHBANK.NS",
    "KARURVYSYA.NS",
    "DCBBANK.NS",
    "RBLBANK.NS",
    "J&KBANK.NS",
]


async def get_universe(db) -> list[str]:
    """
    Get the NSE universe as a list of yfinance-style ticker strings (.NS suffix).
    Used by the daily scanner scheduler.

    Priority:
      1. MongoDB cache (today's date key)
      2. CSV file (scripts/upstox_nse_stock_list.csv, then groww_nse_stock_list.csv)
      3. Hardcoded Nifty500 fallback (~130 liquid symbols)
    """
    today = date.today().isoformat()
    col = db[COLLECTION]

    # Try MongoDB cache first
    cached = await col.find_one({"_id": today})
    if cached and cached.get("tickers"):
        log.info(f"Universe (tickers) cache HIT: {len(cached['tickers'])} symbols")
        return cached["tickers"]

    if cached and cached.get("stocks"):
        # Older format — extract tickers
        stocks = cached["stocks"]
        tickers = _stocks_to_tickers(stocks)
        if tickers:
            # Upgrade cache format
            await col.update_one({"_id": today}, {"$set": {"tickers": tickers}})
            log.info(f"Universe (tickers) from older cache: {len(tickers)} symbols")
            return tickers

    # Try CSV fallback
    tickers = await _load_tickers_from_csv()
    if tickers:
        # Cache them
        await col.update_one(
            {"_id": today},
            {
                "$set": {
                    "_id": today,
                    "tickers": tickers,
                    "count": len(tickers),
                    "source": "csv",
                    "fetched_at": datetime.now(timezone.utc),
                }
            },
            upsert=True,
        )
        log.info(f"Universe loaded from CSV: {len(tickers)} symbols")
        return tickers

    # Hardcoded Nifty500 fallback
    log.warning(f"Using hardcoded Nifty500 fallback: {len(FALLBACK_NSE500)} symbols")
    return FALLBACK_NSE500


async def get_universe_cached(db, groww=None) -> list:
    """
    Returns the NSE EQ universe as full stock dicts from MongoDB cache.
    If cache miss and Groww is available, fetches from Groww API.
    Falls back to CSV, then hardcoded list.
    """
    today = date.today().isoformat()
    col = db[COLLECTION]

    # Cache hit
    cached = await col.find_one({"_id": today})
    if cached and cached.get("stocks"):
        log.info(f"Universe cache HIT for {today} ({cached.get('count', 0)} stocks)")
        return cached["stocks"]

    # Groww API fetch
    if groww is not None:
        log.info("Universe cache MISS — fetching from Groww API…")
        try:
            instruments_df = groww.get_all_instruments()

            nse_eq = instruments_df[
                (instruments_df["exchange"] == "NSE")
                & (instruments_df["segment"] == "CASH")
                & (instruments_df["series"] == "EQ")
                & (~instruments_df["isin"].str.startswith("INF", na=False))
            ].copy()

            if "company_name" not in nse_eq.columns and "name" in nse_eq.columns:
                nse_eq = nse_eq.rename(columns={"name": "company_name"})
            if "company_name" not in nse_eq.columns:
                nse_eq["company_name"] = nse_eq["trading_symbol"]

            stocks = nse_eq.to_dict("records")
            tickers = _stocks_to_tickers(stocks)

            await col.replace_one(
                {"_id": today},
                {
                    "_id": today,
                    "stocks": stocks,
                    "tickers": tickers,
                    "count": len(stocks),
                    "source": "groww",
                    "fetched_at": datetime.now(timezone.utc),
                },
                upsert=True,
            )

            # TTL index (3 days)
            try:
                await col.create_index("fetched_at", expireAfterSeconds=3 * 24 * 3600)
            except Exception as e:
                log.debug(f"universe TTL index: already exists or skipped: {e}")

            log.info(f"Universe cached from Groww: {len(stocks)} stocks")
            return stocks

        except Exception as e:
            log.error(f"Groww universe fetch failed: {e}")

    # CSV fallback
    log.warning("Universe cache MISS — no Groww instance, falling back to CSV")
    return await _load_stocks_from_csv(db)


def _stocks_to_tickers(stocks: list) -> list[str]:
    """Convert stock dicts to yfinance-style .NS tickers."""
    tickers = []
    for s in stocks:
        sym = s.get("trading_symbol") or s.get("symbol") or ""
        if sym:
            ticker = sym if sym.endswith(".NS") else f"{sym}.NS"
            tickers.append(ticker)
    return list(dict.fromkeys(tickers))


async def _load_tickers_from_csv() -> list[str]:
    """Load tickers from CSV and return as .NS strings."""
    stocks = await _load_stocks_from_csv(None)
    return _stocks_to_tickers(stocks)


async def _load_stocks_from_csv(db) -> list:
    """Load stock dicts from groww_nse_stock_list.csv."""
    import pandas as pd

    csv_paths = [
        os.path.join(
            os.path.dirname(__file__), "..", "scripts", "upstox_nse_stock_list.csv"
        ),
        os.path.join(
            os.path.dirname(__file__), "..", "scripts", "groww_nse_stock_list.csv"
        ),
        os.path.join(os.path.dirname(__file__), "..", "data", "nse_stocks.csv"),
    ]

    for csv_path in csv_paths:
        if os.path.exists(csv_path):
            try:
                df = pd.read_csv(csv_path)
                df.columns = df.columns.str.strip()
                if "trading_symbol" not in df.columns and "Symbol" in df.columns:
                    df = df.rename(columns={"Symbol": "trading_symbol"})
                if "company_name" not in df.columns:
                    df["company_name"] = df.get(
                        "Company Name", df.get("trading_symbol", "")
                    )
                stocks = df.to_dict("records")
                log.info(f"Loaded {len(stocks)} stocks from CSV: {csv_path}")
                return stocks
            except Exception as e:
                log.warning(f"CSV load failed ({csv_path}): {e}")

    # Return hardcoded fallback as dicts
    return [
        {"trading_symbol": t.replace(".NS", ""), "company_name": t.replace(".NS", "")}
        for t in FALLBACK_NSE500
    ]


async def is_universe_fresh(db) -> bool:
    """Returns True if today's universe is already cached."""
    today = date.today().isoformat()
    cached = await db[COLLECTION].find_one({"_id": today}, {"count": 1})
    return cached is not None and cached.get("count", 0) > 0
