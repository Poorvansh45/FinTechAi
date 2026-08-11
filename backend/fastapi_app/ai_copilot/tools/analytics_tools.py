"""
Analytics tools — pure quantitative helpers.

These operate on explicit numeric inputs the agent already has (no external data
fetch), so they are deterministic and cheap. CAGR reuses the existing Phase 1
`portfolio.calculator.compute_cagr`; volatility/Sharpe mirror the conventions in
`analytics.risk_engine` (252 trading days, decimal risk-free rate).
"""

from __future__ import annotations

import math

from langchain_core.tools import tool

TRADING_DAYS = 252


@tool
def calculate_cagr(start_value: float, end_value: float, years: float) -> str:
    """Compound Annual Growth Rate (%) from a start value, end value, and number of
    years. Use to explain long-term growth rate of an investment."""
    from portfolio.calculator import compute_cagr

    if years <= 0 or start_value <= 0:
        return "CAGR needs a positive start value and a positive number of years."
    cagr = compute_cagr(start_value, end_value, years)
    return f"CAGR over {years:g} years: {cagr:.2f}% (from ₹{start_value:,.0f} to ₹{end_value:,.0f})."


@tool
def calculate_volatility(daily_returns: list[float]) -> str:
    """Annualised volatility (%) from a list of DAILY returns expressed as decimals
    (e.g. 0.01 for +1%). Higher volatility means larger swings and higher risk."""
    if not daily_returns or len(daily_returns) < 2:
        return "Need at least two daily returns to estimate volatility."
    n = len(daily_returns)
    mean = sum(daily_returns) / n
    variance = sum((r - mean) ** 2 for r in daily_returns) / (n - 1)
    daily_vol = math.sqrt(variance)
    annual_vol = daily_vol * math.sqrt(TRADING_DAYS) * 100
    return f"Annualised volatility: {annual_vol:.2f}% (from {n} daily returns)."


@tool
def calculate_risk(
    annual_return_pct: float, annual_volatility_pct: float, risk_free_pct: float = 6.5
) -> str:
    """Sharpe ratio and a plain-language risk read from an annual return %, annual
    volatility %, and a risk-free rate % (default 6.5% ~ Indian 10Y). Use to explain
    whether returns justify the risk taken."""
    if annual_volatility_pct <= 0:
        return "Volatility must be positive to compute a Sharpe ratio."
    sharpe = (annual_return_pct - risk_free_pct) / annual_volatility_pct
    if sharpe >= 1:
        verdict = "strong risk-adjusted returns"
    elif sharpe >= 0.5:
        verdict = "reasonable risk-adjusted returns"
    elif sharpe >= 0:
        verdict = "weak risk-adjusted returns — the extra risk is barely rewarded"
    else:
        verdict = "returns below the risk-free rate — the risk is not being rewarded"
    return (
        f"Sharpe ratio: {sharpe:.2f} ({verdict}). "
        f"Return {annual_return_pct:.1f}% vs volatility {annual_volatility_pct:.1f}% "
        f"over a {risk_free_pct:.1f}% risk-free rate."
    )


ANALYTICS_TOOLS = [calculate_cagr, calculate_volatility, calculate_risk]
