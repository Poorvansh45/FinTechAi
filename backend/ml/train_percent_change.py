#!/usr/bin/env python3
"""
Train models to predict next-day percent change from a stocks CSV.
- Target: PERCENT CHANGE (shifted -1 to predict next day)
- Exclude: SERIAL NO, STOCK NAME, SYMBOL, FIXED SYMBOL (if present)
- Feature engineering: lags, rolling stats, encodings
- Models: Linear Regression, Random Forest, XGBoost (optional)
- Time-aware split
- Outputs: models/best_model.joblib, models/report.json, models/metrics.csv, models/feature_importances.csv (if available)

Usage:
  python ml/train_percent_change.py --csv data/STOCK-SCREEN-SAMPLE-1-Sheet1-1.csv
"""

import argparse
import json
import os
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

try:
    from xgboost import XGBRegressor  # type: ignore

    HAS_XGB = True
except Exception:
    HAS_XGB = False

import joblib

EXCLUDE_DEFAULT = ["SERIAL NO", "STOCK NAME", "SYMBOL", "FIXED SYMBOL"]


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--csv", required=True, help="Path to CSV file")
    p.add_argument(
        "--date-col", default=None, help="Date column name (auto-detect if omitted)"
    )
    p.add_argument(
        "--target-col", default="PERCENT CHANGE", help="Target column to predict"
    )
    p.add_argument(
        "--exclude",
        nargs="*",
        default=EXCLUDE_DEFAULT,
        help="Columns to exclude from features",
    )
    p.add_argument(
        "--id-cols",
        nargs="*",
        default=[],
        help="Additional identifier columns to drop from features",
    )
    p.add_argument(
        "--lags",
        nargs="*",
        type=int,
        default=[1, 3, 5],
        help="Lag periods for numeric features",
    )
    p.add_argument(
        "--rollings",
        nargs="*",
        type=int,
        default=[3, 5, 10],
        help="Rolling windows for stats",
    )
    p.add_argument("--outdir", default="models", help="Output directory")
    p.add_argument(
        "--test-size",
        type=float,
        default=0.2,
        help="Proportion for time-based validation split (0-1)",
    )
    return p.parse_args()


def detect_date_column(df: pd.DataFrame) -> str | None:
    candidates = [c for c in df.columns if "date" in str(c).lower()]
    for c in candidates:
        try:
            pd.to_datetime(df[c], errors="raise")
            return c
        except Exception:
            continue
    return None


def ensure_datetime(df: pd.DataFrame, date_col: str) -> pd.DataFrame:
    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
    return df


def make_time_features(df: pd.DataFrame, date_col: str) -> pd.DataFrame:
    df = df.copy()
    if date_col and date_col in df.columns:
        df["dayofweek"] = df[date_col].dt.dayofweek
        df["month"] = df[date_col].dt.month
        df["year"] = df[date_col].dt.year
    return df


def build_lag_rolling(
    df: pd.DataFrame,
    num_cols: list[str],
    group_cols: list[str],
    lags: list[int],
    rollings: list[int],
) -> pd.DataFrame:
    """Create lag features and rolling stats per group (e.g., per symbol if present)."""
    df = df.copy()
    # Choose grouping: Symbol if exists, else no grouping
    group_key = None
    for g in ["SYMBOL", "FIXED SYMBOL", "Symbol", "symbol", "Ticker", "ticker"]:
        if g in df.columns:
            group_key = g
            break

    def _group(df_):
        return df_.groupby(group_key) if group_key else [(None, df_)]

    for _, gdf in _group(df):
        idx = gdf.index
        for col in num_cols:
            s = df.loc[idx, col]
            for L in lags:
                df.loc[idx, f"{col}_lag{L}"] = s.shift(L)
            for W in rollings:
                r = s.rolling(W)
                df.loc[idx, f"{col}_roll{W}_mean"] = r.mean()
                df.loc[idx, f"{col}_roll{W}_std"] = r.std()
                df.loc[idx, f"{col}_roll{W}_min"] = r.min()
                df.loc[idx, f"{col}_roll{W}_max"] = r.max()
    return df


def train_models(
    X_train, y_train, X_val, y_val, feature_names: list[str]
) -> tuple[Pipeline, dict, pd.DataFrame]:
    results = []

    def evaluate(name: str, model: Pipeline):
        model.fit(X_train, y_train)
        pred = model.predict(X_val)
        mae = mean_absolute_error(y_val, pred)
        rmse = mean_squared_error(y_val, pred, squared=False)
        r2 = r2_score(y_val, pred)
        results.append({"model": name, "MAE": mae, "RMSE": rmse, "R2": r2})
        return mae, rmse, r2

    # Common preprocessor: numeric scaled for linear, cat one-hot
    numeric_features = X_train.select_dtypes(include=[np.number]).columns.tolist()
    categorical_features = [c for c in X_train.columns if c not in numeric_features]

    preproc_linear = ColumnTransformer(
        [
            ("num", StandardScaler(), numeric_features),
            ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_features),
        ]
    )

    preproc_tree = ColumnTransformer(
        [
            ("num", "passthrough", numeric_features),
            ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_features),
        ]
    )

    # 1) Linear Regression
    lin_pipe = Pipeline([("prep", preproc_linear), ("model", LinearRegression())])
    evaluate("LinearRegression", lin_pipe)

    # 2) Random Forest (with small grid)
    rf_base = Pipeline(
        [
            ("prep", preproc_tree),
            (
                "model",
                RandomForestRegressor(
                    random_state=42, n_estimators=300, max_depth=None
                ),
            ),
        ]
    )
    evaluate("RandomForest", rf_base)

    # 3) XGBoost (optional)
    best_xgb = None
    if HAS_XGB:
        xgb = Pipeline(
            [
                ("prep", preproc_tree),
                (
                    "model",
                    XGBRegressor(
                        random_state=42,
                        n_estimators=400,
                        max_depth=6,
                        learning_rate=0.05,
                        subsample=0.9,
                        colsample_bytree=0.9,
                        tree_method="hist",
                    ),
                ),
            ]
        )
        evaluate("XGBoost", xgb)
        best_xgb = xgb

    # Pick best by RMSE
    df_results = pd.DataFrame(results).sort_values("RMSE")
    best_name = df_results.iloc[0]["model"]
    best_model = (
        lin_pipe
        if best_name == "LinearRegression"
        else rf_base
        if best_name == "RandomForest"
        else best_xgb
    )

    # Refit best on combined train+val
    X_all = pd.concat([X_train, X_val], axis=0)
    y_all = pd.concat([y_train, y_val], axis=0)
    best_model.fit(X_all, y_all)

    # Feature importances when available
    feat_imp = None
    try:
        # Recover processed feature names for the tree encoder
        if best_name in ["RandomForest", "XGBoost"]:
            ct = best_model.named_steps["prep"]
            cat = ct.named_transformers_["cat"]
            num_cols = ct.transformers_[0][2]
            cat_cols = cat.get_feature_names_out(ct.transformers_[1][2]).tolist()
            full_cols = list(num_cols) + cat_cols
            model = best_model.named_steps["model"]
            if hasattr(model, "feature_importances_"):
                vals = model.feature_importances_
                feat_imp = pd.DataFrame(
                    {"feature": full_cols, "importance": vals}
                ).sort_values("importance", ascending=False)
    except Exception:
        pass

    return (
        best_model,
        {
            r["model"]: {k: float(r[k]) for k in ["MAE", "RMSE", "R2"]}
            for _, r in df_results.iterrows()
        },
        df_results,
    )


def main():
    args = parse_args()
    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(args.csv)

    # Determine/ensure date
    date_col = args.date_col or detect_date_column(df)
    if date_col:
        df = ensure_datetime(df, date_col)
        df = df.sort_values(date_col)
    else:
        # If no date, just use original order
        date_col = None

    # Target shift to next day
    if args.target_col not in df.columns:
        raise ValueError(f"Target column '{args.target_col}' not found in CSV.")
    df["target_next"] = df[args.target_col].shift(-1)

    # Exclude unwanted columns from base features
    exclude = set(
        [c for c in args.exclude if c in df.columns]
        + [c for c in args.id_cols if c in df.columns]
        + ["target_next"]
    )

    # Basic preprocessing: cast numerics, keep track of dtypes
    for c in df.columns:
        if c == date_col:
            continue
        if c not in exclude:
            df[c] = pd.to_numeric(df[c], errors="ignore")

    # Build time features
    if date_col:
        df = make_time_features(df, date_col)

    # Identify numeric columns for lag/rolling (exclude target and excluded)
    numeric_cols = [
        c
        for c in df.select_dtypes(include=[np.number]).columns
        if c not in exclude and c != "target_next"
    ]

    # Lag and rolling features
    df = build_lag_rolling(df, numeric_cols, [], args.lags, args.rollings)

    # Text signals -> simple one-hot (based on presence of keywords)
    text_cols = [c for c in df.columns if c not in exclude and df[c].dtype == "object"]
    KEYWORDS = ["hot", "present", "blast", "demand", "supply"]
    for c in text_cols:
        s = df[c].astype(str).str.lower()
        for kw in KEYWORDS:
            df[f"{c}__has_{kw}"] = s.str.contains(kw, regex=False)

    # Final feature set
    feature_cols = [
        c
        for c in df.columns
        if c not in exclude and c not in [args.target_col, "target_next"]
    ]

    # Drop rows with missing target_next
    df_model = df.dropna(subset=["target_next"]).copy()

    # Train/val split (time-aware)
    if date_col:
        n = len(df_model)
        split = int(n * (1 - args.test_size))
        train_df = df_model.iloc[:split]
        val_df = df_model.iloc[split:]
    else:
        n = len(df_model)
        split = int(n * (1 - args.test_size))
        train_df = df_model.iloc[:split]
        val_df = df_model.iloc[split:]

    X_train = train_df[feature_cols]
    y_train = train_df["target_next"]
    X_val = val_df[feature_cols]
    y_val = val_df["target_next"]

    best_model, metrics_map, df_results = train_models(
        X_train, y_train, X_val, y_val, feature_cols
    )

    # Save artifacts
    joblib.dump(best_model, outdir / "best_model.joblib")
    df_results.to_csv(outdir / "metrics.csv", index=False)

    report = {
        "csv": os.path.abspath(args.csv),
        "date_col": date_col,
        "target_col": args.target_col,
        "exclude": list(exclude),
        "lags": args.lags,
        "rollings": args.rollings,
        "test_size": args.test_size,
        "metrics": metrics_map,
        "best_model_path": str(outdir / "best_model.joblib"),
    }
    with open(outdir / "report.json", "w") as f:
        json.dump(report, f, indent=2)

    print(
        json.dumps(
            {
                "ok": True,
                "best_model": report["best_model_path"],
                "metrics": metrics_map,
            }
        )
    )


if __name__ == "__main__":
    main()
