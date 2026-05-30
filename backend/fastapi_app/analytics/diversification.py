"""
FinAI Edge — Diversification Analytics
========================================
Compute diversification metrics for portfolio analysis.
"""

import numpy as np
from typing import Optional
from utils.helpers import safe_sqrt, safe_divide


def compute_diversification_score(
    weights: np.ndarray,
    cov_matrix: np.ndarray,
) -> float:
    """
    Diversification ratio: weighted-average volatility / portfolio volatility.
    Higher score = more diversified (lower inter-asset correlations).

    Returns: 0–100 score.
    """
    if len(weights) == 0 or cov_matrix.size == 0:
        return 0.0

    try:
        individual_vols = np.sqrt(np.maximum(np.diag(cov_matrix), 0))
        weighted_avg_vol = float(np.dot(weights, individual_vols))
        port_vol = safe_sqrt(float(np.dot(weights, np.dot(cov_matrix, weights))))

        if port_vol <= 0:
            return 0.0

        ratio = weighted_avg_vol / port_vol
        # Scale: ratio of 1.0 = 0%, 2.5+ = 100%
        score = min((ratio - 1) / 1.5 * 100, 100)
        return round(float(max(score, 0)), 1)
    except Exception:
        return 0.0


def compute_herfindahl_index(allocations: list[float]) -> float:
    """
    Herfindahl-Hirschman Index (HHI) for concentration measurement.
    HHI ranges from 1/n (perfectly diversified) to 1 (single stock).
    Returns 0-100 where 100 = maximally concentrated.
    """
    if not allocations:
        return 100.0

    # Normalize to fractions
    total = sum(allocations)
    if total <= 0:
        return 100.0

    fractions = [a / total for a in allocations]
    hhi = sum(f ** 2 for f in fractions)

    # Scale: 1/n (best) to 1 (worst) -> 0 to 100
    n = len(fractions)
    min_hhi = 1.0 / n if n > 0 else 1.0
    normalized = safe_divide(hhi - min_hhi, 1.0 - min_hhi, default=1.0)
    return round(normalized * 100, 1)


def compute_effective_number_of_stocks(allocations: list[float]) -> float:
    """
    Effective number of stocks (inverse HHI).
    If you had N equal-weight stocks, this returns N.
    Concentrated portfolios return values much lower than actual count.
    """
    if not allocations:
        return 0.0

    total = sum(allocations)
    if total <= 0:
        return 0.0

    fractions = [a / total for a in allocations]
    hhi = sum(f ** 2 for f in fractions)

    if hhi <= 0:
        return 0.0

    return round(1.0 / hhi, 1)


def compute_concentration_score(allocations: list[float]) -> dict:
    """
    Comprehensive concentration analysis.

    Returns:
        {
            "hhi": float (0-100, lower = better),
            "effective_stocks": float,
            "top_holding_pct": float,
            "top3_holding_pct": float,
            "concentration_level": "low" | "moderate" | "high",
            "score": int (0-100, higher = better / less concentrated)
        }
    """
    if not allocations:
        return {
            "hhi": 100.0,
            "effective_stocks": 0,
            "top_holding_pct": 0,
            "top3_holding_pct": 0,
            "concentration_level": "high",
            "score": 0,
        }

    total = sum(allocations)
    pcts = sorted([a / total * 100 for a in allocations], reverse=True)

    hhi = compute_herfindahl_index(allocations)
    effective = compute_effective_number_of_stocks(allocations)
    top1 = pcts[0] if pcts else 0
    top3 = sum(pcts[:3])

    # Score: penalize high concentration
    # Top holding > 35% = aggressive penalty
    top_penalty = max(0, (top1 - 25) * 2.2)
    hhi_penalty = hhi * 0.4
    score = max(0, min(100, round(100 - top_penalty - hhi_penalty)))

    level = "low" if score >= 70 else "moderate" if score >= 45 else "high"

    return {
        "hhi": round(hhi, 1),
        "effective_stocks": effective,
        "top_holding_pct": round(top1, 1),
        "top3_holding_pct": round(top3, 1),
        "concentration_level": level,
        "score": score,
    }
