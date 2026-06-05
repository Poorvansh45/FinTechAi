"""
FinAI Edge — Full NSE Screener Population
==========================================
Reads ALL stocks from groww_nse_stock_list.csv (2123+ stocks),
downloads 1yr OHLC from yfinance (fallback) in parallel,
computes TA-Lib indicators (RSI, EMA50, EMA200, MACD),
computes EMA distance % (cross-stock comparable),
and upserts into MongoDB screener_cache.

Indicators stored:
  rsi_14, ema_50, ema_200,
  ema_50_dist_pct, ema_200_dist_pct,   ← % distance from price to EMA
  macd, macd_signal, macd_hist

Run:
  /opt/anaconda3/envs/venv/bin/python backend/fastapi_app/scripts/populate_screener.py
"""

import os, sys, math, asyncio, logging
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

import pandas as pd
import talib
from motor.motor_asyncio import AsyncIOMotorClient
import yfinance as yf

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("populate_screener")

load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))
MONGODB_URI = os.getenv("MONGODB_URI", "")

# ─── CONFIG ───────────────────────────────────────────────────────────────────
MAX_WORKERS = 8       # parallel yfinance downloads
CSV_PATH    = os.path.join(os.path.dirname(__file__), "groww_nse_stock_list.csv")


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
    """Flatten yfinance (col, ticker) MultiIndex into simple lowercase columns."""
    if isinstance(df.columns, pd.MultiIndex):
        df = df.droplevel(level=1, axis=1)
    df.columns = [c.lower() for c in df.columns]
    return df


# ─── Per-stock processing (runs in thread pool) ───────────────────────────────
def process_stock(trading_symbol: str, company_name: str) -> dict | None:
    yf_ticker = f"{trading_symbol}.NS"
    try:
        df_raw = yf.download(
            yf_ticker, period="1y", interval="1d",
            progress=False, auto_adjust=True
        )
        if df_raw is None or df_raw.empty:
            return None

        df = flatten_df(df_raw)
        df = df.dropna(subset=["close"]).reset_index()
        if len(df) < 50:
            return None

        close = df["close"].astype(float).values

        rsi_14  = safe_float(talib.RSI(close, timeperiod=14)[-1])
        ema_50  = safe_float(talib.EMA(close, timeperiod=50)[-1])
        ema_200 = safe_float(talib.EMA(close, timeperiod=200)[-1])
        macd_v, macd_sig, macd_hist_v = talib.MACD(close, 12, 26, 9)
        macd        = safe_float(macd_v[-1])
        macd_signal = safe_float(macd_sig[-1])
        macd_hist   = safe_float(macd_hist_v[-1])

        # EMA Distance % — price-normalised, cross-stock comparable
        last_close = close[-1]
        ema_50_dist_pct  = safe_float(((last_close - talib.EMA(close, timeperiod=50)[-1])  / talib.EMA(close, timeperiod=50)[-1])  * 100) if ema_50  else None
        ema_200_dist_pct = safe_float(((last_close - talib.EMA(close, timeperiod=200)[-1]) / talib.EMA(close, timeperiod=200)[-1]) * 100) if ema_200 else None

        price = safe_float(df["close"].iloc[-1])
        vol   = safe_int(df["volume"].iloc[-1]) if "volume" in df.columns else None

        return {
            "symbol":       trading_symbol,
            "company_name": company_name,
            "price":        price,
            "volume":       vol,
            "indicators": {
                "rsi_14":           rsi_14,
                "ema_50":           ema_50,
                "ema_200":          ema_200,
                "ema_50_dist_pct":  ema_50_dist_pct,
                "ema_200_dist_pct": ema_200_dist_pct,
                "macd":             macd,
                "macd_signal":      macd_signal,
                "macd_hist":        macd_hist,
            },
            "fvg": {"has_fvg_bullish": False, "has_fvg_bearish": False, "gap_range": None},
            "updated_at": datetime.now(timezone.utc),
        }

    except Exception as e:
        return None  # silently skip bad tickers


# ─── Main ─────────────────────────────────────────────────────────────────────
async def run():
    # 1. Load stock universe from CSV
    if not os.path.exists(CSV_PATH):
        log.error(f"CSV not found: {CSV_PATH}")
        log.error("Run groww_screener_ingest.py first to generate it.")
        sys.exit(1)

    df_stocks = pd.read_csv(CSV_PATH)
    df_stocks.columns = df_stocks.columns.str.strip()

    # Determine company_name column
    name_col = "company_name" if "company_name" in df_stocks.columns else (
               "name"         if "name"         in df_stocks.columns else None)

    rows = []
    for _, row in df_stocks.iterrows():
        symbol = str(row["trading_symbol"]).strip()
        name   = str(row[name_col]).strip() if name_col else symbol
        rows.append((symbol, name))

    total = len(rows)
    log.info(f"Loaded {total} stocks from {CSV_PATH}")

    # 2. Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URI)
    db     = client.get_default_database("finai_edge")
    col    = db["screener_cache"]
    await col.create_index("symbol", unique=True)
    log.info("Connected to MongoDB.")

    # 3. Parallel yfinance download + indicator calculation
    results   = []
    done      = 0
    failed    = 0

    log.info(f"Downloading 1yr OHLC + computing indicators for {total} stocks "
             f"({MAX_WORKERS} threads)…")

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_map = {
            executor.submit(process_stock, sym, name): (sym, name)
            for sym, name in rows
        }
        for future in as_completed(future_map):
            sym, _ = future_map[future]
            res = future.result()
            done += 1
            if res:
                results.append(res)
                if done % 50 == 0 or done == total:
                    log.info(
                        f"Progress: {done}/{total} processed "
                        f"({len(results)} valid, {failed} skipped)"
                    )
            else:
                failed += 1

    # 4. Bulk upsert to MongoDB
    log.info(f"\nUpserting {len(results)} stocks to MongoDB…")
    upserted = 0
    for doc in results:
        await col.update_one(
            {"symbol": doc["symbol"]},
            {"$set": doc},
            upsert=True,
        )
        upserted += 1

    log.info(f"\n✅ Done! {upserted}/{total} stocks upserted into screener_cache.")
    log.info(f"   Skipped {failed} stocks (not listed on yfinance / insufficient data).")


if __name__ == "__main__":
    asyncio.run(run())
