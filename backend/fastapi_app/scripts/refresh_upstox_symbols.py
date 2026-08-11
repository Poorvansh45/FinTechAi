"""
Refresh the NSE equity universe from the Upstox instrument master.
====================================================================
Regenerates `scripts/upstox_nse_stock_list.csv`, the canonical stock list the
bulk OHLCV downloader (`services/ohlc_downloader.py`) and the universe cache
(`services/universe_cache.py`) read.

The Upstox instrument master is a public, unauthenticated gzipped JSON snapshot
of every NSE instrument. We keep only cash-segment equities and the columns the
rest of the pipeline needs — critically `instrument_key` (Upstox's per-symbol
key, format `NSE_EQ|<isin>`, required by the V3 historical-candle API) and
`company_name` (mapped from the master's `name`, consumed by the coordinator's
`_company_name_map`).

Run on demand / periodically (e.g. before a first-time build or when new
listings appear) — NOT on every scan:

    python scripts/refresh_upstox_symbols.py
"""

import gzip
import io
import os
import sys

import pandas as pd
import requests

# Public Upstox NSE instrument master (no authentication required).
INSTRUMENTS_URL = (
    "https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz"
)

# Columns written to the CSV, in order. `instrument_key` + `company_name` are
# the load-bearing additions over the legacy Groww list; `trading_symbol`,
# `isin`, `exchange`, `segment` mirror what downstream loaders already expect.
OUTPUT_COLUMNS = [
    "instrument_key",
    "trading_symbol",
    "isin",
    "company_name",
    "exchange",
    "segment",
]


def _output_path() -> str:
    """`scripts/upstox_nse_stock_list.csv`, resolved relative to this file so the
    script works regardless of the caller's working directory."""
    return os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "upstox_nse_stock_list.csv"
    )


def fetch_instrument_master() -> pd.DataFrame:
    resp = requests.get(INSTRUMENTS_URL, timeout=120)
    resp.raise_for_status()
    with gzip.open(io.BytesIO(resp.content), "rt", encoding="utf-8") as f:
        return pd.read_json(f)


def build_nse_equity_list(instruments_df: pd.DataFrame) -> pd.DataFrame:
    """Filter to NSE cash-segment equities and shape to OUTPUT_COLUMNS.

    Mirrors the user's reference Stock_list.py filter (NSE_EQ + EQ + drop
    ISINs starting with INF, which are mutual-fund units), but additionally
    preserves the company name from the master's `name` field."""
    nse_eq = instruments_df[
        (instruments_df["segment"] == "NSE_EQ")
        & (instruments_df["instrument_type"] == "EQ")
        & (~instruments_df["isin"].astype(str).str.startswith("INF", na=False))
    ].copy()

    # Master calls the display name `name`; the rest of the pipeline expects
    # `company_name`. Fall back to the trading symbol if a name is missing.
    nse_eq["company_name"] = (
        nse_eq["name"]
        .fillna("")
        .astype(str)
        .str.strip()
        .replace("", pd.NA)
        .fillna(nse_eq["trading_symbol"])
    )
    nse_eq["exchange"] = "NSE"

    return nse_eq[OUTPUT_COLUMNS].reset_index(drop=True)


def main() -> int:
    print(f"Downloading Upstox NSE instrument master…\n  {INSTRUMENTS_URL}")
    try:
        instruments_df = fetch_instrument_master()
    except Exception as e:
        print(f"[FATAL] Could not fetch/parse instrument master: {e}", file=sys.stderr)
        return 1

    nse_eq = build_nse_equity_list(instruments_df)

    out_path = _output_path()
    nse_eq.to_csv(out_path, index=False)

    print(f"\nNSE equity stock list saved -> {out_path}")
    print(f"  Total NSE equities: {len(nse_eq)}")
    print(nse_eq.head().to_string(index=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
