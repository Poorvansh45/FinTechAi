import os
import sys
import time
import math
import logging
import threading
import asyncio
import pandas as pd
import requests
import yfinance as yf
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any, Optional

log = logging.getLogger("finai_edge.ohlc_downloader")

# Configs
BASE_SLEEP = 0.15           # min spacing between Upstox API calls (no 429s at this rate)
MAX_WORKERS = 3             # parallel threads
MAX_RETRIES = 5             # retry on rate limit

# Thread locks
api_lock = threading.Lock()
last_api_call = 0.0

# In-memory cached dataframe store
_IN_MEMORY_STOCK_CACHE: Dict[str, pd.DataFrame] = {}

def throttle():
    global last_api_call
    with api_lock:
        now = time.time()
        wait = max(0.0, BASE_SLEEP - (now - last_api_call))
        if wait > 0:
            time.sleep(wait)
        last_api_call = time.time()

def get_downloader_paths() -> Dict[str, str]:
    """Returns absolute paths for the symbol list and Stock_Data.csv.

    Prefers the Upstox-sourced `upstox_nse_stock_list.csv` (carries the
    `instrument_key` the Upstox historical API needs); falls back to the legacy
    `groww_nse_stock_list.csv` when the Upstox list hasn't been generated yet
    (run scripts/refresh_upstox_symbols.py) so the downloader never hard-fails
    mid-transition."""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    scripts_dir = os.path.join(current_dir, "..", "scripts")
    upstox_csv = os.path.realpath(os.path.join(scripts_dir, "upstox_nse_stock_list.csv"))
    groww_csv = os.path.realpath(os.path.join(scripts_dir, "groww_nse_stock_list.csv"))
    symbols_csv = upstox_csv if os.path.exists(upstox_csv) else groww_csv

    # Target path: backend/data/Stock_Data.csv
    base_dir = os.path.dirname(os.path.dirname(current_dir)) # backend/
    output_csv = os.path.join(base_dir, "data", "Stock_Data.csv")
    
    # Ensure data directory exists
    os.makedirs(os.path.dirname(output_csv), exist_ok=True)
    return {
        "symbols_csv": symbols_csv,
        "output_csv": output_csv
    }

# =========================
# CACHING AND HELPER LOGIC
# =========================
def refresh_in_memory_cache() -> None:
    """Loads Stock_Data.csv into memory and groups it by symbol for fast lookups."""
    global _IN_MEMORY_STOCK_CACHE
    paths = get_downloader_paths()
    output_csv = paths["output_csv"]
    
    if not os.path.exists(output_csv):
        _IN_MEMORY_STOCK_CACHE = {}
        log.warning(f"Stock_Data.csv not found at {output_csv}. In-memory cache is empty.")
        return
        
    try:
        log.info(f"Populating in-memory cache from {output_csv}...")
        t0 = time.time()
        df = pd.read_csv(output_csv)
        df.columns = df.columns.str.lower()
        df["date"] = pd.to_datetime(df["date"])
        
        # Normalize the symbol column to merge duplicates
        from utils.helpers import normalize_symbol
        df["symbol"] = df["symbol"].astype(str).apply(normalize_symbol)
        
        # Group by symbol and cache the DataFrames (cased in uppercase Symbol)
        groups = df.groupby("symbol")
        _IN_MEMORY_STOCK_CACHE = {
            str(sym).upper(): group.sort_values("date").reset_index(drop=True)
            for sym, group in groups
        }
        log.info(f"Loaded {len(_IN_MEMORY_STOCK_CACHE)} symbols into memory cache in {time.time() - t0:.2f}s.")
    except Exception as e:
        log.error(f"Failed to populate in-memory stock cache: {e}")
        _IN_MEMORY_STOCK_CACHE = {}

def load_stock_dataframe(symbol: str) -> pd.DataFrame:
    """
    Returns a copy of the historical DataFrame slice for the given symbol from the in-memory cache,
    with capitalized columns to maintain compatibility with scanners and services.
    """
    global _IN_MEMORY_STOCK_CACHE
    sym_upper = symbol.strip().upper()
    if not _IN_MEMORY_STOCK_CACHE:
        refresh_in_memory_cache()
    df = _IN_MEMORY_STOCK_CACHE.get(sym_upper, pd.DataFrame()).copy()
    if not df.empty:
        # Map lowercase to uppercase for compatibility with scanners/indicators
        rename_map = {
            "symbol": "Symbol",
            "date": "Date",
            "open": "Open",
            "high": "High",
            "low": "Low",
            "close": "Close",
            "volume": "Volume"
        }
        df.rename(columns=rename_map, inplace=True)
    return df

def get_cached_symbols() -> List[str]:
    """Returns a list of all symbol keys currently cached in-memory."""
    global _IN_MEMORY_STOCK_CACHE
    if not _IN_MEMORY_STOCK_CACHE:
        refresh_in_memory_cache()
    return list(_IN_MEMORY_STOCK_CACHE.keys())

# =========================
# DATE NORMALIZATION
# =========================
def _to_naive_datetime(series: pd.Series) -> pd.Series:
    """Coerce a date column to tz-naive datetime64 WITHOUT shifting the calendar
    day (a plain tz-drop, not a UTC conversion — so an IST 2026-07-21 stays the
    21st, never rolls back to the 20th).

    Handles three shapes: an already-naive datetime column (fast pass-through), a
    homogeneous tz-aware column, and — critically — a mixed *object* column where
    some Timestamps are tz-aware and others naive. That last shape is exactly what
    used to make the merge raise "Tz-aware datetime… cannot be converted…", which
    the coordinator swallowed and then reran the whole scan on the stale CSV. The
    providers below now all return naive dates, so this is also a belt-and-braces
    guard against any future provider re-introducing the mix."""
    if isinstance(series.dtype, pd.DatetimeTZDtype):
        return series.dt.tz_localize(None)                      # homogeneous tz-aware
    if pd.api.types.is_datetime64_any_dtype(series):
        return series                                          # already naive
    # Object/string (possibly mixed tz) — strip tz element-wise, no day shift.
    def _one(x):
        ts = pd.Timestamp(x)
        if pd.isna(ts):
            return pd.NaT
        return ts.tz_localize(None) if ts.tzinfo is not None else ts
    return series.map(_one)


# =========================
# DATA VALIDATION
# =========================
def validate_and_clean_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    Validates and cleans the DataFrame based on:
    - Unique primary key: (symbol, date)
    - No future dates (greater than current local date in Asia/Kolkata)
    - No missing OHLC (must be non-null and > 0)
    - No negative volume (must be non-null and >= 0)
    """
    if df.empty:
        return df
    
    # Standardize column headers to lowercase
    df.columns = df.columns.str.lower()

    # Normalize the symbol column
    from utils.helpers import normalize_symbol
    df["symbol"] = df["symbol"].astype(str).apply(normalize_symbol)
    
    # Check and convert Date — tz-naive, no day shift (see _to_naive_datetime).
    df["date"] = _to_naive_datetime(df["date"])
    dates = df["date"]
    
    # India current local date
    india_tz = timezone(timedelta(hours=5, minutes=30))
    today_india = datetime.now(india_tz).date()
    
    # Filters
    valid_mask = dates.dt.date <= today_india
    
    # OHLC quality (must be > 0 and non-null)
    for col in ["open", "high", "low", "close"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
            valid_mask &= df[col].notna() & (df[col] > 0)
            
    # Volume quality (must be >= 0)
    if "volume" in df.columns:
        df["volume"] = pd.to_numeric(df["volume"], errors="coerce").fillna(0)
        valid_mask &= df["volume"] >= 0
        
    df = df[valid_mask].copy()
    
    # Keep last entry for duplicate key (symbol, date)
    df = df.drop_duplicates(subset=["symbol", "date"], keep="last")
    return df

# =========================
# YFINANCE FETCH LOGIC (^NSEI benchmark disaster fallback only)
# =========================
def fetch_yfinance_incremental(symbol, start_dt, end_dt):
    yf_symbol = symbol if symbol.endswith(".NS") or symbol == "^NSEI" else f"{symbol}.NS"
    try:
        ticker = yf.Ticker(yf_symbol)
        df_raw = ticker.history(start=start_dt.strftime("%Y-%m-%d"), end=end_dt.strftime("%Y-%m-%d"), interval="1d")
        if df_raw.empty:
            return pd.DataFrame()
            
        df = df_raw.reset_index()
        df.columns = [c.lower() for c in df.columns]
        
        rename_map = {}
        for c in df.columns:
            if c in ('date', 'timestamp'): rename_map[c] = 'date'
            elif c == 'open': rename_map[c] = 'open'
            elif c == 'high': rename_map[c] = 'high'
            elif c == 'low': rename_map[c] = 'low'
            elif c == 'close': rename_map[c] = 'close'
            elif c == 'volume': rename_map[c] = 'volume'
            
        df.rename(columns=rename_map, inplace=True)
        # yfinance's daily index is tz-aware (Asia/Kolkata). Drop the tz WITHOUT a
        # UTC conversion so the wall-clock IST date is preserved (identical to how
        # the Upstox parser strips +05:30). Returning tz-aware dates here is what
        # created the mixed-tz merge column that crashed the whole download.
        df["date"] = pd.to_datetime(df["date"])
        if isinstance(df["date"].dtype, pd.DatetimeTZDtype):
            df["date"] = df["date"].dt.tz_localize(None)
        df["date"] = df["date"].dt.normalize()
        return df[["date", "open", "high", "low", "close", "volume"]]
    except Exception as e:
        log.warning(f"yfinance fetch error for {yf_symbol}: {e}")
        return pd.DataFrame()

# =========================
# UPSTOX FETCH LOGIC (PRIMARY)
# Public V3 historical-candle API — no authentication required.
# A single daily-interval request returns multi-year history, so unlike the
# Groww path there is NO 180-day chunking. Docs:
# https://upstox.com/developer/api-documentation/v3/get-historical-candle-data
# =========================
UPSTOX_HIST_URL = "https://api.upstox.com/v3/historical-candle/{instrument_key}/days/1/{to_date}/{from_date}"
NIFTY_UPSTOX_KEY = "NSE_INDEX|Nifty 50"   # ^NSEI benchmark via Upstox
# Normal calls return in <1s; a low ceiling keeps a rare slow host from stalling
# a worker for 30s (a timed-out symbol falls through to Groww → yfinance).
UPSTOX_TIMEOUT = 15

_upstox_session = requests.Session()
_upstox_session.headers.update({"Accept": "application/json"})


def _parse_upstox_candles(candles: list) -> pd.DataFrame:
    """Pure parser for an Upstox V3 payload's `candles` array.

    Each element is [iso_ts(+05:30), open, high, low, close, volume, oi]; rows
    arrive newest-first and date/close may occasionally be null. Returns a
    lowercase-column [date, open, high, low, close, volume] frame sorted
    ascending with tz-naive normalized dates — the exact shape the Groww and
    yfinance paths produce, so downstream merge/validation is identical."""
    if not candles:
        return pd.DataFrame()

    rows = []
    for c in candles:
        if len(c) < 6:
            continue
        # Date and close are mandatory; the rest get sensible fallbacks.
        if c[0] is None or c[4] is None:
            continue
        close_val = float(c[4])
        open_val = float(c[1]) if c[1] is not None else close_val
        high_val = float(c[2]) if c[2] is not None else max(open_val, close_val)
        low_val = float(c[3]) if c[3] is not None else min(open_val, close_val)
        volume_val = int(c[5]) if c[5] is not None else 0
        rows.append({
            "date": c[0], "open": open_val, "high": high_val,
            "low": low_val, "close": close_val, "volume": volume_val,
        })

    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date"])
    if df.empty:
        return df
    # Upstox timestamps carry a +05:30 offset — strip tz to keep naive
    # normalized dates consistent with the rest of the pipeline.
    if isinstance(df["date"].dtype, pd.DatetimeTZDtype):
        df["date"] = df["date"].dt.tz_localize(None)
    df["date"] = df["date"].dt.normalize()
    df = df.sort_values("date").reset_index(drop=True)  # newest-first -> ascending
    return df[["date", "open", "high", "low", "close", "volume"]]


def safe_get_upstox_candles(instrument_key: str, from_date: str, to_date: str) -> Any:
    """One throttled GET with 429 backoff (retry with linear sleep)."""
    url = UPSTOX_HIST_URL.format(instrument_key=instrument_key, to_date=to_date, from_date=from_date)
    for attempt in range(1, MAX_RETRIES + 1):
        throttle()
        resp = _upstox_session.get(url, timeout=UPSTOX_TIMEOUT)
        if resp.status_code == 429:
            sleep_time = attempt * 2
            log.warning(f"⚠️ Upstox Rate limit → retry {attempt}/{MAX_RETRIES} in {sleep_time}s")
            time.sleep(sleep_time)
            continue
        resp.raise_for_status()
        return resp.json()
    raise RuntimeError("Max retries exceeded for Upstox API")


def fetch_upstox_range(instrument_key: Optional[str], start_dt, end_dt) -> pd.DataFrame:
    """Whole [start_dt, end_dt] range in a SINGLE call — Upstox V3 daily returns
    multi-year history at once, so no chunking loop is needed."""
    if not instrument_key:
        return pd.DataFrame()
    try:
        resp = safe_get_upstox_candles(
            instrument_key,
            from_date=start_dt.strftime("%Y-%m-%d"),
            to_date=end_dt.strftime("%Y-%m-%d"),
        )
    except Exception as e:
        log.warning(f"Upstox fetch error for {instrument_key}: {e}")
        return pd.DataFrame()

    candles = []
    if isinstance(resp, dict):
        data = resp.get("data")
        if isinstance(data, dict):
            candles = data.get("candles", []) or []
        elif "candles" in resp:
            candles = resp.get("candles", []) or []
    elif isinstance(resp, list):
        candles = resp

    return _parse_upstox_candles(candles)


def _resolve_instrument_key(row) -> Optional[str]:
    """Upstox instrument_key from the row's own column, else derived from ISIN
    (`NSE_EQ|<isin>` is exactly the official key format for NSE equities), so an
    older CSV lacking the column still works."""
    ik = row.get("instrument_key") if hasattr(row, "get") else None
    if isinstance(ik, str) and ik.strip():
        return ik.strip()
    isin = row.get("isin") if hasattr(row, "get") else None
    if isinstance(isin, str) and isin.strip():
        return f"NSE_EQ|{isin.strip()}"
    return None


def _fetch_ohlc(row, symbol, start_dt, end_dt) -> pd.DataFrame:
    """Fetch one symbol's daily candles from Upstox — the single OHLCV source.

    Upstox's public V3 historical endpoint returns multi-year daily history in a
    single call and (validated live across the full ~2063-symbol NSE universe)
    serves every equity, so there is no per-symbol provider fallback for equities.
    Groww was removed from the OHLCV path entirely — its candles were found to be
    inaccurate — so nothing here can pull equity data from Groww.

    The only exception is the ^NSEI benchmark: Upstox's index key is tried first,
    then yfinance purely as a disaster net for that one infrastructure series
    (Groww never served the index anyway)."""
    if symbol == "^NSEI":
        df = fetch_upstox_range(NIFTY_UPSTOX_KEY, start_dt, end_dt)
        if df is not None and not df.empty:
            return df
        return fetch_yfinance_incremental(symbol, start_dt, end_dt)

    instrument_key = _resolve_instrument_key(row)
    try:
        return fetch_upstox_range(instrument_key, start_dt, end_dt)
    except Exception as e:
        log.warning(f"Upstox fetch error for {symbol}: {e}")
        return pd.DataFrame()


# =========================
# CORE WORKER
# =========================
def process_stock(row, last_date_map) -> Dict[str, Any]:
    symbol = row["Symbol"]
    today = datetime.now()

    try:
        if symbol in last_date_map:
            last_date = last_date_map[symbol]
            if isinstance(last_date, str):
                last_date = pd.to_datetime(last_date)
            if hasattr(last_date, "to_pydatetime"):
                last_date = last_date.to_pydatetime()

            start_dt = last_date + timedelta(days=1)
            if start_dt.date() >= today.date():
                return {"symbol": symbol, "status": "up_to_date", "df": None}
        else:
            start_dt = today - timedelta(days=5 * 365)

        # OHLCV source: Upstox only (equities). ^NSEI uses the Upstox index key
        # with a yfinance disaster fallback. Groww is not used for OHLCV.
        df = _fetch_ohlc(row, symbol, start_dt, today)

        if df is None or df.empty:
            return {"symbol": symbol, "status": "no_data", "df": None}

        df["symbol"] = symbol
        df.columns = df.columns.str.lower()
        return {"symbol": symbol, "status": "success", "df": df}

    except Exception as e:
        log.error(f"Error processing downloader worker for {symbol}: {e}")
        return {"symbol": symbol, "status": "failure", "error": str(e), "df": None}

# =========================
# PUBLIC ENDPOINT
# =========================
async def download_incremental_ohlc() -> str:
    """
    Main entry point for EOD incremental sync.
    Creates or updates backend/data/Stock_Data.csv.
    """
    paths = get_downloader_paths()

    symbols_csv = paths["symbols_csv"]
    output_csv = paths["output_csv"]
    
    if not os.path.exists(symbols_csv):
        raise FileNotFoundError(f"Missing stock list configuration: {symbols_csv}")

    log.info(f"Loading stock list from: {symbols_csv}")
    symbols_df = pd.read_csv(symbols_csv)
    symbols_df.columns = symbols_df.columns.str.strip()
    
    from utils.helpers import normalize_symbol
    symbols_df["Symbol"] = symbols_df["trading_symbol"].astype(str).apply(normalize_symbol)
    
    # Explicitly append the Nifty 50 benchmark (^NSEI) to the symbols universe
    benchmark_row = pd.DataFrame([{
        "Symbol": "^NSEI",
        "groww_symbol": "^NSEI",
        "trading_symbol": "^NSEI",
        "company_name": "Nifty 50 Index",
        "instrument_key": NIFTY_UPSTOX_KEY,
    }])
    symbols_df = pd.concat([symbols_df, benchmark_row], ignore_index=True)
    
    log.info(f"Total stocks to check (including benchmark): {len(symbols_df)}")

    # Load existing CSV database with lowercase columns
    if os.path.exists(output_csv):
        log.info(f"Loading existing Stock_Data: {output_csv}")
        try:
            existing_df = pd.read_csv(output_csv)
            existing_df.columns = existing_df.columns.str.lower()
            existing_df["date"] = pd.to_datetime(existing_df["date"])
            log.info(f"Loaded existing data: {len(existing_df)} rows")
        except Exception as e:
            log.error(f"Failed to read existing Stock_Data.csv: {e}. Rebuilding from scratch.")
            existing_df = pd.DataFrame(columns=["symbol", "date", "open", "high", "low", "close", "volume"])
    else:
        existing_df = pd.DataFrame(columns=["symbol", "date", "open", "high", "low", "close", "volume"])
        log.info("No existing Stock_Data.csv found. Will perform first-time setup (5yr history).")

    # Map last dates per symbol (case-insensitive keys for safety)
    last_date_map = {}
    if not existing_df.empty:
        last_date_map = (
            existing_df.groupby("symbol")["date"]
            .max()
            .to_dict()
        )
        # Convert dictionary keys to uppercase to match symbols_df
        last_date_map = {str(k).upper(): v for k, v in last_date_map.items()}

    # OHLCV is sourced from Upstox's public (keyless) V3 historical endpoint — no
    # Groww authentication is performed here. Groww was removed from the OHLCV
    # path because its candles were inaccurate; ^NSEI keeps a yfinance fallback.
    log.info("ℹ️ OHLCV source: Upstox (public V3 historical) — Groww not used for OHLCV")

    # Parallel Fetch
    new_records = []
    loop = asyncio.get_running_loop()
    
    # Progress tracking metrics
    success_symbols = []
    failed_symbols = []
    missing_symbols = [] # symbols that returned no data or failed
    # Use a mutable container for the counter to avoid UnboundLocalError
    # inside the run_parallel() closure (integers can't be mutated in-place,
    # but list/dict can).
    counters = {"up_to_date": 0}
    
    def run_parallel():
        records = []
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {
                executor.submit(process_stock, row, last_date_map): row["Symbol"]
                for _, row in symbols_df.iterrows()
            }
            done_count = 0
            for future in as_completed(futures):
                sym = futures[future]
                res = future.result()
                
                if res["status"] == "success":
                    records.append(res["df"])
                    success_symbols.append(sym)
                elif res["status"] == "failure":
                    failed_symbols.append(sym)
                    missing_symbols.append(sym)
                elif res["status"] == "no_data":
                    missing_symbols.append(sym)
                elif res["status"] == "up_to_date":
                    counters["up_to_date"] += 1
                    
                done_count += 1
                if done_count % 100 == 0 or done_count == len(symbols_df):
                    log.info(f"Incremental Ingestion Progress: {done_count}/{len(symbols_df)} symbols processed")
        return records

    # Delegate thread pool work to prevent event loop blocking
    new_records = await loop.run_in_executor(None, run_parallel)

    # Print ingestion reporting summary
    success_count = len(success_symbols)
    failure_count = len(failed_symbols)
    up_to_date_count = counters["up_to_date"]
    log.info("=========================================")
    log.info("INGESTION ENGINE SUMMARY REPORT")
    log.info(f"  Success count:  {success_count}")
    log.info(f"  Failure count:  {failure_count}")
    log.info(f"  Up-to-date:     {up_to_date_count}")
    log.info(f"  Missing:        {len(missing_symbols)}")
    if failed_symbols:
        log.info(f"  Failed Symbols: {', '.join(failed_symbols[:20])}...")
    log.info("=========================================")

    # Merge and Save with lowercase columns and validation rules
    if new_records:
        new_df = pd.concat(new_records, ignore_index=True)
        new_df.columns = new_df.columns.str.lower()
        # tz-safe coercion (no day shift). Providers already return naive dates,
        # so this normally hits the fast path — but it also de-mixes any stray
        # tz-aware column instead of raising and losing the whole day's download.
        new_df["date"] = _to_naive_datetime(new_df["date"])
        
        combined = (
            pd.concat([existing_df, new_df], ignore_index=True)
            if not existing_df.empty
            else new_df
        )

        # Standard clean & validate (duplicates, future dates, invalid OHLC, negative volumes)
        combined = validate_and_clean_data(combined)
        combined["date"] = combined["date"].dt.normalize()
        combined = combined.sort_values(["symbol", "date"])

        # Retain standard lowercase layout
        combined = combined[
            ["symbol", "date", "open", "high", "low", "close", "volume"]
        ]

        # Save back to CSV
        combined.to_csv(output_csv, index=False)
        log.info(f"✅ Stock_Data.csv updated successfully. Total records on disk: {len(combined)}")
    else:
        log.info("No new EOD candles were fetched (all tickers up to date).")
        
        # Clean existing dataframe just to ensure validation rule consistency
        if not existing_df.empty:
            cleaned_existing = validate_and_clean_data(existing_df)
            # Always rewrite to format columns to lowercase
            cleaned_existing.to_csv(output_csv, index=False)
            log.info(f"🧹 Standardized and saved existing database file. Rows: {len(cleaned_existing)}")

    # Refresh global cache
    refresh_in_memory_cache()
    return output_csv
