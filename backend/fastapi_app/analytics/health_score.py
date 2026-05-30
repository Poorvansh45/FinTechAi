"""
FinAI Edge — Portfolio Health Score
=====================================
Weighted composite score combining diversification, risk, concentration, and sector balance.
"""


def compute_portfolio_health(
    diversification_score: float,
    risk_score: float,
    concentration_score: float,
    sector_balance_score: float,
    stock_count: int = 0,
) -> dict:
    """
    Compute composite portfolio health score.

    Weights:
        - Diversification:   30%
        - Risk management:   25%
        - Concentration:     25%
        - Sector balance:    20%

    Bonus: small reward for having 5+ stocks.

    Args:
        diversification_score: 0-100 (from diversification ratio)
        risk_score: 0-100 (from risk engine, INVERTED: lower risk = higher score)
        concentration_score: 0-100 (from concentration analysis, higher = less concentrated)
        sector_balance_score: 0-100 (from sector concentration)
        stock_count: number of distinct holdings

    Returns:
        {
            "score": int (0-100),
            "label": "Strong" | "Moderate" | "Review",
            "color": str (hex color),
            "breakdown": {
                "diversification": float,
                "risk_management": float,
                "concentration": float,
                "sector_balance": float,
            },
            "summary": str
        }
    """
    # Invert risk score: higher risk_score means riskier,
    # but for health we want lower risk = higher health
    risk_health = max(0, 100 - risk_score)

    # Weighted composite
    raw_score = (
        diversification_score * 0.30
        + risk_health * 0.25
        + concentration_score * 0.25
        + sector_balance_score * 0.20
    )

    # Small bonus for stock count diversity
    count_bonus = min(10, stock_count * 2) if stock_count >= 3 else 0
    score = max(0, min(100, round(raw_score + count_bonus)))

    # Labels & colors
    if score >= 75:
        label = "Strong"
        color = "#22c55e"
        summary = (
            f"Portfolio health score of {score}/100 is strong. "
            f"Good diversification, manageable risk, and balanced sector exposure. "
            f"Rebalance quarterly to maintain this profile."
        )
    elif score >= 58:
        label = "Moderate"
        color = "#f59e0b"
        summary = (
            f"Portfolio health score of {score}/100 is moderate. "
            f"Review concentration risk and sector balance. "
            f"Consider adding defensive holdings to improve stability."
        )
    else:
        label = "Review"
        color = "#ef4444"
        summary = (
            f"Portfolio health score of {score}/100 needs attention. "
            f"High concentration or sector imbalance detected. "
            f"Diversify across more sectors and reduce single-stock risk."
        )

    return {
        "score": score,
        "label": label,
        "color": color,
        "breakdown": {
            "diversification": round(diversification_score, 1),
            "risk_management": round(risk_health, 1),
            "concentration": round(concentration_score, 1),
            "sector_balance": round(sector_balance_score, 1),
        },
        "summary": summary,
    }
