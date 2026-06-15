import os
import pandas as pd
import numpy as np
import math
import logging
import asyncio
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from services.market_service import MarketDataService

log = logging.getLogger("finai_edge.local_ohlc_service")

def _safe(v) -> Optional[float]:
    try:
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else round(f, 4)
    except Exception:
        return None

def _safe_int(v) -> Optional[int]:
    try:
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else int(f)
    except Exception:
        return None

def get_data_dir() -> str:
    """Returns the absolute path to the local data directory (backend/data)."""
    # Relative to this file: services/local_ohlc_service.py -> fastapi_app/ -> backend/ -> data/
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    data_dir = os.path.join(base_dir, "data")
    if not os.path.exists(data_dir):
        os.makedirs(data_dir, exist_ok=True)
    return data_dir

async def process_single_local_file(
    file_path: str,
    db: Optional[AsyncIOMotorDatabase],
    market_service: MarketDataService
) -> Optional[Dict[str, Any]]:
    """
    Load a single local CSV file, update missing candles, save it, run scanners, and cache to DB.
    """
    from utils.helpers import normalize_symbol
    symbol = normalize_symbol(os.path.splitext(os.path.basename(file_path))[0].upper())
    try:
        if not os.path.exists(file_path):
            log.warning(f"File not found: {file_path}")
            return None

        # 1. Load File
        df = pd.read_csv(file_path)
        if df.empty:
            log.warning(f"File {file_path} is empty")
            return None

        # Standardize column headers
        rename_cols = {}
        for col in df.columns:
            col_lower = col.lower()
            if col_lower in ('date', 'timestamp'):
                rename_cols[col] = 'Date'
            elif col_lower == 'open':
                rename_cols[col] = 'Open'
            elif col_lower == 'high':
                rename_cols[col] = 'High'
            elif col_lower == 'low':
                rename_cols[col] = 'Low'
            elif col_lower == 'close':
                rename_cols[col] = 'Close'
            elif col_lower == 'volume':
                rename_cols[col] = 'Volume'

        df.rename(columns=rename_cols, inplace=True)
        required_cols = {'Date', 'Open', 'High', 'Low', 'Close'}
        if not required_cols.issubset(df.columns):
            log.error(f"Missing required columns in {file_path}. Found: {df.columns.tolist()}")
            return None

        # Clean and format DataFrame
        df["Date"] = pd.to_datetime(df["Date"])
        df["Open"] = pd.to_numeric(df["Open"], errors="coerce")
        df["High"] = pd.to_numeric(df["High"], errors="coerce")
        df["Low"] = pd.to_numeric(df["Low"], errors="coerce")
        df["Close"] = pd.to_numeric(df["Close"], errors="coerce")
        if "Volume" in df.columns:
            df["Volume"] = pd.to_numeric(df["Volume"], errors="coerce").fillna(0)
        else:
            df["Volume"] = 0

        df.dropna(subset=["Date", "Open", "High", "Low", "Close"], inplace=True)
        df.sort_values("Date", inplace=True)
        df.reset_index(drop=True, inplace=True)

        if len(df) < 5:
            log.warning(f"Insufficient valid data in {file_path} (need at least 5 candles)")
            return None

        # 2. Fetch and append missing candles
        last_date = df["Date"].max()
        today = datetime.now()
        
        # Localize times for naive comparison if needed
        is_naive = (df["Date"].dt.tz is None)
        
        # Determine how far back we need to fetch
        delta_days = (today - last_date.to_pydatetime()).days if not is_naive else (today.replace(tzinfo=None) - last_date.to_pydatetime()).days
        
        if delta_days > 0:
            if delta_days <= 30:
                period = "1mo"
            elif delta_days <= 365:
                period = "1y"
            else:
                period = "2y"
                
            log.info(f"[Local OHLC] Fetching {period} of missing candles for {symbol}...")
            new_candles = await market_service.get_historical(symbol, interval="1d", period=period)
            
            if new_candles:
                new_rows = []
                for c in new_candles:
                    ts = pd.to_datetime(c.timestamp)
                    if is_naive and ts.tzinfo is not None:
                        ts = ts.tz_localize(None)
                    elif not is_naive and ts.tzinfo is None:
                        ts = ts.tz_localize(timezone.utc)
                        
                    if ts > last_date:
                        new_rows.append({
                            "Date": ts,
                            "Open": round(float(c.open), 2) if c.open is not None else 0.0,
                            "High": round(float(c.high), 2) if c.high is not None else 0.0,
                            "Low": round(float(c.low), 2) if c.low is not None else 0.0,
                            "Close": round(float(c.close), 2) if c.close is not None else 0.0,
                            "Volume": int(c.volume) if c.volume is not None else 0
                        })
                
                if new_rows:
                    new_df = pd.DataFrame(new_rows)
                    df = pd.concat([df, new_df], ignore_index=True)
                    df.sort_values("Date", inplace=True)
                    df.drop_duplicates(subset=["Date"], keep="last", inplace=True)
                    df.reset_index(drop=True, inplace=True)
                    
                    # 3. Save File Again
                    df.to_csv(file_path, index=False)
                    log.info(f"[Local OHLC] Successfully updated {file_path} with {len(new_rows)} new candles")
        
        # 4. Compute Indicators
        close = df["Close"].values
        volume = df["Volume"].values
        high = df["High"].values
        low = df["Low"].values
        ltp = float(close[-1])

        def ema(arr, period):
            s = pd.Series(arr)
            return s.ewm(span=period, adjust=False).mean().values

        ema_9 = ema(close, 9)
        ema_50 = ema(close, 50)
        ema_200 = ema(close, 200)

        ema50_val = _safe(ema_50[-1])
        ema200_val = _safe(ema_200[-1])
        ema50_dist = _safe((ltp - ema_50[-1]) / ema_50[-1] * 100) if ema_50[-1] else None
        ema200_dist = _safe((ltp - ema_200[-1]) / ema_200[-1] * 100) if ema_200[-1] else None

        delta = pd.Series(close).diff()
        gain = delta.clip(lower=0)
        loss = (-delta.clip(upper=0))
        avg_gain = gain.ewm(alpha=1/14, min_periods=14, adjust=False).mean()
        avg_loss = loss.ewm(alpha=1/14, min_periods=14, adjust=False).mean()
        rs = avg_gain / avg_loss.replace(0, np.nan)
        rsi_14 = _safe(100 - (100 / (1 + rs.iloc[-1])))

        ema_12 = ema(close, 12)
        ema_26 = ema(close, 26)
        macd_line = ema_12 - ema_26
        signal_line = ema(macd_line, 9)
        macd_hist = _safe(macd_line[-1] - signal_line[-1])
        macd_val = _safe(macd_line[-1])

        avg_vol_20 = _safe(float(pd.Series(volume).rolling(20, min_periods=5).mean().iloc[-1]))
        curr_vol = _safe(float(volume[-1]))
        vol_ratio = _safe(curr_vol / avg_vol_20) if avg_vol_20 and avg_vol_20 > 0 else None

        wk52_high = _safe(float(high[-252:].max())) if len(high) >= 20 else _safe(float(high.max()))
        wk52_low = _safe(float(low[-252:].min())) if len(low) >= 20 else _safe(float(low.min()))
        wk52_dist = _safe((ltp - wk52_high) / wk52_high * 100) if wk52_high else None

        indicators = {
            "ema_9": _safe(ema_9[-1]),
            "ema_50": ema50_val,
            "ema_200": ema200_val,
            "ema_50_dist_pct": ema50_dist,
            "ema_200_dist_pct": ema200_dist,
            "rsi_14": rsi_14,
            "macd": macd_val,
            "macd_hist": macd_hist,
        }

        # 5. Run SMC/FVG
        fvg_data = {}
        try:
            from scanners.fvg import get_latest_fvgs_for_symbol
            fvg_data = await asyncio.to_thread(
                get_latest_fvgs_for_symbol, df, symbol, ltp,
                rsi=rsi_14, ema_200_dist=ema200_dist
            )
        except Exception as fe:
            log.warning(f"[Local OHLC] FVG Scanner failed for {symbol}: {fe}")

        smc_data = {}
        try:
            from scanners.smc_scanner import run_full_smc_analysis
            smc_data = await asyncio.to_thread(
                run_full_smc_analysis, df, symbol,
                swing_len=5, rsi=rsi_14, volume_ratio=vol_ratio
            )
        except Exception as se:
            log.warning(f"[Local OHLC] SMC Scanner failed for {symbol}: {se}")

        # 6. Cache to MongoDB
        updated_at = datetime.now(timezone.utc)
        if db is not None:
            # Upsert screener cache
            screener_doc = {
                "symbol": symbol,
                "price": round(ltp, 2),
                "volume": _safe_int(curr_vol),
                "avg_volume_20d": avg_vol_20,
                "indicators": indicators,
                "is_local": True,
                "updated_at": updated_at,
            }
            await db.get_collection("screener_cache").update_one(
                {"symbol": symbol}, {"$set": screener_doc}, upsert=True
            )

            # Upsert FVG cache
            if fvg_data:
                fvg_doc = {
                    "symbol": symbol,
                    "ltp": round(ltp, 2),
                    "has_fvg_bullish": fvg_data.get("has_fvg_bullish", False),
                    "has_fvg_bearish": fvg_data.get("has_fvg_bearish", False),
                    "total_fvgs_bullish": fvg_data.get("total_fvgs_bullish", 0),
                    "top_bullish_fvgs": fvg_data.get("top_bullish_fvgs", []),
                    "top_bearish_fvgs": fvg_data.get("top_bearish_fvgs", []),
                    "nearest_bullish_fvg": fvg_data.get("nearest_bullish_fvg"),
                    "best_fvg_score": fvg_data.get("best_fvg_score", 0),
                    "indicators": indicators,
                    "is_local": True,
                    "updated_at": updated_at,
                }
                await db.get_collection("fvg_cache").update_one(
                    {"symbol": symbol}, {"$set": fvg_doc}, upsert=True
                )

            # Upsert SMC cache
            if smc_data:
                from services.smc_service import _serialize
                smc_clean = _serialize(smc_data)
                smc_clean["is_local"] = True
                smc_clean["updated_at"] = updated_at
                await db.get_collection("smc_scanner_results").update_one(
                    {"symbol": symbol}, {"$set": smc_clean}, upsert=True
                )

                # Upsert individual zones
                all_zones = (
                    smc_data.get("demand_zones", []) +
                    smc_data.get("supply_zones", []) +
                    smc_data.get("internal_demand_zones", []) +
                    smc_data.get("internal_supply_zones", [])
                )
                for zone in all_zones:
                    zone_clean = _serialize(zone)
                    zone_clean["symbol"] = symbol
                    zone_clean["is_local"] = True
                    await db.get_collection("smc_zones").update_one(
                        {"symbol": symbol, "zone_high": zone["zone_high"], "zone_low": zone["zone_low"]},
                        {"$set": zone_clean},
                        upsert=True,
                    )

        return {
            "symbol": symbol,
            "candles": len(df),
            "price": ltp,
            "rsi": rsi_14,
            "has_fvg": fvg_data.get("has_fvg_bullish", False) if fvg_data else False,
            "smc_score": smc_data.get("smc_score", 0) if smc_data else 0,
            "updated_at": updated_at.isoformat()
        }

    except Exception as e:
        log.error(f"Error processing local file {file_path}: {e}", exc_info=True)
        return None

async def scan_all_local_files(
    db: Optional[AsyncIOMotorDatabase],
    market_service: MarketDataService
) -> List[Dict[str, Any]]:
    """
    Scans and updates all CSV files inside the backend/data directory.
    """
    data_dir = get_data_dir()
    results = []
    for file_name in os.listdir(data_dir):
        if file_name.lower().endswith(".csv"):
            if file_name.lower() == "stock_data.csv":
                continue
            file_path = os.path.join(data_dir, file_name)
            # Verify boundary just to be safe
            resolved_path = os.path.realpath(file_path)
            resolved_dir = os.path.dirname(resolved_path)
            if resolved_dir != os.path.realpath(data_dir):
                log.warning(f"Skipping out-of-bounds file path: {file_path}")
                continue
                
            res = await process_single_local_file(resolved_path, db, market_service)
            if res:
                results.append(res)
    return results
