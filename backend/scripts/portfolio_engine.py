#!/usr/bin/env python3
"""
FinAI Edge — Portfolio Optimization Engine (Production-Hardened)
================================================================
Architecture:
  - Decoupled from the web layer. Inputs/outputs are plain JSON.
  - Node.js spawns this script as a child process via portfolioService.js
  - All financial logic lives here. Node/frontend never touch math.

Resilience guarantees added in this version:
  - Ticker validation before yfinance calls
  - Graceful skip of invalid/unlisted symbols (partial optimization)
  - Empty dataset guards on every calculation path
  - Structured warnings returned to the frontend (not crashes)
  - Safe covariance, Sharpe, VaR, percentile, and Monte Carlo guards
  - Minimum viable return: even with 1 valid ticker, engine gives feedback

Future ML hooks:
  - get_returns_matrix() is the shared entry point for ML pipelines
  - Covariance matrix is reusable for RL reward functions
  - optimize_portfolio() is extensible for AI constraint optimization
"""

import json
import logging
import sys
import traceback
import warnings

import numpy as np
import pandas as pd
import yfinance as yf
from scipy.optimize import minimize

warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────────────────────────────────────
# Logging (to stderr — stdout is reserved for clean JSON output to Node.js)
# ─────────────────────────────────────────────────────────────────────────────
logging.basicConfig(
    stream=sys.stderr,
    level=logging.INFO,
    format="[Portfolio Engine] %(levelname)s: %(message)s",
)
log = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────
RISK_FREE_RATE = 0.065  # ~6.5% Indian 10Y treasury yield
TRADING_DAYS = 252
MONTE_CARLO_N = 3000  # portfolio simulations for frontier
MIN_ROWS = 60  # minimum trading days needed for reliable stats
MIN_ASSETS = 2  # minimum valid assets for optimization


# ─────────────────────────────────────────────────────────────────────────────
# Ticker Validation & Data Fetching
# ─────────────────────────────────────────────────────────────────────────────


def validate_ticker_format(ticker: str) -> bool:
    """
    Lightweight format check before making a network call.
    Accepts: TICKER.NS, TICKER.BO, AAPL, BTC-USD, etc.
    """
    ticker = ticker.strip()
    if not ticker or len(ticker) > 20:
        return False
    # Must be alphanumeric with optional dots and hyphens
    import re

    return bool(re.match(r"^[A-Za-z0-9][\w\.\-]{0,18}$", ticker))


def fetch_price_data(tickers: list, period: str = "2y") -> tuple:
    """
    Fetch adjusted close prices via yfinance with full fault tolerance.

    Returns:
        prices (pd.DataFrame): valid prices, only columns that succeeded
        failed (list): tickers that could not be fetched or had no data
        warnings (list): human-readable messages for the frontend
    """
    failed = []
    warns = []
    valid_tickers = []

    # Step 1: format validation — don't even call yfinance for garbage input
    for t in tickers:
        if validate_ticker_format(t):
            valid_tickers.append(t)
        else:
            failed.append(t)
            warns.append(f"'{t}' is not a valid ticker format and was skipped.")
            log.warning(f"Invalid ticker format: '{t}'")

    if not valid_tickers:
        return pd.DataFrame(), failed, warns

    # Step 2: bulk download
    log.info(f"Fetching data for: {valid_tickers}")
    try:
        raw = yf.download(
            valid_tickers, period=period, auto_adjust=True, progress=False, threads=True
        )
    except Exception as e:
        log.error(f"yfinance download failed: {e}")
        return pd.DataFrame(), tickers, [f"Market data fetch failed: {e!s}"]

    # Step 3: extract Close prices
    if raw.empty:
        return (
            pd.DataFrame(),
            valid_tickers,
            ["No market data returned. Check internet connection or ticker validity."],
        )

    if isinstance(raw.columns, pd.MultiIndex):
        prices = raw["Close"]
    else:
        # Single ticker returns flat columns
        prices = raw[["Close"]] if "Close" in raw.columns else raw
        if len(valid_tickers) == 1:
            prices.columns = valid_tickers

    prices = prices.copy()

    # Step 4: per-ticker data quality check
    dropped = []
    for t in valid_tickers:
        if t not in prices.columns:
            dropped.append(t)
            failed.append(t)
            warns.append(
                f"'{t}' returned no data from the exchange. It may be delisted or the symbol may be wrong."
            )
            log.warning(f"No data for ticker: {t}")
            continue

        col = prices[t].dropna()
        if len(col) < MIN_ROWS:
            dropped.append(t)
            failed.append(t)
            warns.append(
                f"'{t}' has only {len(col)} trading days of data "
                f"(minimum {MIN_ROWS} required). It was skipped."
            )
            log.warning(f"Insufficient data for {t}: {len(col)} rows")

    prices = prices.drop(
        columns=[c for c in dropped if c in prices.columns], errors="ignore"
    )
    prices = prices.dropna(how="all").ffill().bfill()

    if prices.empty or len(prices.columns) == 0:
        return (
            pd.DataFrame(),
            failed,
            warns + ["No tickers had sufficient historical data."],
        )

    return prices, failed, warns


def get_returns_matrix(prices: pd.DataFrame) -> pd.DataFrame:
    """
    Compute daily log returns.
    Log returns are preferred: time-additive, more normally distributed.
    This function is the shared ML pipeline entry point.
    """
    if prices.empty:
        return pd.DataFrame()
    returns = np.log(prices / prices.shift(1)).dropna()
    return returns


# ─────────────────────────────────────────────────────────────────────────────
# Safe Math Utilities
# ─────────────────────────────────────────────────────────────────────────────


def safe_cov_matrix(returns: pd.DataFrame) -> np.ndarray:
    """
    Compute annualized covariance matrix.
    Adds a small regularization term (Ledoit-Wolf style nudge) to prevent
    singular matrices when assets are highly correlated or data is sparse.
    """
    cov = returns.cov().values * TRADING_DAYS
    n = cov.shape[0]
    # Add tiny ridge to diagonal to ensure positive semi-definiteness
    cov += np.eye(n) * 1e-8
    return cov


def safe_sharpe(port_return: float, port_vol: float) -> float:
    if port_vol <= 0 or not np.isfinite(port_vol):
        return 0.0
    s = (port_return - RISK_FREE_RATE) / port_vol
    return round(float(s), 4) if np.isfinite(s) else 0.0


def safe_sqrt(val: float) -> float:
    if not np.isfinite(val) or val < 0:
        return 0.0
    return float(np.sqrt(val))


# ─────────────────────────────────────────────────────────────────────────────
# Core Portfolio Metrics
# ─────────────────────────────────────────────────────────────────────────────


def calculate_portfolio_metrics(
    returns: pd.DataFrame, weights: np.ndarray, cov: np.ndarray
):
    """
    Compute core portfolio statistics using Modern Portfolio Theory.
    Fully guarded against invalid/empty inputs.
    """
    if returns.empty or len(weights) == 0:
        return 0.0, 0.0, 0.0

    annual_returns = returns.mean().values * TRADING_DAYS
    port_return = float(np.dot(weights, annual_returns))
    port_var = float(np.dot(weights, np.dot(cov, weights)))
    port_vol = safe_sqrt(port_var)
    sharpe = safe_sharpe(port_return, port_vol)

    return port_return, port_vol, sharpe


def compute_individual_metrics(returns: pd.DataFrame) -> dict:
    """Per-ticker annualized return and volatility."""
    if returns.empty:
        return {}
    result = {}
    for ticker in returns.columns:
        col = returns[ticker].dropna()
        if len(col) == 0:
            continue
        ann_ret = float(col.mean() * TRADING_DAYS)
        ann_vol = float(col.std() * np.sqrt(TRADING_DAYS))
        result[ticker] = {
            "annualReturn": round(ann_ret, 4),
            "volatility": round(ann_vol, 4),
        }
    return result


def compute_correlation_matrix(returns: pd.DataFrame) -> dict:
    """Full correlation matrix as nested dict."""
    if returns.empty:
        return {}
    corr = returns.corr()
    result = {}
    for row in corr.index:
        result[row] = {}
        for col in corr.columns:
            val = corr.loc[row, col]
            result[row][col] = round(float(val), 4) if np.isfinite(val) else 0.0
    return result


def diversification_score(
    returns: pd.DataFrame, weights: np.ndarray, cov: np.ndarray
) -> float:
    """
    Diversification ratio: weighted avg volatility / portfolio volatility.
    Higher score = more diversified (lower inter-asset correlations).
    Returns 0–100.
    """
    if returns.empty or len(weights) == 0:
        return 0.0
    try:
        individual_vols = np.sqrt(np.maximum(np.diag(cov), 0))
        weighted_avg_vol = float(np.dot(weights, individual_vols))
        port_vol = safe_sqrt(float(np.dot(weights, np.dot(cov, weights))))
        if port_vol <= 0:
            return 0.0
        ratio = weighted_avg_vol / port_vol
        score = min((ratio - 1) / 1.5 * 100, 100)
        return round(float(max(score, 0)), 1)
    except Exception:
        return 0.0


# ─────────────────────────────────────────────────────────────────────────────
# Risk Analytics — VaR & Drawdown (Guarded)
# ─────────────────────────────────────────────────────────────────────────────


def compute_var_stats(returns: pd.DataFrame, weights: np.ndarray) -> dict:
    """
    Historical simulation VaR and Maximum Drawdown.
    Fully guarded against empty datasets.
    """
    default = {"var95": 0.0, "var99": 0.0, "maxDrawdown": 0.0}

    if returns.empty or len(weights) == 0:
        return default

    try:
        port_returns = returns.values @ weights
        port_returns = port_returns[np.isfinite(port_returns)]

        if len(port_returns) < 20:
            log.warning("Too few return observations for VaR calculation.")
            return default

        var_95 = float(np.percentile(port_returns, 5))
        var_99 = float(np.percentile(port_returns, 1))

        # Max drawdown on cumulative portfolio returns
        cum = np.cumprod(1 + port_returns)
        peak = np.maximum.accumulate(cum)
        dd = (cum - peak) / np.where(peak > 0, peak, 1)
        max_dd = float(np.min(dd))

        return {
            "var95": round(var_95, 5) if np.isfinite(var_95) else 0.0,
            "var99": round(var_99, 5) if np.isfinite(var_99) else 0.0,
            "maxDrawdown": round(max_dd, 5) if np.isfinite(max_dd) else 0.0,
        }
    except Exception as e:
        log.error(f"VaR computation failed: {e}")
        return default


# ─────────────────────────────────────────────────────────────────────────────
# Optimization Engine (MPT) — Guarded
# ─────────────────────────────────────────────────────────────────────────────


def _neg_sharpe(weights, annual_returns, cov):
    pr = float(np.dot(weights, annual_returns))
    pv = safe_sqrt(float(np.dot(weights, np.dot(cov, weights))))
    return -(pr - RISK_FREE_RATE) / pv if pv > 0 else 0.0


def _portfolio_vol(weights, cov):
    return safe_sqrt(float(np.dot(weights, np.dot(cov, weights))))


def _run_minimize(objective, init, args, bounds, constraints) -> np.ndarray:
    """Wrapper around scipy.minimize with fallback to equal weights."""
    try:
        result = minimize(
            objective,
            init,
            args=args,
            method="SLSQP",
            bounds=bounds,
            constraints=constraints,
            options={"maxiter": 1000, "ftol": 1e-9},
        )
        if result.success and np.all(np.isfinite(result.x)):
            return result.x
        log.warning(f"Optimization did not converge: {result.message}")
    except Exception as e:
        log.error(f"Optimization error: {e}")
    return init  # fallback to equal weights


def optimize_max_sharpe(
    annual_returns: np.ndarray, cov: np.ndarray, n: int
) -> np.ndarray:
    """Maximum Sharpe ratio portfolio via SciPy SLSQP."""
    init = np.array([1 / n] * n)
    bounds = tuple((0.05, 0.75) for _ in range(n))
    constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1}]
    return _run_minimize(_neg_sharpe, init, (annual_returns, cov), bounds, constraints)


def optimize_min_volatility(cov: np.ndarray, n: int) -> np.ndarray:
    """Minimum variance portfolio via SciPy SLSQP."""
    init = np.array([1 / n] * n)
    bounds = tuple((0.05, 0.75) for _ in range(n))
    constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1}]
    return _run_minimize(_portfolio_vol, init, (cov,), bounds, constraints)


def generate_efficient_frontier(
    annual_returns: np.ndarray, cov: np.ndarray, n: int
) -> list:
    """
    Monte Carlo frontier sampling.
    Guarded: skips any portfolio with non-finite risk/return.
    Returns list of {risk, return} dicts sorted by risk.
    """
    frontier = []
    for _ in range(MONTE_CARLO_N):
        try:
            w = np.random.dirichlet(np.ones(n))
            r = float(np.dot(w, annual_returns))
            v = safe_sqrt(float(np.dot(w, np.dot(cov, w))))
            if np.isfinite(r) and np.isfinite(v) and v > 0:
                frontier.append({"risk": round(v, 5), "return": round(r, 5)})
        except Exception:
            continue

    frontier.sort(key=lambda p: p["risk"])
    # Thin for chart performance: return ~750 points max
    step = max(1, len(frontier) // 750)
    return frontier[::step]


# ─────────────────────────────────────────────────────────────────────────────
# Main Entry Point
# ─────────────────────────────────────────────────────────────────────────────


def main():
    # ── Parse input ──────────────────────────────────────────────────────────
    try:
        payload = json.loads(sys.argv[1])
        tickers = payload["tickers"]
        raw_weights = payload["weights"]
        risk_profile = payload.get("riskProfile", "balanced")
    except (IndexError, KeyError, json.JSONDecodeError) as e:
        print(json.dumps({"error": f"Invalid input payload: {e!s}"}))
        sys.exit(1)

    all_warnings = []

    # ── Fetch & validate data ─────────────────────────────────────────────────
    prices, failed_tickers, fetch_warnings = fetch_price_data(tickers)
    all_warnings.extend(fetch_warnings)

    # Determine valid tickers (those that made it into the prices DataFrame)
    valid_tickers = [
        t for t in tickers if t in (prices.columns if not prices.empty else [])
    ]

    if len(valid_tickers) < MIN_ASSETS:
        # Not enough valid data to optimize — return a structured error
        msg = (
            f"Only {len(valid_tickers)} of {len(tickers)} tickers had sufficient data. "
            f"At least {MIN_ASSETS} valid assets are required for portfolio optimization."
        )
        if failed_tickers:
            msg += f" Failed: {', '.join(failed_tickers)}."
        print(
            json.dumps(
                {
                    "error": msg,
                    "warnings": all_warnings,
                    "failedTickers": failed_tickers,
                }
            )
        )
        sys.exit(1)

    if len(valid_tickers) < len(tickers):
        all_warnings.append(
            f"Optimization ran on {len(valid_tickers)} of {len(tickers)} assets. "
            f"Skipped: {', '.join(failed_tickers)}."
        )

    # ── Recalculate weights for the valid subset ──────────────────────────────
    valid_raw_w = {t: raw_weights.get(t, 1 / len(valid_tickers)) for t in valid_tickers}
    total_w = sum(valid_raw_w.values())
    weights = np.array([valid_raw_w[t] / total_w for t in valid_tickers], dtype=float)

    # ── Compute returns ───────────────────────────────────────────────────────
    returns = get_returns_matrix(prices[valid_tickers])

    if returns.empty or len(returns) < MIN_ROWS:
        print(
            json.dumps(
                {
                    "error": "Insufficient return history after data cleaning. Try different tickers or a longer period.",
                    "warnings": all_warnings,
                    "failedTickers": failed_tickers,
                }
            )
        )
        sys.exit(1)

    n = len(valid_tickers)
    annual_returns = returns.mean().values * TRADING_DAYS
    cov = safe_cov_matrix(returns)

    # ── Core portfolio metrics ────────────────────────────────────────────────
    port_return, port_vol, sharpe = calculate_portfolio_metrics(returns, weights, cov)

    # ── Optimization ─────────────────────────────────────────────────────────
    max_sharpe_w = optimize_max_sharpe(annual_returns, cov, n)
    min_vol_w = optimize_min_volatility(cov, n)

    ms_ret = float(np.dot(max_sharpe_w, annual_returns))
    ms_vol = safe_sqrt(float(np.dot(max_sharpe_w, np.dot(cov, max_sharpe_w))))

    mv_ret = float(np.dot(min_vol_w, annual_returns))
    mv_vol = safe_sqrt(float(np.dot(min_vol_w, np.dot(cov, min_vol_w))))

    # ── Efficient frontier ────────────────────────────────────────────────────
    frontier = generate_efficient_frontier(annual_returns, cov, n)
    if not frontier:
        all_warnings.append(
            "Efficient frontier generation produced no valid points. Monte Carlo may need more data."
        )

    # ── Build output ──────────────────────────────────────────────────────────
    output = {
        "success": True,
        "validTickers": valid_tickers,
        "failedTickers": failed_tickers,
        "warnings": all_warnings,
        "expectedReturn": round(port_return, 5),
        "volatility": round(port_vol, 5),
        "sharpeRatio": sharpe,
        "diversificationScore": diversification_score(returns, weights, cov),
        "correlationMatrix": compute_correlation_matrix(returns),
        "individualMetrics": compute_individual_metrics(returns),
        "efficientFrontier": frontier,
        "optimalPortfolio": {
            "return": round(ms_ret, 5),
            "risk": round(ms_vol, 5),
            "weights": {
                valid_tickers[i]: round(float(max_sharpe_w[i]), 4) for i in range(n)
            },
        },
        "minVolPortfolio": {
            "return": round(mv_ret, 5),
            "risk": round(mv_vol, 5),
            "weights": {
                valid_tickers[i]: round(float(min_vol_w[i]), 4) for i in range(n)
            },
        },
        "currentPortfolio": {
            "return": round(port_return, 5),
            "risk": round(port_vol, 5),
        },
        "varStats": compute_var_stats(returns, weights),
    }

    print(json.dumps(output))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        # Final safety net — never let the process die silently
        log.critical(f"Unhandled exception: {traceback.format_exc()}")
        print(json.dumps({"error": f"Internal engine error: {e!s}", "warnings": []}))
        sys.exit(1)
