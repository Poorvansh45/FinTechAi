#!/usr/bin/env python3
import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd

try:
    import yfinance as yf
except Exception as e:
    print(json.dumps({"error": f"yfinance not installed: {e}"}))
    sys.exit(1)


def map_symbol(symbol: str) -> str:
    """Map input like 'GOLDIAM' or 'NSE:GOLDIAM' to Yahoo symbol 'GOLDIAM.NS'.
    If already ends with .NS, leave as-is.
    """
    s = (symbol or "").strip().upper()
    # Strip common exchange prefixes like 'NSE:'
    if ':' in s:
        parts = s.split(':', 1)
        # if left part looks like exchange, use the right part
        if parts[0] in {'NSE', 'BSE', 'NS', 'N', 'XNSE'}:
            s = parts[1]
    if s.endswith('.NS') or s.endswith('.BO'):
        return s
    return f"{s}.NS"


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--symbol', required=True)
    p.add_argument('--days', type=int, default=365)
    p.add_argument('--interval', default='1d')
    args = p.parse_args()

    yf_symbol = map_symbol(args.symbol)
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=args.days)

    provider = "Yahoo(NS)"
    try:
        df = yf.download(yf_symbol, start=start, end=end, interval=args.interval, progress=False, auto_adjust=False)
    except Exception as e:
        df = None

    # If empty, try BSE fallback
    if df is None or df.empty:
        sym_core = yf_symbol.replace('.NS', '').replace('.BO', '')
        yf_symbol = f"{sym_core}.BO"
        provider = "Yahoo(BO)"
        try:
            df = yf.download(yf_symbol, start=start, end=end, interval=args.interval, progress=False, auto_adjust=False)
        except Exception:
            df = None

    # If still empty, try longer lookback and coarser interval
    if df is None or df.empty:
        start2 = end - timedelta(days=max(args.days, 1095))
        try:
            df = yf.download(yf_symbol, start=start2, end=end, interval='1wk', progress=False, auto_adjust=False)
        except Exception:
            df = None

    if df is None or df.empty:
        print(json.dumps({"error": f"No data from provider", "provider": provider, "yfSymbol": yf_symbol}))
        sys.exit(1)

    # Flatten possible MultiIndex columns (yfinance can return level-0 OHLCV, level-1 ticker)
    if isinstance(df.columns, pd.MultiIndex):
        try:
            df.columns = df.columns.get_level_values(0)
        except Exception:
            df.columns = [str(c[0]) if isinstance(c, tuple) else str(c) for c in df.columns]

    df = df.reset_index()
    # Standardize columns: time, open, high, low, close, volume
    # yfinance returns 'Date' or 'Datetime'
    time_col = 'Datetime' if 'Datetime' in df.columns else 'Date'
    records = []
    for _, row in df.iterrows():
        ts = row[time_col]
        # ISO string
        if isinstance(ts, (pd.Timestamp, )):
            t = ts.to_pydatetime().isoformat()
        else:
            t = str(ts)
        # Safely coerce numeric values
        def fnum(v):
            try:
                return float(v)
            except Exception:
                try:
                    return float(getattr(v, 'iloc', [v])[0])  # handle single-element Series
                except Exception:
                    return 0.0

        vol = row['Volume'] if 'Volume' in row else 0.0
        records.append({
            'time': t,
            'open': fnum(row['Open']),
            'high': fnum(row['High']),
            'low': fnum(row['Low']),
            'close': fnum(row['Close']),
            'volume': fnum(vol),
        })

    print(json.dumps({'symbol': args.symbol, 'yfSymbol': yf_symbol, 'provider': provider, 'candles': records}))


if __name__ == '__main__':
    main()
