"""
FinAI Edge — Rebalance Suggestion Engine
==========================================
Generate actionable rebalance suggestions based on drift analysis.
"""


def generate_rebalance_suggestions(
    current_weights: dict[str, float],
    target_weights: dict[str, float] | None = None,
    sector_exposure: list[dict] | None = None,
    drift_threshold: float = 5.0,
    health_data: dict | None = None,
) -> list[dict]:
    """
    Generate rebalance suggestions based on portfolio drift and risk analysis.

    Args:
        current_weights: { ticker: allocation_pct }
        target_weights: optional target { ticker: allocation_pct }, defaults to equal-weight
        sector_exposure: sector analysis data
        drift_threshold: % deviation that triggers a suggestion
        health_data: portfolio health analysis

    Returns:
        List of suggestions:
        [
            {
                "ticker": str,
                "action": "trim" | "add" | "remove" | "introduce",
                "current_pct": float,
                "target_pct": float,
                "delta_pct": float,
                "reason": str,
                "priority": "high" | "medium" | "low",
                "category": "concentration" | "sector" | "drift" | "risk"
            }
        ]
    """
    suggestions = []

    if not current_weights:
        return suggestions

    # Default to equal weight if no target provided
    n = len(current_weights)
    if not target_weights:
        equal_w = round(100 / n, 1) if n > 0 else 0
        target_weights = {t: equal_w for t in current_weights}

    # ── 1. Drift-based suggestions ──────────────────────────────────
    for ticker, current_pct in current_weights.items():
        target_pct = target_weights.get(ticker, 0)
        delta = current_pct - target_pct

        if abs(delta) >= drift_threshold:
            if delta > 0:
                suggestions.append(
                    {
                        "ticker": ticker,
                        "action": "trim",
                        "current_pct": round(current_pct, 1),
                        "target_pct": round(target_pct, 1),
                        "delta_pct": round(delta, 1),
                        "reason": (
                            f"{ticker} has drifted {delta:.1f}% above target allocation. "
                            f"Trim to rebalance towards {target_pct:.1f}%."
                        ),
                        "priority": "high" if delta > 10 else "medium",
                        "category": "drift",
                    }
                )
            else:
                suggestions.append(
                    {
                        "ticker": ticker,
                        "action": "add",
                        "current_pct": round(current_pct, 1),
                        "target_pct": round(target_pct, 1),
                        "delta_pct": round(delta, 1),
                        "reason": (
                            f"{ticker} is {abs(delta):.1f}% below target. "
                            f"Add to bring back to {target_pct:.1f}%."
                        ),
                        "priority": "high" if abs(delta) > 10 else "medium",
                        "category": "drift",
                    }
                )

    # ── 2. Concentration-based suggestions ──────────────────────────
    sorted_holdings = sorted(current_weights.items(), key=lambda x: x[1], reverse=True)

    if sorted_holdings and sorted_holdings[0][1] > 35:
        ticker, pct = sorted_holdings[0]
        # Only add if not already covered by drift
        if not any(
            s["ticker"] == ticker and s["category"] == "drift" for s in suggestions
        ):
            suggestions.append(
                {
                    "ticker": ticker,
                    "action": "trim",
                    "current_pct": round(pct, 1),
                    "target_pct": 30.0,
                    "delta_pct": round(pct - 30, 1),
                    "reason": (
                        f"{ticker} is at {pct:.1f}% — above the 35% concentration guardrail. "
                        f"Institutional risk desks flag this level."
                    ),
                    "priority": "high",
                    "category": "concentration",
                }
            )

    # ── 3. Sector-based suggestions ─────────────────────────────────
    if sector_exposure:
        for exp in sector_exposure:
            if exp["weight_pct"] > 50:
                suggestions.append(
                    {
                        "ticker": exp["sector"],
                        "action": "trim",
                        "current_pct": round(exp["weight_pct"], 1),
                        "target_pct": 35.0,
                        "delta_pct": round(exp["weight_pct"] - 35, 1),
                        "reason": (
                            f"{exp['sector']} sector is {exp['weight_pct']:.1f}% of portfolio. "
                            f"Add stocks from uncorrelated sectors to reduce cluster risk."
                        ),
                        "priority": "high",
                        "category": "sector",
                    }
                )

        # Suggest defensive if missing
        sector_names = {exp["sector"] for exp in sector_exposure}
        defensive_present = sector_names & {"FMCG", "Pharma", "Finance"}
        if not defensive_present and len(sector_exposure) >= 2:
            suggestions.append(
                {
                    "ticker": "FMCG/Pharma",
                    "action": "introduce",
                    "current_pct": 0,
                    "target_pct": 15.0,
                    "delta_pct": -15.0,
                    "reason": (
                        "No defensive sector exposure (FMCG, Pharma). "
                        "Consider adding a stabilizer to reduce downside risk."
                    ),
                    "priority": "medium",
                    "category": "sector",
                }
            )

    # ── 4. Health-based suggestions ─────────────────────────────────
    if (
        health_data
        and health_data.get("score", 100) < 50
        and health_data["breakdown"]["diversification"] < 40
    ):
        suggestions.append(
            {
                "ticker": "Portfolio",
                "action": "add",
                "current_pct": 0,
                "target_pct": 0,
                "delta_pct": 0,
                "reason": (
                    f"Diversification score is {health_data['breakdown']['diversification']:.0f}/100. "
                    f"Add stocks from different sectors to reduce correlated risk."
                ),
                "priority": "high",
                "category": "risk",
            }
        )

    # Sort by priority
    priority_order = {"high": 0, "medium": 1, "low": 2}
    suggestions.sort(key=lambda s: priority_order.get(s["priority"], 2))

    return suggestions
