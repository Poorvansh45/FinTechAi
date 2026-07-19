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

from config import get_settings

log = logging.getLogger("finai_edge.ohlc_downloader")

# Configs
DAYS_PER_CHUNK = 180        # Groww fallback chunk size (Upstox needs no chunking)
BASE_SLEEP = 0.15           # min spacing between API calls (Upstox showed no 429s at this rate)
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
    
    # Check and convert Date
    df["date"] = pd.to_datetime(df["date"], utc=True).dt.tz_localize(None)
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
# GROWW FETCH LOGIC
# =========================
def safe_get_groww_candles(groww_api, **kwargs):
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            throttle()
            return groww_api.get_historical_candles(**kwargs)
        except Exception as e:
            err_str = str(e)
            if "Rate limit" in err_str or "429" in err_str:
                sleep_time = attempt * 2
                log.warning(f"⚠️ Groww Rate limit → retry {attempt}/{MAX_RETRIES} in {sleep_time}s")
                time.sleep(sleep_time)
            else:
                raise
    raise RuntimeError("Max retries exceeded for Groww API")

def fetch_groww_eod_range(groww_api, groww_symbol, start_dt, end_dt):
    try:
        resp = safe_get_groww_candles(
            groww_api,
            exchange=groww_api.EXCHANGE_NSE,
            segment=groww_api.SEGMENT_CASH,
            groww_symbol=groww_symbol,
            start_time=start_dt.strftime("%Y-%m-%d %H:%M:%S"),
            end_time=end_dt.strftime("%Y-%m-%d %H:%M:%S"),
            candle_interval=groww_api.CANDLE_INTERVAL_DAY
        )
    except Exception as e:
        log.warning(f"Groww fetch error for {groww_symbol}: {e}")
        return pd.DataFrame()

    candles = []
    if isinstance(resp, list):
        candles = resp
    elif isinstance(resp, dict):
        if "candles" in resp:
            candles = resp["candles"]
        elif "data" in resp and isinstance(resp["data"], dict):
            candles = resp["data"].get("candles", [])
        else:
            log.warning(f"Unexpected response for {groww_symbol}: {resp}")
            return pd.DataFrame()
    else:
        log.warning(f"Unexpected response type {type(resp)} for {groww_symbol}")
        return pd.DataFrame()

    if not candles:
        log.info(
            f"No candles returned for {groww_symbol} | "
            f"Start={start_dt.strftime('%Y-%m-%d')} End={end_dt.strftime('%Y-%m-%d')}"
        )
        return pd.DataFrame()

    rows = []
    for c in candles:
        if len(c) < 6:
            continue
        if any(v is None for v in c[:6]):
            log.warning(f"Skipping incomplete candle for {groww_symbol}: {c}")
            continue

        row = {
            "date": pd.to_datetime(c[0], errors="coerce"),
            "open": float(c[1]),
            "high": float(c[2]),
            "low": float(c[3]),
            "close": float(c[4]),
            "volume": int(c[5]),
        }
        rows.append(row)

    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows)
    df = df.dropna(subset=["date"])
    df["date"] = df["date"].dt.normalize()
    return df[["date", "open", "high", "low", "close", "volume"]]

def fetch_groww_incremental(groww_api, groww_symbol, start_dt, end_dt):
    chunks = []
    current = start_dt
    while current < end_dt:
        chunk_end = min(current + timedelta(days=DAYS_PER_CHUNK), end_dt)
        df = fetch_groww_eod_range(groww_api, groww_symbol, current, chunk_end)
        if not df.empty:
            chunks.append(df)
        current = chunk_end + timedelta(days=1)
    return pd.concat(chunks, ignore_index=True) if chunks else pd.DataFrame()

# =========================
# YFINANCE FETCH LOGIC (FALLBACK)
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
        df["date"] = pd.to_datetime(df["date"]).dt.normalize()
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
    """One throttled GET with 429 backoff, mirroring safe_get_groww_candles."""
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


def _resolve_groww_symbol(row, symbol: str) -> str:
    """Groww symbol from the row's column, else the standard `NSE-<symbol>`
    convention (Upstox CSVs don't carry a groww_symbol column)."""
    gs = row.get("groww_symbol") if hasattr(row, "get") else None
    if isinstance(gs, str) and gs.strip():
        return gs.strip()
    return f"NSE-{symbol}"


def _fetch_with_fallbacks(row, symbol, start_dt, end_dt, groww_api) -> pd.DataFrame:
    """Fetch one symbol's candles through the provider chain, returning the first
    non-empty result. Default order is Upstox → Groww → yfinance; a config
    toggle (ohlc_primary_provider="groww") flips the first two for rollback.
    yfinance is always the final safety net."""
    # Benchmark index: Upstox index key, then yfinance. The Groww *equity* path
    # does not serve the index, so it's skipped here (as it was before).
    if symbol == "^NSEI":
        df = fetch_upstox_range(NIFTY_UPSTOX_KEY, start_dt, end_dt)
        if df is not None and not df.empty:
            return df
        return fetch_yfinance_incremental(symbol, start_dt, end_dt)

    instrument_key = _resolve_instrument_key(row)
    groww_symbol = _resolve_groww_symbol(row, symbol)

    def _via_upstox():
        return fetch_upstox_range(instrument_key, start_dt, end_dt)

    def _via_groww():
        return fetch_groww_incremental(groww_api, groww_symbol, start_dt, end_dt) if groww_api else pd.DataFrame()

    def _via_yfinance():
        return fetch_yfinance_incremental(symbol, start_dt, end_dt)

    primary = getattr(get_settings(), "ohlc_primary_provider", "upstox")
    if primary == "groww":
        providers = [_via_groww, _via_upstox, _via_yfinance]
    else:
        providers = [_via_upstox, _via_groww, _via_yfinance]

    for fetch in providers:
        try:
            df = fetch()
        except Exception as e:
            log.warning(f"Provider fetch error for {symbol}: {e}")
            df = pd.DataFrame()
        if df is not None and not df.empty:
            return df
    return pd.DataFrame()


# =========================
# CORE WORKER
# =========================
def process_stock(row, last_date_map, groww_api=None) -> Dict[str, Any]:
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

        # Provider chain: Upstox (primary) → Groww → yfinance. ^NSEI is handled
        # inside via the Upstox index key with a yfinance fallback.
        df = _fetch_with_fallbacks(row, symbol, start_dt, today, groww_api)

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
    settings = get_settings()
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

    # Initialize Groww API if available
    groww_api = None
    if settings.groww_available:
        try:
            import pyotp
            from growwapi import GrowwAPI
            totp_gen = pyotp.TOTP(settings.groww_totp_secret)
            totp = totp_gen.now()
            access_token = GrowwAPI.get_access_token(api_key=settings.groww_api_key, totp=totp)
            groww_api = GrowwAPI(access_token)
            log.info("✅ Authenticated with Groww API for daily refresh")
        except Exception as e:
            log.warning(f"Groww auth failed: {e}. Falling back to yfinance.")

    if groww_api is None:
        log.info("ℹ️ Using yfinance fallback for daily refresh (no authentication required)")

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
                executor.submit(process_stock, row, last_date_map, groww_api): row["Symbol"]
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
        new_df["date"] = pd.to_datetime(new_df["date"])
        
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
