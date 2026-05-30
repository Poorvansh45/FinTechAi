"""
FinAI Edge — Sector Analysis Engine
=====================================
Sector exposure, concentration, and bias detection.
"""

from typing import Optional
from utils.helpers import (
    get_sector_for_ticker,
    DEFENSIVE_SECTORS,
    AGGRESSIVE_SECTORS,
    safe_divide,
)


def compute_sector_exposure(
    holdings: list[dict],
) -> list[dict]:
    """
    Compute sector-wise allocation breakdown.

    Args:
        holdings: List of dicts with keys: ticker, value (current market value)

    Returns:
        Sorted list of { sector, value, weight_pct, stock_count, tickers }
    """
    sector_map: dict[str, dict] = {}
    total_value = sum(h.get("value", 0) for h in holdings)

    if total_value <= 0:
        return []

    for h in holdings:
        ticker = h.get("ticker", "")
        value = h.get("value", 0)
        sector = h.get("sector") or get_sector_for_ticker(ticker)

        if sector not in sector_map:
            sector_map[sector] = {"sector": sector, "value": 0, "tickers": [], "stock_count": 0}

        sector_map[sector]["value"] += value
        sector_map[sector]["tickers"].append(ticker)
        sector_map[sector]["stock_count"] += 1

    result = []
    for sector, data in sector_map.items():
        result.append({
            "sector": sector,
            "value": round(data["value"], 2),
            "weight_pct": round(data["value"] / total_value * 100, 1),
            "stock_count": data["stock_count"],
            "tickers": data["tickers"],
        })

    result.sort(key=lambda x: x["weight_pct"], reverse=True)
    return result


def compute_sector_concentration(sector_exposure: list[dict]) -> dict:
    """
    Evaluate sector concentration risk.

    Returns:
        {
            "top_sector": str,
            "top_sector_pct": float,
            "sector_count": int,
            "concentration_level": "low" | "moderate" | "high",
            "score": int (0-100, higher = more balanced),
            "warnings": list[str]
        }
    """
    if not sector_exposure:
        return {
            "top_sector": "N/A",
            "top_sector_pct": 0,
            "sector_count": 0,
            "concentration_level": "high",
            "score": 0,
            "warnings": ["No sector data available"],
        }

    top = sector_exposure[0]
    sector_count = len(sector_exposure)
    warnings = []

    # Scoring logic
    # Ideal: top sector < 30%, 5+ sectors
    top_pct = top["weight_pct"]

    # Penalize heavy concentration in one sector
    sector_penalty = max(0, (top_pct - 25) * 1.8)

    # Reward sector diversity
    diversity_bonus = min(20, sector_count * 4)

    score = max(0, min(100, round(80 - sector_penalty + diversity_bonus)))

    # Generate warnings
    if top_pct > 50:
        warnings.append(
            f"{top['sector']} dominates at {top_pct:.1f}%. "
            f"This creates earnings-cycle and regulatory concentration risk."
        )
    elif top_pct > 35:
        warnings.append(
            f"{top['sector']} is {top_pct:.1f}% of portfolio. "
            f"Consider pairing with uncorrelated sectors."
        )

    if sector_count < 3:
        warnings.append(
            f"Only {sector_count} active sector{'s' if sector_count != 1 else ''}. "
            f"Add 1–2 defensive sectors to reduce drawdown clustering."
        )

    level = "low" if score >= 65 else "moderate" if score >= 40 else "high"

    return {
        "top_sector": top["sector"],
        "top_sector_pct": round(top_pct, 1),
        "sector_count": sector_count,
        "concentration_level": level,
        "score": score,
        "warnings": warnings,
    }


def detect_sector_bias(sector_exposure: list[dict]) -> dict:
    """
    Detect aggressive vs defensive tilt in portfolio.

    Returns:
        {
            "defensive_weight": float (0-100),
            "aggressive_weight": float (0-100),
            "neutral_weight": float (0-100),
            "bias": "defensive" | "balanced" | "aggressive",
            "recommendation": str
        }
    """
    defensive_w = 0.0
    aggressive_w = 0.0
    neutral_w = 0.0

    for exp in sector_exposure:
        sector = exp["sector"]
        pct = exp["weight_pct"]

        if sector in DEFENSIVE_SECTORS:
            defensive_w += pct
        elif sector in AGGRESSIVE_SECTORS:
            aggressive_w += pct
        else:
            neutral_w += pct

    # Determine bias
    if aggressive_w > 60:
        bias = "aggressive"
        recommendation = (
            "Portfolio has a strong growth tilt. If your horizon is below 5 years, "
            "consider adding FMCG, Pharma, or Insurance stocks as stabilizers."
        )
    elif defensive_w > 55:
        bias = "defensive"
        recommendation = (
            "Portfolio is heavily defensive. This protects capital but may cap upside. "
            "Consider selective IT or Auto exposure for growth."
        )
    else:
        bias = "balanced"
        recommendation = (
            "Good balance between growth and stability sectors. "
            "Rebalance quarterly to maintain this profile."
        )

    return {
        "defensive_weight": round(defensive_w, 1),
        "aggressive_weight": round(aggressive_w, 1),
        "neutral_weight": round(neutral_w, 1),
        "bias": bias,
        "recommendation": recommendation,
    }
