"""
FinAI Edge — Groww Daily OHLC Updater (Incremental)
=====================================================
Designed to run EVERY DAY after market close (e.g. 4:00 PM IST via cron).

How it works:
  1. Authenticate with Groww via TOTP
  2. Load NSE EQ stock list from groww_nse_stock_list.csv
  3. For each stock — check MongoDB `ohlc_data` for the last stored date
     - If no history → fetch full 5yr history (first-time setup)
     - If history exists → fetch only from (last_date + 1) to today
  4. Append new candles to MongoDB `ohlc_data` collection
  5. Recompute technical indicators (RSI, EMA, MACD, FVG) on full history
  6. Update `screener_cache` with fresh indicator values

MongoDB collections used:
  - ohlc_data        : stores raw OHLC per stock (symbol + date unique index)
  - screener_cache   : latest indicators per stock (for screener UI)

Cron example (run Mon–Fri at 16:15 IST = 10:45 UTC):
  45 10 * * 1-5 /opt/anaconda3/envs/venv/bin/python \
    /path/to/FinTechAi/backend/fastapi_app/scripts/groww_screener_ingest.py

Run manually:
  /opt/anaconda3/envs/venv/bin/python backend/fastapi_app/scripts/groww_screener_ingest.py
"""

import os, sys, math, asyncio, logging, threading, time
from datetime import datetime, timedelta, timezone, date
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

import pandas as pd
import pyotp
import talib
from motor.motor_asyncio import AsyncIOMotorClient

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("groww_daily")

# ─── Load .env ────────────────────────────────────────────────────────────────
load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))
API_KEY      = os.getenv("GROWW_API_KEY", "")
TOTP_SECRET  = os.getenv("GROWW_TOTP_SECRET", "")
MONGODB_URI  = os.getenv("MONGODB_URI", "")
CSV_PATH     = os.path.join(os.path.dirname(__file__), "groww_nse_stock_list.csv")

if not API_KEY or not TOTP_SECRET:
    log.error("GROWW_API_KEY and GROWW_TOTP_SECRET must be set in backend/.env")
    sys.exit(1)

# ─── Groww import ─────────────────────────────────────────────────────────────
try:
    from growwapi import GrowwAPI
    try:
        from growwapi.groww.exceptions import GrowwAPIException, GrowwAPIRateLimitException
    except ImportError:
        try:
            from growwapi.exceptions import GrowwAPIException, GrowwAPIRateLimitException
        except ImportError:
            class GrowwAPIException(Exception): pass          # type: ignore[misc]
            class GrowwAPIRateLimitException(GrowwAPIException): pass  # type: ignore[misc]
except ImportError:
    log.error("growwapi not installed. Run: pip install GrowwAPI")
    sys.exit(1)

# ─── CONFIG ───────────────────────────────────────────────────────────────────
DAYS_PER_CHUNK   = 180      # Groww API chunk size (days)
FULL_HISTORY_YRS = 5        # years for first-time fetch
BASE_SLEEP       = 0.3      # min seconds between API calls
MAX_WORKERS      = 3        # parallel threads (keep low to avoid rate limits)
MAX_RETRIES      = 5
FVG_COUNT        = 3
MIN_FVG_GAP_PCT  = 0.01

# ─── Auth (TOTP refreshed each run) ──────────────────────────────────────────
totp_gen     = pyotp.TOTP(TOTP_SECRET)
totp         = totp_gen.now()
access_token = GrowwAPI.get_access_token(api_key=API_KEY, totp=totp)
groww        = GrowwAPI(access_token)
log.info("✅ Groww authenticated")

# ─── Rate-limit throttle ──────────────────────────────────────────────────────
api_lock      = threading.Lock()
last_api_call = 0.0

def throttle():
    global last_api_call
    with api_lock:
        wait = max(0, BASE_SLEEP - (time.time() - last_api_call))
        if wait:
            time.sleep(wait)
        last_api_call = time.time()

def safe_get_candles(**kwargs):
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            throttle()
            return groww.get_historical_candles(**kwargs)
        except GrowwAPIRateLimitException:
            sl = attempt * 2
            log.warning(f"Rate-limit → retry {attempt}/{MAX_RETRIES} in {sl}s")
            time.sleep(sl)
        except GrowwAPIException as e:
            if "Rate limit" in str(e):
                sl = attempt * 2
                log.warning(f"Rate-limit → retry {attempt}/{MAX_RETRIES} in {sl}s")
                time.sleep(sl)
            else:
                raise
    raise RuntimeError("Max retries exceeded for Groww API")

# ─── Helpers ──────────────────────────────────────────────────────────────────
def safe_float(val):
    try:
        f = float(val)
        return None if (math.isnan(f) or math.isinf(f)) else round(f, 4)
    except Exception:
        return None

def safe_int(val):
    try:
        return int(val)
    except Exception:
        return None

# ─── OHLC fetch helpers ───────────────────────────────────────────────────────
def fetch_eod_range(groww_symbol: str, start_dt: datetime, end_dt: datetime) -> pd.DataFrame:
    """Fetch one chunk of daily OHLC candles from Groww."""
    resp    = safe_get_candles(
        exchange        = groww.EXCHANGE_NSE,
        segment         = groww.SEGMENT_CASH,
        groww_symbol    = groww_symbol,
        start_time      = start_dt.strftime("%Y-%m-%d %H:%M:%S"),
        end_time        = end_dt.strftime("%Y-%m-%d %H:%M:%S"),
        candle_interval = groww.CANDLE_INTERVAL_DAY,
    )
    candles = resp.get("candles", [])
    if not candles:
        return pd.DataFrame()

    df = pd.DataFrame(candles, columns=["timestamp", "Open", "High", "Low", "Close", "Volume", "OI"])
    if pd.api.types.is_numeric_dtype(df["timestamp"]):
        df["Date"] = pd.to_datetime(df["timestamp"], unit="s", errors="coerce")
    else:
        df["Date"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df = df.dropna(subset=["Date"])
    df["Date"] = df["Date"].dt.normalize()
    return df[["Date", "Open", "High", "Low", "Close", "Volume"]]


def fetch_candles_range(groww_symbol: str, start_dt: datetime, end_dt: datetime) -> pd.DataFrame:
    """Fetch all daily candles between start_dt and end_dt using chunked calls."""
    chunks, current = [], start_dt
    while current < end_dt:
        chunk_end = min(current + timedelta(days=DAYS_PER_CHUNK), end_dt)
        df = fetch_eod_range(groww_symbol, current, chunk_end)
        if not df.empty:
            chunks.append(df)
        current = chunk_end + timedelta(days=1)

    if not chunks:
        return pd.DataFrame()
    out = pd.concat(chunks, ignore_index=True)
    return out.drop_duplicates(subset=["Date"]).sort_values("Date").reset_index(drop=True)


# ─── FVG detection ────────────────────────────────────────────────────────────
def detect_bullish_fvgs(df: pd.DataFrame) -> list:
    """ICT-style bullish FVG: C2.Low > C1.High AND C3.Low > C1.High"""
    results, N = [], len(df)
    for i in range(N - 2):
        c1, c2, c3 = df.iloc[i], df.iloc[i + 1], df.iloc[i + 2]
        if c2["Low"] > c1["High"] and c3["Low"] > c1["High"]:
            gap_low  = float(c1["High"])
            gap_high = float(min(c2["Low"], c3["Low"]))
            if (gap_high - gap_low) >= float(c3["Close"]) * MIN_FVG_GAP_PCT:
                results.append({
                    "formed_idx": i + 2,
                    "low":        gap_low,
                    "high":       gap_high,
                    "start_date": str(df["Date"].iloc[i])[:10],
                    "end_date":   str(df["Date"].iloc[i + 2])[:10],
                })
    return results


def compute_indicators(df: pd.DataFrame) -> dict:
    """Compute RSI, EMA, MACD, FVG from full OHLC history. Returns screener_cache doc fields."""
    df    = df.sort_values("Date").reset_index(drop=True)
    close = df["Close"].astype(float).values

    rsi_14      = safe_float(talib.RSI(close, timeperiod=14)[-1])
    ema_20      = safe_float(talib.EMA(close, timeperiod=20)[-1])
    ema_50      = safe_float(talib.EMA(close, timeperiod=50)[-1])
    ema_200     = safe_float(talib.EMA(close, timeperiod=200)[-1])
    macd_v, macd_sig, macd_hist_v = talib.MACD(close, 12, 26, 9)
    macd        = safe_float(macd_v[-1])
    macd_signal = safe_float(macd_sig[-1])
    macd_hist   = safe_float(macd_hist_v[-1])

    last_valid = df.dropna(subset=["Close"])
    price      = safe_float(last_valid["Close"].iloc[-1]) if not last_valid.empty else None
    volume     = safe_int(last_valid["Volume"].iloc[-1])  if not last_valid.empty else None

    all_fvgs    = detect_bullish_fvgs(df)
    recent_fvgs = all_fvgs[-FVG_COUNT:][::-1]

    def fvg_zone(idx):
        if idx < len(recent_fvgs):
            z = recent_fvgs[idx]
            return {"low": z["low"], "high": z["high"],
                    "start_date": z["start_date"], "end_date": z["end_date"]}
        return None

    return {
        "price":  price,
        "volume": volume,
        "indicators": {
            "rsi_14": rsi_14, "ema_20": ema_20, "ema_50": ema_50, "ema_200": ema_200,
            "macd": macd, "macd_signal": macd_signal, "macd_hist": macd_hist,
        },
        "fvg": {
            "has_fvg_bullish": len(recent_fvgs) > 0,
            "has_fvg_bearish": False,
            "gap_range": [recent_fvgs[0]["low"], recent_fvgs[0]["high"]] if recent_fvgs else None,
            "fvg1": fvg_zone(0), "fvg2": fvg_zone(1), "fvg3": fvg_zone(2),
        },
    }


# ─── Per-stock incremental worker ─────────────────────────────────────────────
def process_stock(row: dict, last_dates: dict) -> dict | None:
    """
    Incremental update logic:
      - If stock has no history → fetch full FULL_HISTORY_YRS years
      - If stock has history → fetch only from (last_date + 1 day) to today
    Returns (new_rows_df, indicators_doc) or None on failure.
    """
    symbol       = str(row["trading_symbol"])
    groww_symbol = str(row["groww_symbol"])
    company_name = str(row.get("company_name", symbol))
    today        = datetime.now()

    try:
        last_date = last_dates.get(symbol)

        if last_date is None:
            # ── First time: fetch full 5yr history ──────────────────────────
            start_dt = today - timedelta(days=FULL_HISTORY_YRS * 365)
            log.info(f"[FULL]  {symbol} — fetching {FULL_HISTORY_YRS}yr history")
        else:
            # ── Incremental: only fetch since last stored date ───────────────
            start_dt = last_date + timedelta(days=1)
            if start_dt.date() >= today.date():
                log.info(f"[SKIP]  {symbol} — already up to date ({last_date.date()})")
                return None
            log.info(f"[INCR]  {symbol} — fetching {start_dt.date()} → {today.date()}")

        new_df = fetch_candles_range(groww_symbol, start_dt, today)
        if new_df.empty:
            log.info(f"[NONE]  {symbol} — no new candles")
            return None

        log.info(f"[+{len(new_df):>4}] {symbol} — {len(new_df)} new candles")
        return {
            "symbol":       symbol,
            "company_name": company_name,
            "new_rows":     new_df.to_dict("records"),
        }

    except Exception as e:
        log.error(f"[ERR]   {symbol}: {e}")
        return None


# ─── Main async runner ────────────────────────────────────────────────────────
async def run():
    today = datetime.now(timezone.utc)

    # 1. Load stock list
    if not os.path.exists(CSV_PATH):
        log.error(f"Stock list not found: {CSV_PATH}")
        log.error("Run groww_screener_ingest.py (first-time setup) first.")
        sys.exit(1)

    df_stocks = pd.read_csv(CSV_PATH)
    df_stocks.columns = df_stocks.columns.str.strip()
    if "company_name" not in df_stocks.columns:
        df_stocks["company_name"] = df_stocks["trading_symbol"]
    rows  = df_stocks.to_dict("records")
    total = len(rows)
    log.info(f"Loaded {total} stocks from CSV")

    # 2. Connect MongoDB
    client   = AsyncIOMotorClient(MONGODB_URI)
    db       = client.get_default_database("finai_edge")
    ohlc_col = db["ohlc_data"]
    sc_col   = db["screener_cache"]

    # Create indexes
    await ohlc_col.create_index([("symbol", 1), ("date", 1)], unique=True)
    await sc_col.create_index("symbol", unique=True)
    log.info("Connected to MongoDB.")

    # 3. Load last stored date per symbol (one aggregate query — very fast)
    log.info("Loading last stored dates from ohlc_data…")
    pipeline = [
        {"$group": {"_id": "$symbol", "last_date": {"$max": "$date"}}}
    ]
    last_dates: dict[str, datetime] = {}
    async for doc in ohlc_col.aggregate(pipeline):
        last_dates[doc["_id"]] = doc["last_date"]
    log.info(f"  Found history for {len(last_dates)} stocks. "
             f"{total - len(last_dates)} need full fetch.")

    # 4. Parallel OHLC fetch (incremental per stock)
    log.info(f"Fetching new candles with {MAX_WORKERS} threads…")
    fetch_results = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(process_stock, row, last_dates): row for row in rows}
        for future in as_completed(futures):
            res = future.result()
            if res:
                fetch_results.append(res)

    # 5. Write new OHLC rows to MongoDB + recompute indicators
    log.info(f"\nSaving {len(fetch_results)} stocks with new data…")
    new_candles_total = 0
    updated_indicators = 0

    for res in fetch_results:
        symbol       = res["symbol"]
        company_name = res["company_name"]
        new_rows     = res["new_rows"]

        # Upsert each new candle (skip duplicates via unique index)
        for row in new_rows:
            date_val = row["Date"]
            if hasattr(date_val, "to_pydatetime"):
                date_val = date_val.to_pydatetime()
            await ohlc_col.update_one(
                {"symbol": symbol, "date": date_val},
                {"$set": {
                    "symbol": symbol,
                    "date":   date_val,
                    "open":   safe_float(row["Open"]),
                    "high":   safe_float(row["High"]),
                    "low":    safe_float(row["Low"]),
                    "close":  safe_float(row["Close"]),
                    "volume": safe_int(row["Volume"]),
                }},
                upsert=True,
            )
            new_candles_total += 1

        # Recompute indicators from full history in ohlc_data
        cursor   = ohlc_col.find({"symbol": symbol}).sort("date", 1)
        all_docs = await cursor.to_list(length=None)
        if len(all_docs) < 50:
            continue  # not enough data for indicators

        full_df = pd.DataFrame([{
            "Date":   d["date"],
            "Open":   d.get("open"),
            "High":   d.get("high"),
            "Low":    d.get("low"),
            "Close":  d.get("close"),
            "Volume": d.get("volume"),
        } for d in all_docs])
        full_df = full_df.dropna(subset=["Close"])

        try:
            ind = compute_indicators(full_df)
            ind["symbol"]       = symbol
            ind["company_name"] = company_name
            ind["updated_at"]   = today
            await sc_col.update_one(
                {"symbol": symbol},
                {"$set": ind},
                upsert=True,
            )
            updated_indicators += 1
        except Exception as e:
            log.error(f"Indicator error for {symbol}: {e}")

    log.info(f"\n✅ Done!")
    log.info(f"   New candles saved  : {new_candles_total}")
    log.info(f"   Indicators updated : {updated_indicators} stocks")
    log.info(f"   Stocks skipped     : {total - len(fetch_results)} (already up to date)")

    # ── Cron reminder ──────────────────────────────────────────────────────────
    log.info("\n💡 Add to crontab to run daily after market close (4:15 PM IST):")
    log.info("   15 10 * * 1-5  /opt/anaconda3/envs/venv/bin/python "
             f"{os.path.abspath(__file__)}")


if __name__ == "__main__":
    asyncio.run(run())
