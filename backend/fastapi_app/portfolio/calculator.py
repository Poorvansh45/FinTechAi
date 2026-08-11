"""
FinAI Edge — Portfolio Calculator
===================================
Holdings P&L, allocation, and aggregate computations.
Moves client-side calculations to the server.
"""

from utils.helpers import get_sector_for_ticker, pct_change, safe_divide


def compute_cagr(
    start_value: float,
    end_value: float,
    years: float,
) -> float:
    """
    Compound Annual Growth Rate.

    Args:
        start_value: starting portfolio/investment value
        end_value: current/ending value
        years: time period in years

    Returns:
        CAGR as percentage (e.g., 15.2)
    """
    if start_value <= 0 or end_value <= 0 or years <= 0:
        return 0.0
    cagr = ((end_value / start_value) ** (1 / years) - 1) * 100
    return round(cagr, 2)


def compute_daily_pnl(
    current_price: float,
    prev_close: float,
    quantity: float,
) -> tuple[float, float]:
    """
    Compute daily P&L for a holding.

    Returns:
        (daily_pnl_amount, daily_pnl_pct)
    """
    if prev_close <= 0 or quantity <= 0:
        return 0.0, 0.0
    daily_change = current_price - prev_close
    daily_pnl = daily_change * quantity
    daily_pnl_pct = (daily_change / prev_close) * 100
    return round(daily_pnl, 2), round(daily_pnl_pct, 2)


def compute_holding_stats(holding: dict) -> dict:
    """
    Compute derived statistics for a single holding.

    Args:
        holding: { ticker, name, quantity, avg_buy_price, current_price, sector? }

    Returns:
        Enriched dict with: invested, value, pnl, pnl_pct
    """
    quantity = holding.get("quantity", 0)
    avg_buy = holding.get("avg_buy_price", 0)
    current = holding.get("current_price", 0)
    sector = holding.get("sector") or get_sector_for_ticker(holding.get("ticker", ""))

    invested = quantity * avg_buy
    value = quantity * current
    pnl = value - invested
    pnl_pct = pct_change(invested, value) if invested > 0 else 0.0

    return {
        "ticker": holding.get("ticker", ""),
        "name": holding.get("name", holding.get("ticker", "")),
        "sector": sector,
        "quantity": quantity,
        "avg_buy_price": round(avg_buy, 2),
        "current_price": round(current, 2),
        "invested": round(invested, 2),
        "value": round(value, 2),
        "pnl": round(pnl, 2),
        "pnl_pct": round(pnl_pct, 2),
        "allocation": 0,  # Set after computing totals
    }


def compute_all_holdings(holdings: list[dict]) -> tuple[list[dict], dict]:
    """
    Compute stats for all holdings and aggregate totals.

    Returns:
        (enriched_holdings, totals_dict)
    """
    if not holdings:
        return [], {
            "total_value": 0,
            "total_invested": 0,
            "total_pnl": 0,
            "total_pnl_pct": 0,
            "holding_count": 0,
        }

    enriched = [compute_holding_stats(h) for h in holdings]

    total_value = sum(h["value"] for h in enriched)
    total_invested = sum(h["invested"] for h in enriched)
    total_pnl = total_value - total_invested
    total_pnl_pct = (
        pct_change(total_invested, total_value) if total_invested > 0 else 0.0
    )

    # Compute allocation %
    for h in enriched:
        h["allocation"] = round(safe_divide(h["value"], total_value, 0) * 100, 1)

    # Sort by allocation descending
    enriched.sort(key=lambda h: h["allocation"], reverse=True)

    totals = {
        "total_value": round(total_value, 2),
        "total_invested": round(total_invested, 2),
        "total_pnl": round(total_pnl, 2),
        "total_pnl_pct": round(total_pnl_pct, 2),
        "holding_count": len(enriched),
    }

    return enriched, totals


def generate_insights(
    holdings_stats: list[dict],
    health: dict,
    sector_exposure: list[dict],
    totals: dict,
) -> list[dict]:
    """
    Generate AI-style textual insights based on portfolio analysis.

    Returns:
        List of { title, body, tone: 'warn' | 'good' | 'info' }
    """
    notes = []

    if not holdings_stats:
        return [
            {
                "title": "Empty portfolio",
                "body": "Add holdings to see insights.",
                "tone": "info",
            }
        ]

    # Top holding concentration
    top = holdings_stats[0]
    if top["allocation"] > 35:
        notes.append(
            {
                "title": "Single-stock concentration",
                "body": (
                    f"{top['name']} is {top['allocation']:.1f}% of portfolio value. "
                    f"Institutional risk desks usually flag anything above 30-35%."
                ),
                "tone": "warn",
            }
        )

    # Sector diversity
    if len(sector_exposure) < 4:
        notes.append(
            {
                "title": "Diversification depth is thin",
                "body": (
                    f"You have {len(sector_exposure)} active sector{'s' if len(sector_exposure) != 1 else ''}. "
                    f"Add 1-2 defensive or low-correlation sectors to reduce drawdown clustering."
                ),
                "tone": "info",
            }
        )

    # Sector imbalance
    if sector_exposure:
        top_sector = sector_exposure[0]
        if top_sector["weight_pct"] > 48:
            notes.append(
                {
                    "title": "Sector imbalance",
                    "body": (
                        f"{top_sector['sector']} contributes {top_sector['weight_pct']:.1f}% of value. "
                        f"That can amplify earnings-cycle and regulatory shocks."
                    ),
                    "tone": "warn",
                }
            )

    # P&L insight
    pnl_pct = totals.get("total_pnl_pct", 0)
    if pnl_pct > 15:
        notes.append(
            {
                "title": "Strong returns",
                "body": (
                    f"Portfolio is up {pnl_pct:.1f}% overall. "
                    f"Consider booking partial profits on the highest gainers and rebalancing."
                ),
                "tone": "good",
            }
        )
    elif pnl_pct < -10:
        notes.append(
            {
                "title": "Portfolio under pressure",
                "body": (
                    f"Portfolio is down {abs(pnl_pct):.1f}%. "
                    f"Review position sizing and consider averaging down on fundamentally strong names."
                ),
                "tone": "warn",
            }
        )

    # Health-based
    if health.get("score", 100) >= 75 and len(notes) < 3:
        notes.append(
            {
                "title": "AI portfolio read",
                "body": (
                    f"Health score is {health['score']}/100. "
                    f"Position sizing looks workable; rebalance when a holding drifts 5%+ from target allocation."
                ),
                "tone": "good",
            }
        )

    # Ensure at least one note
    if not notes:
        notes.append(
            {
                "title": "Portfolio review",
                "body": "Portfolio looks reasonably balanced. Review allocations periodically.",
                "tone": "good",
            }
        )

    return notes[:4]
