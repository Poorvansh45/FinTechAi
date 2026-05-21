#!/usr/bin/env python3
import argparse
import json
import sys
import pandas as pd
from pathlib import Path

# Robust column resolver to accommodate various header names
COL_ALIASES = {
    'cmp': ['cmp', 'CMP', 'price', 'Price', 'Close', 'close', 'last_price', 'LTP'],
    'change_pct': ['change_pct', 'ChangePct', 'change%', 'Change %', '%change', '%chg', 'pct_change'],
    'demand_zone': ['demand_zone', 'DemandZone', 'demand', 'Demand', 'zone', 'Zone']
}

def resolve_column(df, key):
    aliases = COL_ALIASES[key]
    for name in df.columns:
        for a in aliases:
            if str(name).strip().lower() == str(a).strip().lower():
                return name
    # fallback: try contains
    low = [c for c in df.columns if key in str(c).strip().lower()]
    if low:
        return low[0]
    return None

def guess_numeric_column(df: pd.DataFrame, prefer_names: list[str], value_range: tuple[float, float] | None = None):
    # Prefer name hints first
    for c in df.columns:
        cl = str(c).lower()
        if any(h in cl for h in prefer_names):
            try:
                s = pd.to_numeric(df[c], errors='coerce')
            except Exception:
                continue
            if value_range is None or ((s >= value_range[0]) & (s <= value_range[1])).mean() > 0.3:
                return c
    # Fallback: first numeric-looking column in range
    for c in df.columns:
        try:
            s = pd.to_numeric(df[c], errors='coerce')
        except Exception:
            continue
        if s.notna().sum() == 0:
            continue
        if value_range is None:
            return c
        frac_in_range = ((s >= value_range[0]) & (s <= value_range[1])).mean()
        if frac_in_range > 0.3:
            return c
    return None


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--csv', required=True, help='Path to CSV file')
    p.add_argument('--cmp-min', type=float, default=200)
    p.add_argument('--cmp-max', type=float, default=5000)
    p.add_argument('--chg-min', type=float, default=-5)
    p.add_argument('--chg-max', type=float, default=10)
    p.add_argument('--demand', type=str, default='any', help="Demand filter: any | hot | present | zone | both")
    # Backward-compat: accept legacy flag and map to demand=hot
    p.add_argument('--demand-hot', action='store_true', help=argparse.SUPPRESS)
    p.add_argument('--cmp-col', type=str, default=None, help='Override CMP column name')
    p.add_argument('--chg-col', type=str, default=None, help='Override Change %% column name')
    p.add_argument('--demand-col', type=str, default=None, help='Override Demand Zone column name')
    p.add_argument('--limit', type=int, default=200)
    p.add_argument('--debug', action='store_true', help='Return debug info about demand filtering columns and matches')
    args = p.parse_args()
    if getattr(args, 'demand_hot', False) and (not args.demand or args.demand == 'any'):
        args.demand = 'hot'

    csv_path = Path(args.csv)
    if not csv_path.exists():
        print(json.dumps({'error': f'CSV not found: {csv_path}'}))
        sys.exit(1)

    try:
        df = pd.read_csv(csv_path)
    except Exception as e:
        print(json.dumps({'error': f'Failed to read CSV: {e}'}))
        sys.exit(1)

    # Resolve columns
    cmp_col = args.cmp_col or resolve_column(df, 'cmp') or guess_numeric_column(
        df, prefer_names=['cmp', 'price', 'close', 'ltp', 'last'], value_range=(0, 1_000_000)
    )
    chg_col = args.chg_col or resolve_column(df, 'change_pct') or guess_numeric_column(
        df, prefer_names=['change', 'chg', '%'], value_range=(-100, 100)
    )
    demand_col = args.demand_col or resolve_column(df, 'demand_zone')

    if cmp_col is None or chg_col is None:
        # Report available headers to help user map
        print(json.dumps({
            'error': 'Required columns not found. Expected CMP and Change % columns.',
            'columns': list(map(str, df.columns))
        }))
        sys.exit(1)

    # Coerce numeric
    df[cmp_col] = pd.to_numeric(df[cmp_col], errors='coerce')
    df[chg_col] = pd.to_numeric(df[chg_col], errors='coerce')

    mask = (
        (df[cmp_col] >= args.cmp_min) &
        (df[cmp_col] <= args.cmp_max) &
        (df[chg_col] >= args.chg_min) &
        (df[chg_col] <= args.chg_max)
    )

    # Demand filtering: support single column (explicit) OR scan common columns like 'SETUP 1/2/3'
    debug_info = {}
    if args.demand and args.demand.lower() != 'any':
        wanted = args.demand.lower()

        def col_mask(series: pd.Series) -> pd.Series:
            s = series.astype(str).str.lower()
            # normalize whitespace
            s_norm = s.str.replace(r'\s+', ' ', regex=True).str.strip()
            if wanted == 'hot':
                # match phrases like 'hot demand zone'
                return s_norm.str.contains(r'\bhot\b', regex=True, na=False) & s_norm.str.contains(r'\bdemand\b', regex=True, na=False)
            if wanted == 'present':
                # often spreadsheets use 'present' to indicate availability
                return s_norm.str.contains(r'\bpresent\b', regex=True, na=False)
            if wanted == 'zone':
                # prefer exact phrase 'demand zone' with flexible spacing/case
                return s_norm.str.contains(r'\bdemand\s+zone\b', regex=True, na=False)
            if wanted == 'both':
                hot_mask = s_norm.str.contains(r'\bhot\b', regex=True, na=False) & s_norm.str.contains(r'\bdemand\b', regex=True, na=False)
                zone_mask = s_norm.str.contains(r'\bdemand\s+zone\b', regex=True, na=False)
                return hot_mask | zone_mask
            return pd.Series([True] * len(s), index=s.index)

        demand_any = None
        hot_any = None
        zone_any = None
        candidate_cols = []
        if demand_col is not None and demand_col in df.columns:
            candidate_cols = [demand_col]
        else:
            # scan likely columns (e.g., 'SETUP 1', 'SETUP 2', 'SETUP 3', any col having 'setup' or 'demand')
            for c in df.columns:
                cl = str(c).lower()
                if ('setup' in cl) or ('demand' in cl):
                    candidate_cols.append(c)

        debug_info['candidate_demand_columns'] = [str(c) for c in candidate_cols]
        for c in candidate_cols:
            base_s = df[c].astype(str).str.lower().str.replace(r'\s+', ' ', regex=True).str.strip()
            m = col_mask(base_s)
            demand_any = m if demand_any is None else (demand_any | m)
            # separate trackers for cross-column logic
            m_hot = base_s.str.contains(r'\bhot\b', regex=True, na=False)
            m_zone = base_s.str.contains(r'\bdemand\s+zone\b', regex=True, na=False) | base_s.str.contains(r'\bdemand\b', regex=True, na=False)
            hot_any = m_hot if hot_any is None else (hot_any | m_hot)
            zone_any = m_zone if zone_any is None else (zone_any | m_zone)
            if args.debug:
                debug_info[f'matches_in_{c}'] = int(m.sum())
                debug_info[f'hot_in_{c}'] = int(m_hot.sum())
                debug_info[f'zone_in_{c}'] = int(m_zone.sum())

        if wanted == 'both' and (hot_any is not None or zone_any is not None):
            # rows that have HOT anywhere and Demand Zone anywhere (could be different columns)
            both_mask = None
            if hot_any is not None and zone_any is not None:
                both_mask = hot_any & zone_any
            elif hot_any is not None:
                both_mask = hot_any
            elif zone_any is not None:
                both_mask = zone_any
            if both_mask is not None:
                mask = mask & both_mask
        else:
            if demand_any is not None:
                mask = mask & demand_any

    out = df[mask].copy()

    # Prepare safe JSON: limit and replace NaNs
    out = out.head(args.limit)
    result = json.loads(out.to_json(orient='records'))
    payload = {'rows': result, 'count': int(len(out))}
    if args.debug:
        payload['debug'] = debug_info
        payload['columns'] = list(map(str, df.columns))
    print(json.dumps(payload))


if __name__ == '__main__':
    main()
