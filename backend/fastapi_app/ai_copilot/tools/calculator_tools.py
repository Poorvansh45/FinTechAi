"""
Financial planning calculators — pure, deterministic math.

Standard formulas (monthly SIP future value, lump-sum compounding, goal-based
required SIP) plus a simple risk-profile mapper. No external calls, no LLM — easy
to unit-test and safe to trust. These mirror the SIP projection already used in
`api/ai.py` but are exposed as reusable tools.
"""

from __future__ import annotations

from langchain_core.tools import tool


def _sip_future_value(monthly: float, annual_rate_pct: float, years: float) -> float:
    """FV of a monthly SIP (contribution at end of each month)."""
    i = (annual_rate_pct / 100.0) / 12.0
    n = int(round(years * 12))
    if n <= 0:
        return 0.0
    if i == 0:
        return monthly * n
    return monthly * (((1 + i) ** n - 1) / i)


@tool
def sip_calculator(monthly_investment: float, annual_return_pct: float, years: float) -> str:
    """Project the future value of a monthly SIP given a monthly amount, an assumed
    annual return %, and a horizon in years. Always frame the return as an assumption,
    not a guarantee."""
    if monthly_investment <= 0 or years <= 0:
        return "Provide a positive monthly amount and horizon."
    fv = _sip_future_value(monthly_investment, annual_return_pct, years)
    invested = monthly_investment * int(round(years * 12))
    gain = fv - invested
    return (
        f"Investing ₹{monthly_investment:,.0f}/month for {years:g} years at an ASSUMED "
        f"{annual_return_pct:g}% annual return: projected ₹{fv:,.0f} "
        f"(invested ₹{invested:,.0f}, growth ₹{gain:,.0f}). "
        f"Actual returns vary and are not guaranteed."
    )


@tool
def compound_interest(principal: float, annual_rate_pct: float, years: float, compounds_per_year: int = 1) -> str:
    """Future value of a one-time lump sum under compound interest. Use for 'if I invest
    ₹X once for Y years' questions."""
    if principal <= 0 or years <= 0:
        return "Provide a positive principal and horizon."
    r = annual_rate_pct / 100.0
    m = max(1, compounds_per_year)
    fv = principal * (1 + r / m) ** (m * years)
    return (
        f"₹{principal:,.0f} at an ASSUMED {annual_rate_pct:g}% for {years:g} years "
        f"(compounded {m}x/year) → ₹{fv:,.0f}. Returns are not guaranteed."
    )


@tool
def future_value(target_amount: float, annual_return_pct: float, years: float) -> str:
    """Given a financial GOAL (target amount), an assumed annual return %, and a horizon,
    compute the monthly SIP required to reach it. Use for 'I want ₹1 crore in 15 years'."""
    if target_amount <= 0 or years <= 0:
        return "Provide a positive target amount and horizon."
    i = (annual_return_pct / 100.0) / 12.0
    n = int(round(years * 12))
    if i == 0:
        monthly = target_amount / n
    else:
        monthly = target_amount * i / ((1 + i) ** n - 1)
    return (
        f"To reach ₹{target_amount:,.0f} in {years:g} years at an ASSUMED "
        f"{annual_return_pct:g}% annual return, invest about ₹{monthly:,.0f}/month. "
        f"This is an estimate — markets fluctuate and returns are not guaranteed."
    )


@tool
def risk_profile_mapper(horizon_years: float, comfort_with_loss: str) -> str:
    """Map a time horizon (years) and stated comfort with short-term loss
    ('low'/'medium'/'high') to a suggested risk profile (conservative/balanced/aggressive)
    and a typical equity-debt split. Educational guidance, not personalised advice."""
    comfort = (comfort_with_loss or "").strip().lower()
    if horizon_years >= 7 and comfort in {"high", "medium"}:
        profile, split = "aggressive", "70-80% equity / 20-30% debt"
    elif horizon_years >= 3 and comfort != "low":
        profile, split = "balanced", "50-60% equity / 40-50% debt"
    else:
        profile, split = "conservative", "20-40% equity / 60-80% debt"
    return (
        f"Suggested risk profile: {profile} (typical split {split}). "
        f"Based on a {horizon_years:g}-year horizon and '{comfort or 'unspecified'}' loss tolerance. "
        f"This is general education, not personalised financial advice."
    )


CALCULATOR_TOOLS = [sip_calculator, compound_interest, future_value, risk_profile_mapper]
