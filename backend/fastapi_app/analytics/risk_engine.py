"""
FinAI Edge — Risk Analytics Engine
====================================
Portfolio risk metrics: volatility, VaR, max drawdown, beta, risk level.
"""

import numpy as np
import pandas as pd
from typing import Optional
from utils.helpers import safe_sqrt, safe_divide

TRADING_DAYS = 252
RISK_FREE_RATE = 0.065  # Indian 10Y treasury yield


def compute_portfolio_volatility(
    weights: np.ndarray,
    cov_matrix: np.ndarray,
) -> float:
    """
    Annualized portfolio volatility from covariance matrix.

    Returns: annualized volatility as decimal (e.g., 0.22 = 22%).
    """
    if len(weights) == 0 or cov_matrix.size == 0:
        return 0.0

    port_var = float(np.dot(weights, np.dot(cov_matrix, weights)))
    return safe_sqrt(port_var)


def compute_portfolio_return(
    weights: np.ndarray,
    returns: pd.DataFrame,
) -> float:
    """
    Annualized expected portfolio return.

    Returns: annualized return as decimal.
    """
    if returns.empty or len(weights) == 0:
        return 0.0

    annual_returns = returns.mean().values * TRADING_DAYS
    return float(np.dot(weights, annual_returns))


def compute_sharpe_ratio(
    port_return: float,
    port_volatility: float,
    risk_free_rate: float = RISK_FREE_RATE,
) -> float:
    """
    Sharpe ratio: (return - risk_free) / volatility.
    """
    if port_volatility <= 0 or not np.isfinite(port_volatility):
        return 0.0

    sharpe = (port_return - risk_free_rate) / port_volatility
    return round(float(sharpe), 4) if np.isfinite(sharpe) else 0.0


def compute_var(
    returns: pd.DataFrame,
    weights: np.ndarray,
    confidence_95: bool = True,
    confidence_99: bool = True,
) -> dict:
    """
    Historical Value-at-Risk using portfolio daily returns.

    Returns:
        {
            "var_95": float (daily VaR at 95% confidence),
            "var_99": float (daily VaR at 99% confidence),
            "var_95_annual": float (annualized),
            "var_99_annual": float (annualized)
        }
    """
    default = {"var_95": 0.0, "var_99": 0.0, "var_95_annual": 0.0, "var_99_annual": 0.0}

    if returns.empty or len(weights) == 0:
        return default

    try:
        port_returns = returns.values @ weights
        port_returns = port_returns[np.isfinite(port_returns)]

        if len(port_returns) < 20:
            return default

        result = {}
        if confidence_95:
            var_95 = float(np.percentile(port_returns, 5))
            result["var_95"] = round(var_95, 5)
            result["var_95_annual"] = round(var_95 * np.sqrt(TRADING_DAYS), 5)
        if confidence_99:
            var_99 = float(np.percentile(port_returns, 1))
            result["var_99"] = round(var_99, 5)
            result["var_99_annual"] = round(var_99 * np.sqrt(TRADING_DAYS), 5)

        return result
    except Exception:
        return default


def compute_max_drawdown(
    returns: pd.DataFrame,
    weights: np.ndarray,
) -> float:
    """
    Maximum peak-to-trough drawdown on cumulative portfolio returns.

    Returns: max drawdown as negative decimal (e.g., -0.15 = 15% drawdown).
    """
    if returns.empty or len(weights) == 0:
        return 0.0

    try:
        port_returns = returns.values @ weights
        port_returns = port_returns[np.isfinite(port_returns)]

        if len(port_returns) < 10:
            return 0.0

        cum = np.cumprod(1 + port_returns)
        peak = np.maximum.accumulate(cum)
        drawdown = (cum - peak) / np.where(peak > 0, peak, 1)
        max_dd = float(np.min(drawdown))

        return round(max_dd, 5) if np.isfinite(max_dd) else 0.0
    except Exception:
        return 0.0


def compute_beta(
    portfolio_returns: np.ndarray,
    benchmark_returns: np.ndarray,
) -> float:
    """
    Portfolio beta relative to a benchmark (e.g., Nifty 50).
    Beta > 1: more volatile than market.
    Beta < 1: less volatile than market.
    """
    if len(portfolio_returns) < 20 or len(benchmark_returns) < 20:
        return 1.0

    try:
        # Align lengths
        n = min(len(portfolio_returns), len(benchmark_returns))
        pr = portfolio_returns[-n:]
        br = benchmark_returns[-n:]

        covariance = np.cov(pr, br)[0, 1]
        benchmark_var = np.var(br)

        if benchmark_var <= 0:
            return 1.0

        beta = covariance / benchmark_var
        return round(float(beta), 3) if np.isfinite(beta) else 1.0
    except Exception:
        return 1.0


def estimate_risk_level(
    volatility: float,
    concentration_score: float,
    sector_concentration: float,
    max_drawdown: float = 0.0,
) -> dict:
    """
    Composite risk level estimation.

    Args:
        volatility: annualized portfolio volatility
        concentration_score: 0-100 (100 = most concentrated)
        sector_concentration: top sector weight %
        max_drawdown: max drawdown as decimal

    Returns:
        {
            "level": "Low" | "Moderate" | "Elevated" | "High",
            "score": int (0-100, higher = riskier),
            "color": str (hex color for UI),
            "factors": list[str]
        }
    """
    factors = []
    risk_score = 0

    # Volatility contribution (0-35 points)
    vol_pct = volatility * 100
    if vol_pct > 30:
        risk_score += 35
        factors.append(f"High volatility ({vol_pct:.1f}% annualized)")
    elif vol_pct > 20:
        risk_score += 22
        factors.append(f"Moderate volatility ({vol_pct:.1f}%)")
    elif vol_pct > 12:
        risk_score += 12

    # Concentration contribution (0-30 points)
    if concentration_score > 70:
        risk_score += 30
        factors.append("Highly concentrated portfolio")
    elif concentration_score > 45:
        risk_score += 18
        factors.append("Moderate stock concentration")
    elif concentration_score > 20:
        risk_score += 8

    # Sector concentration (0-20 points)
    if sector_concentration > 50:
        risk_score += 20
        factors.append(f"Dominant sector exposure ({sector_concentration:.0f}%)")
    elif sector_concentration > 35:
        risk_score += 12
    elif sector_concentration > 25:
        risk_score += 5

    # Max drawdown (0-15 points)
    dd_pct = abs(max_drawdown) * 100
    if dd_pct > 25:
        risk_score += 15
        factors.append(f"Significant historical drawdown ({dd_pct:.1f}%)")
    elif dd_pct > 15:
        risk_score += 8

    risk_score = min(100, risk_score)

    if risk_score >= 70:
        level, color = "High", "#ef4444"
    elif risk_score >= 50:
        level, color = "Elevated", "#f59e0b"
    elif risk_score >= 30:
        level, color = "Moderate", "#6366f1"
    else:
        level, color = "Low", "#22c55e"

    return {
        "level": level,
        "score": risk_score,
        "color": color,
        "factors": factors,
    }


def compute_safe_covariance(returns: pd.DataFrame) -> np.ndarray:
    """
    Compute annualized covariance matrix with Ledoit-Wolf regularization.
    Prevents singular matrices in optimization.
    """
    if returns.empty:
        return np.array([])

    cov = returns.cov().values * TRADING_DAYS
    n = cov.shape[0]
    # Add small ridge for numerical stability
    cov += np.eye(n) * 1e-8
    return cov


def compute_correlation_matrix(returns: pd.DataFrame) -> dict:
    """Pearson correlation matrix as nested dict."""
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


def compute_sortino_ratio(
    returns: pd.DataFrame,
    weights: np.ndarray,
    risk_free_rate: float = RISK_FREE_RATE,
) -> float:
    """
    Sortino ratio: (return - risk_free) / downside_deviation.
    Only penalizes downside volatility, not upside.
    """
    if returns.empty or len(weights) == 0:
        return 0.0

    try:
        port_returns = returns.values @ weights
        port_returns = port_returns[np.isfinite(port_returns)]

        if len(port_returns) < 20:
            return 0.0

        annual_return = float(np.mean(port_returns)) * TRADING_DAYS
        daily_rf = risk_free_rate / TRADING_DAYS

        # Only consider negative excess returns
        downside_returns = port_returns[port_returns < daily_rf] - daily_rf
        if len(downside_returns) == 0:
            return 3.0  # No downside → excellent

        downside_dev = float(np.sqrt(np.mean(downside_returns ** 2))) * np.sqrt(TRADING_DAYS)

        if downside_dev <= 0:
            return 3.0

        sortino = (annual_return - risk_free_rate) / downside_dev
        return round(float(sortino), 4) if np.isfinite(sortino) else 0.0
    except Exception:
        return 0.0


def compute_treynor_ratio(
    port_return: float,
    beta: float,
    risk_free_rate: float = RISK_FREE_RATE,
) -> float:
    """
    Treynor ratio: (return - risk_free) / beta.
    Measures return per unit of systematic risk.
    """
    if beta <= 0 or not np.isfinite(beta):
        return 0.0

    treynor = (port_return - risk_free_rate) / beta
    return round(float(treynor), 4) if np.isfinite(treynor) else 0.0


def compute_cagr_from_prices(prices: pd.Series) -> float:
    """
    Compound Annual Growth Rate from a price series.

    Args:
        prices: pandas Series of prices with datetime index

    Returns:
        CAGR as decimal (e.g., 0.15 = 15%)
    """
    if prices.empty or len(prices) < 2:
        return 0.0

    try:
        # Clean: remove NaN, zero, negative
        clean = prices.dropna()
        clean = clean[clean > 0]

        if len(clean) < 2:
            return 0.0

        start_val = float(clean.iloc[0])
        end_val = float(clean.iloc[-1])

        if start_val <= 0 or end_val <= 0:
            return 0.0

        # Calculate years from date range
        if hasattr(clean.index, 'to_pydatetime'):
            date_range = (clean.index[-1] - clean.index[0]).days
        else:
            date_range = len(clean)  # Fallback: assume daily data

        years = max(date_range / 365.25, 0.1)  # At least ~1 month

        cagr = (end_val / start_val) ** (1 / years) - 1
        return round(float(cagr), 5) if np.isfinite(cagr) else 0.0
    except Exception:
        return 0.0
