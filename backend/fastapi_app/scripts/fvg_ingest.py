"""
FinAI Edge — FVG Scanner Ingestion (All 2123+ NSE Stocks)
==========================================================
Uses the user's exact ICT-style FVG detection logic:
  - Candle1.High < Candle2.Low AND Candle1.High < Candle3.Low
  - FVG zone = [Candle1.High, min(Candle2.Low, Candle3.Low)]

Computes per stock (2yr OHLC from yfinance):
  - EMA 9, 50, 200
  - RSI 14
  - 52-week High/Low
  - Last 3 bullish FVG zones with dates
  - Filters RSI 40-70 (can be changed)

Upserts results into MongoDB `fvg_cache` collection.

Run:
  /opt/anaconda3/envs/venv/bin/python backend/fastapi_app/scripts/fvg_ingest.py
"""

import os, sys, math, asyncio, logging
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

import pandas as pd
import numpy as np
import talib
from motor.motor_asyncio import AsyncIOMotorClient
import yfinance as yf

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("fvg_ingest")

load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))
MONGODB_URI = os.getenv("MONGODB_URI", "")
CSV_PATH    = os.path.join(os.path.dirname(__file__), "groww_nse_stock_list.csv")

# ─── CONFIG ───────────────────────────────────────────────────────────────────
MAX_WORKERS     = 8
FVG_COUNT       = 3
MIN_FVG_GAP_PCT = 0.01      # minimum gap as % of close price
PERIOD          = "2y"      # yfinance lookback

# ─── Helpers ──────────────────────────────────────────────────────────────────
def safe_float(val) -> float | None:
    try:
        f = float(val)
        return None if (math.isnan(f) or math.isinf(f)) else round(f, 4)
    except Exception:
        return None

def safe_int(val) -> int | None:
    try:
        return int(float(val))
    except Exception:
        return None

def flatten_df(df: pd.DataFrame) -> pd.DataFrame:
    """Flatten yfinance MultiIndex columns."""
    if isinstance(df.columns, pd.MultiIndex):
        df = df.droplevel(level=1, axis=1)
    df.columns = [c.lower() for c in df.columns]
    return df


# ─── FVG Detection (user's exact ICT algo) ────────────────────────────────────
def detect_bullish_fvgs(stock_df: pd.DataFrame, min_gap_pct: float = MIN_FVG_GAP_PCT) -> list:
    """
    ICT-style bullish FVG:
    - Candle 1 high < Candle 2 low
    - Candle 1 high < Candle 3 low
    FVG zone = [C1.High, min(C2.Low, C3.Low)]
    """
    stock_df = stock_df.sort_values("date").reset_index(drop=True)
    results  = []
    N        = len(stock_df)

    if N < 3:
        return results

    for i in range(N - 2):
        c1 = stock_df.iloc[i]
        c2 = stock_df.iloc[i + 1]
        c3 = stock_df.iloc[i + 2]

        if (c2["low"] > c1["high"]) and (c3["low"] > c1["high"]):
            gap_low  = float(c1["high"])
            gap_high = float(min(c2["low"], c3["low"]))
            ref_price = float(c3["close"])
            min_gap   = ref_price * min_gap_pct

            if (gap_high - gap_low) >= min_gap:
                results.append({
                    "formed_idx": i + 2,
                    "low":        round(gap_low, 4),
                    "high":       round(gap_high, 4),
                    "start_date": str(stock_df["date"].iloc[i])[:10],
                    "end_date":   str(stock_df["date"].iloc[i + 2])[:10],
                })

    return results


# ─── Per-stock processing ─────────────────────────────────────────────────────
def process_stock(trading_symbol: str, company_name: str) -> dict | None:
    yf_ticker = f"{trading_symbol}.NS"
    try:
        df_raw = yf.download(
            yf_ticker, period=PERIOD, interval="1d",
            progress=False, auto_adjust=True,
        )
        if df_raw is None or df_raw.empty:
            return None

        df = flatten_df(df_raw).reset_index()
        # Rename Date column
        if "date" not in df.columns and "Date" in df.columns:
            df = df.rename(columns={"Date": "date"})
        if "Datetime" in df.columns:
            df = df.rename(columns={"Datetime": "date"})
        df.columns = [c.lower() for c in df.columns]

        df = df.dropna(subset=["close"]).reset_index(drop=True)
        if len(df) < 50:
            return None

        close  = df["close"].astype(float).values
        high   = df["high"].astype(float).values
        low    = df["low"].astype(float).values

        # ── Indicators ────────────────────────────────────────────────────────
        ema_200 = talib.EMA(close, timeperiod=200)
        ema_50  = talib.EMA(close, timeperiod=50)
        ema_9   = talib.EMA(close, timeperiod=9)
        rsi_14  = talib.RSI(close, timeperiod=14)
        macd_v, macd_sig, _ = talib.MACD(close, 12, 26, 9)

        last_rsi    = safe_float(rsi_14[-1])
        last_ema200 = safe_float(ema_200[-1])
        last_ema50  = safe_float(ema_50[-1])
        last_ema9   = safe_float(ema_9[-1])
        last_macd   = safe_float(macd_v[-1])
        last_macd_s = safe_float(macd_sig[-1])
        last_close  = safe_float(close[-1])
        last_vol    = safe_int(df["volume"].iloc[-1]) if "volume" in df.columns else None

        # 52-week High/Low (rolling 252)
        wk52_high = safe_float(pd.Series(high).rolling(252, min_periods=1).max().iloc[-1])
        wk52_low  = safe_float(pd.Series(low).rolling(252,  min_periods=1).min().iloc[-1])

        # ── FVG Detection ─────────────────────────────────────────────────────
        all_fvgs = detect_bullish_fvgs(df)
        # Last FVG_COUNT most recent (already formed, closest to end)
        recent   = all_fvgs[-FVG_COUNT:][::-1]  # most-recent first

        def fvg_zone(idx):
            if idx < len(recent):
                z = recent[idx]
                return {
                    "low":        z["low"],
                    "high":       z["high"],
                    "start_date": z["start_date"],
                    "end_date":   z["end_date"],
                }
            return None

        has_fvg = len(recent) > 0

        return {
            "symbol":        trading_symbol,
            "company_name":  company_name,
            "price":         last_close,
            "volume":        last_vol,
            "indicators": {
                "rsi_14":      last_rsi,
                "ema_9":       last_ema9,
                "ema_50":      last_ema50,
                "ema_200":     last_ema200,
                "macd":        last_macd,
                "macd_signal": last_macd_s,
            },
            "week52": {
                "high": wk52_high,
                "low":  wk52_low,
            },
            "fvg": {
                "has_fvg_bullish":     has_fvg,
                "total_fvgs_detected": len(all_fvgs),
                "fvg1":               fvg_zone(0),
                "fvg2":               fvg_zone(1),
                "fvg3":               fvg_zone(2),
            },
            "updated_at": datetime.now(timezone.utc),
        }

    except Exception as e:
        return None


# ─── Main ─────────────────────────────────────────────────────────────────────
async def run():
    # 1. Load stock list
    if not os.path.exists(CSV_PATH):
        log.error(f"CSV not found: {CSV_PATH}")
        sys.exit(1)

    df_stocks = pd.read_csv(CSV_PATH)
    df_stocks.columns = df_stocks.columns.str.strip()
    name_col = "company_name" if "company_name" in df_stocks.columns else (
               "name"         if "name"         in df_stocks.columns else None)

    rows = []
    for _, row in df_stocks.iterrows():
        sym  = str(row["trading_symbol"]).strip()
        name = str(row[name_col]).strip() if name_col else sym
        rows.append((sym, name))

    total = len(rows)
    log.info(f"Loaded {total} stocks from CSV")

    # 2. Connect MongoDB
    client = AsyncIOMotorClient(MONGODB_URI)
    db     = client.get_default_database("finai_edge")
    col    = db["fvg_cache"]
    await col.create_index("symbol",                        unique=True)
    await col.create_index("indicators.rsi_14")
    await col.create_index("fvg.has_fvg_bullish")
    await col.create_index("fvg.total_fvgs_detected")
    log.info("Connected to MongoDB.")

    # 3. Parallel processing
    results, done, failed = [], 0, 0
    log.info(f"Processing {total} stocks for FVG analysis ({MAX_WORKERS} threads, {PERIOD} history)…")

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_map = {executor.submit(process_stock, sym, name): (sym, name) for sym, name in rows}
        for future in as_completed(future_map):
            res = future.result()
            done += 1
            if res:
                results.append(res)
                if done % 100 == 0 or done == total:
                    with_fvg = sum(1 for r in results if r["fvg"]["has_fvg_bullish"])
                    log.info(f"Progress: {done}/{total} | {len(results)} valid | {failed} skipped | {with_fvg} have FVG")
            else:
                failed += 1

    # 4. Upsert to MongoDB
    log.info(f"\nUpserting {len(results)} stocks to fvg_cache…")
    for doc in results:
        await col.update_one({"symbol": doc["symbol"]}, {"$set": doc}, upsert=True)

    with_fvg  = sum(1 for r in results if r["fvg"]["has_fvg_bullish"])
    rsi_range = sum(1 for r in results
                    if r["indicators"]["rsi_14"] is not None
                    and 40 <= r["indicators"]["rsi_14"] <= 70)
    log.info(f"\n✅ Done! {len(results)}/{total} stocks upserted into fvg_cache.")
    log.info(f"   Stocks with ≥1 FVG zone: {with_fvg}")
    log.info(f"   Stocks with RSI 40–70:   {rsi_range}")
    log.info(f"   Skipped (no data):        {failed}")


if __name__ == "__main__":
    asyncio.run(run())
