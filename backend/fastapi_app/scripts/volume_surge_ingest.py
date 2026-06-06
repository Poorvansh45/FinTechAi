"""
FinAI Edge — Volume Surge Scanner Ingestion (Full NSE Universe)
================================================================
Reads ALL stocks from groww_nse_stock_list.csv (2123+ stocks),
downloads 3yr OHLC from yfinance in parallel,
computes volume surge stats, and upserts into MongoDB volume_surge_cache.

Run:
  /opt/anaconda3/envs/venv/bin/python backend/fastapi_app/scripts/volume_surge_ingest.py
"""

import os, sys, math, asyncio, logging
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

import pandas as pd
from motor.motor_asyncio import AsyncIOMotorClient
import yfinance as yf

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("volume_surge")

load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))
MONGODB_URI = os.getenv("MONGODB_URI", "")

# ─── CONFIG ───────────────────────────────────────────────────────────────────
MAX_WORKERS            = 8
VOLUME_SURGE_THRESHOLD = 2.0   # volume > 2x avg = spike
AVG_WINDOW             = 20    # 20-day rolling average
LOOKBACK_PERIOD        = "3y"
CSV_PATH               = os.path.join(os.path.dirname(__file__), "groww_nse_stock_list.csv")


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
    if isinstance(df.columns, pd.MultiIndex):
        df = df.droplevel(level=1, axis=1)
    df.columns = [c.lower() for c in df.columns]
    return df


def compute_forward_return(df: pd.DataFrame, idx: int, days: int) -> float | None:
    """Return % gain N trading days after surge index. None if data unavailable."""
    target = idx + days
    if target >= len(df):
        return None
    try:
        entry = float(df["close"].iloc[idx])
        exit_ = float(df["close"].iloc[target])
        if entry <= 0:
            return None
        return safe_float((exit_ - entry) / entry * 100)
    except Exception:
        return None


def process_stock(trading_symbol: str, company_name: str) -> dict | None:
    yf_ticker = f"{trading_symbol}.NS"
    try:
        df_raw = yf.download(
            yf_ticker, period=LOOKBACK_PERIOD, interval="1d",
            progress=False, auto_adjust=True
        )
        if df_raw is None or df_raw.empty:
            return None

        df = flatten_df(df_raw)
        df = df.dropna(subset=["close", "volume"]).reset_index()
        if len(df) < AVG_WINDOW + 5:
            return None

        # Rolling avg volume and ratio
        df["avg_vol_20d"]    = df["volume"].rolling(AVG_WINDOW).mean()
        df["volume_ratio"]   = df["volume"] / df["avg_vol_20d"]
        df["day_return_pct"] = (
            (df["close"] - df["close"].shift(1)) / df["close"].shift(1) * 100
        ).round(4)
        df = df.dropna(subset=["avg_vol_20d"]).reset_index(drop=True)

        # All surge events over full history
        surge_mask = df["volume_ratio"] >= VOLUME_SURGE_THRESHOLD
        surges     = df[surge_mask].copy()

        # Latest values
        latest        = df.iloc[-1]
        cur_vol       = safe_int(latest["volume"])
        avg_vol_20d   = safe_int(latest["avg_vol_20d"])
        cur_vol_ratio = safe_float(latest["volume_ratio"])
        cur_day_ret   = safe_float(latest["day_return_pct"])
        cur_price     = safe_float(latest["close"])

        # ── Forward returns per surge event ───────────────────────────────────
        ret_2d_list, ret_5d_list, ret_10d_list = [], [], []
        for surge_idx in surges.index:
            r2  = compute_forward_return(df, surge_idx, 2)
            r5  = compute_forward_return(df, surge_idx, 5)
            r10 = compute_forward_return(df, surge_idx, 10)
            surges.loc[surge_idx, "return_2d"]  = r2
            surges.loc[surge_idx, "return_5d"]  = r5
            surges.loc[surge_idx, "return_10d"] = r10
            if r2  is not None: ret_2d_list.append(r2)
            if r5  is not None: ret_5d_list.append(r5)
            if r10 is not None: ret_10d_list.append(r10)

        # Recent 90-day surge events for display
        recent_cut    = pd.to_datetime(df["Date"].max()) - pd.Timedelta(days=90)
        recent_surges = surges[pd.to_datetime(surges["Date"]) >= recent_cut].sort_values("Date", ascending=False)

        surge_events = []
        for _, row in recent_surges.head(5).iterrows():
            surge_events.append({
                "date":         str(row["Date"])[:10],
                "volume":       safe_int(row["volume"]),
                "volume_ratio": safe_float(row["volume_ratio"]),
                "day_return":   safe_float(row["day_return_pct"]),
                "return_2d":    safe_float(row.get("return_2d")),
                "return_5d":    safe_float(row.get("return_5d")),
                "return_10d":   safe_float(row.get("return_10d")),
                "close":        safe_float(row["close"]),
            })

        # ── 3yr aggregate stats ────────────────────────────────────────────────
        total_surge_days   = len(surges)
        max_ratio          = safe_float(surges["volume_ratio"].max())  if total_surge_days else None
        avg_ret_on_surge   = safe_float(surges["day_return_pct"].mean()) if total_surge_days else None
        positive_surge_pct = safe_float(
            (surges["day_return_pct"] > 0).sum() / total_surge_days * 100
        ) if total_surge_days else None

        def _avg(lst): return safe_float(sum(lst) / len(lst)) if lst else None
        def _wr(lst):  return safe_float(sum(1 for x in lst if x > 0) / len(lst) * 100) if lst else None

        return {
            "symbol":              trading_symbol,
            "company_name":        company_name,
            "price":               cur_price,
            "volume":              cur_vol,
            "avg_volume_20d":      avg_vol_20d,
            "volume_ratio":        cur_vol_ratio,
            "day_return_pct":      cur_day_ret,
            "surge_stats": {
                "max_ratio_3yr":        max_ratio,
                "avg_return_on_surge":  avg_ret_on_surge,
                "total_surge_days_3yr": total_surge_days,
                "positive_surge_pct":   positive_surge_pct,
                # Forward return averages (only where future data exists)
                "avg_return_2d":   _avg(ret_2d_list),
                "avg_return_5d":   _avg(ret_5d_list),
                "avg_return_10d":  _avg(ret_10d_list),
                # Win rate = % of surges where N-day forward return > 0
                "win_rate_2d":     _wr(ret_2d_list),
                "win_rate_5d":     _wr(ret_5d_list),
                "win_rate_10d":    _wr(ret_10d_list),
            },
            "recent_surge_events": surge_events,
            "has_current_surge":   (cur_vol_ratio or 0) >= VOLUME_SURGE_THRESHOLD,
            "updated_at":          datetime.now(timezone.utc),
        }

    except Exception as e:
        return None



async def run():
    # 1. Load stock universe
    if not os.path.exists(CSV_PATH):
        log.error(f"CSV not found: {CSV_PATH}")
        log.error("Run groww_screener_ingest.py first to generate the stock list.")
        sys.exit(1)

    df_stocks = pd.read_csv(CSV_PATH)
    df_stocks.columns = df_stocks.columns.str.strip()
    name_col  = "company_name" if "company_name" in df_stocks.columns else (
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
    col    = db["volume_surge_cache"]
    await col.create_index("symbol",       unique=True)
    await col.create_index("volume_ratio")
    await col.create_index("day_return_pct")
    await col.create_index("surge_stats.total_surge_days_3yr")
    log.info("Connected to MongoDB.")

    # 3. Parallel processing
    results, done, failed = [], 0, 0
    log.info(f"Processing {total} stocks for 3yr volume surge analysis ({MAX_WORKERS} threads)…")

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_map = {executor.submit(process_stock, sym, name): (sym, name) for sym, name in rows}
        for future in as_completed(future_map):
            sym, _ = future_map[future]
            res = future.result()
            done += 1
            if res:
                results.append(res)
                if done % 100 == 0 or done == total:
                    surging = sum(1 for r in results if r["has_current_surge"])
                    log.info(f"Progress: {done}/{total} | {len(results)} valid | {failed} skipped | {surging} currently surging")
            else:
                failed += 1

    # 4. Upsert to MongoDB
    log.info(f"\nUpserting {len(results)} stocks to volume_surge_cache…")
    for doc in results:
        await col.update_one({"symbol": doc["symbol"]}, {"$set": doc}, upsert=True)

    surging_now = sum(1 for r in results if r["has_current_surge"])
    log.info(f"\n✅ Done! {len(results)}/{total} stocks upserted.")
    log.info(f"   Currently surging today: {surging_now} stocks")
    log.info(f"   Skipped: {failed} (not on yfinance / insufficient data)")


if __name__ == "__main__":
    asyncio.run(run())
