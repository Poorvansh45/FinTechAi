"""
Portfolio tools — wrap the existing Phase 1 portfolio engine.

The user's holdings come from their most-recently-saved portfolio in MongoDB
(`models.portfolio.get_portfolios`), and all analysis is delegated to the
existing `PortfolioService.analyze_holdings` — no analytics are re-implemented
here. Tools return compact, LLM-friendly text summaries (not raw JSON blobs) so
the agent can reason over them cheaply.
"""

from __future__ import annotations

import logging

from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool

from .context import get_ctx

log = logging.getLogger("finai_edge.copilot.tools.portfolio")


async def _latest_holdings(ctx) -> list[dict]:
    """Fetch the holdings from the user's most recent saved portfolio."""
    if ctx.db is None or not ctx.user_id:
        return []
    try:
        from models.portfolio import get_portfolios

        portfolios = await get_portfolios(ctx.db, ctx.user_id, limit=1)
        if not portfolios:
            return []
        return portfolios[0].get("holdings", []) or []
    except Exception as e:  # pragma: no cover - defensive
        log.warning(f"[tool] _latest_holdings failed: {e}")
        return []


async def _analyze(holdings: list[dict]) -> dict:
    from services.portfolio_service import get_portfolio_service

    return await get_portfolio_service().analyze_holdings(holdings)


def _fmt_sectors(sector_exposure: list[dict], top: int = 4) -> str:
    rows = sorted(sector_exposure, key=lambda s: s.get("weight_pct", 0), reverse=True)[
        :top
    ]
    return (
        ", ".join(f"{s.get('sector')} {s.get('weight_pct', 0):.0f}%" for s in rows)
        or "n/a"
    )


@tool
async def get_user_holdings(config: RunnableConfig) -> str:
    """Return the authenticated user's current portfolio holdings (ticker, quantity,
    average buy price, current price, sector). Use this to see WHAT the user owns
    before reasoning about it."""
    ctx = get_ctx(config)
    holdings = await _latest_holdings(ctx)
    if not holdings:
        return "The user has no saved portfolio holdings yet."
    lines = [
        f"- {h.get('ticker')}: qty={h.get('quantity')} avg={h.get('avg_buy_price')} "
        f"cur={h.get('current_price')} sector={h.get('sector', 'Unknown')}"
        for h in holdings
    ]
    return "User holdings:\n" + "\n".join(lines)


@tool
async def analyze_portfolio(config: RunnableConfig) -> str:
    """Run a full analysis of the authenticated user's saved portfolio: totals & P&L,
    sector exposure, risk metrics (volatility, Sharpe, VaR, max drawdown, CAGR),
    a 0-100 health score, diversification, and rebalance suggestions. Use this for
    any question about the user's OWN portfolio ('analyze my portfolio', 'am I
    diversified', 'my risk')."""
    ctx = get_ctx(config)
    holdings = await _latest_holdings(ctx)
    if not holdings:
        return "No saved portfolio found. Ask the user to add holdings before analysis."
    r = await _analyze(holdings)
    if r.get("error"):
        return f"Analysis unavailable: {r['error']}"

    totals = r.get("totals", {})
    risk = r.get("risk", {})
    health = r.get("health", {})
    risk_level = (risk.get("risk_level") or {}).get("level", "n/a")
    reb = r.get("rebalance_suggestions", []) or []
    reb_txt = (
        "; ".join(
            f"{s.get('action')} {s.get('ticker')} ({s.get('reason')})" for s in reb[:4]
        )
        or "none"
    )

    return (
        f"Portfolio analysis:\n"
        f"- Value ₹{totals.get('total_value', 0):,.0f} | Invested ₹{totals.get('total_invested', 0):,.0f} "
        f"| P&L {totals.get('total_pnl_pct', 0):.1f}% | Holdings {totals.get('holding_count', 0)}\n"
        f"- Health score: {health.get('score', 0)}/100 ({health.get('label', 'n/a')}) — {health.get('summary', '')}\n"
        f"- Risk level: {risk_level} | Volatility {risk.get('volatility_pct', 0):.1f}% "
        f"| Sharpe {risk.get('sharpe_ratio', 0):.2f} | Max drawdown {risk.get('max_drawdown_pct', 0):.1f}% "
        f"| CAGR {risk.get('cagr', 0):.1f}%\n"
        f"- Diversification score: {r.get('diversification_score', 0)}/100\n"
        f"- Sector exposure: {_fmt_sectors(r.get('sector_exposure', []))}\n"
        f"- Rebalance suggestions: {reb_txt}"
    )


@tool
async def get_health_score(config: RunnableConfig) -> str:
    """Return just the health score (0-100) and its breakdown for the user's
    portfolio, with a plain-language explanation of what drives it. Use this when
    the user asks 'why is my health score X'."""
    ctx = get_ctx(config)
    holdings = await _latest_holdings(ctx)
    if not holdings:
        return "No saved portfolio found. Ask the user to add holdings first."
    r = await _analyze(holdings)
    health = r.get("health", {})
    breakdown = health.get("breakdown", {})
    bd = ", ".join(f"{k}: {v}" for k, v in breakdown.items()) or "n/a"
    return (
        f"Health score {health.get('score', 0)}/100 ({health.get('label', 'n/a')}). "
        f"Breakdown — {bd}. {health.get('summary', '')}"
    )


@tool
async def rebalance_portfolio(config: RunnableConfig) -> str:
    """Return concrete rebalance suggestions (trim/add/introduce/remove with reasons
    and priority) for the user's portfolio. Use this for 'should I rebalance' style
    questions. Frame output as suggestions to consider, never as guaranteed actions."""
    ctx = get_ctx(config)
    holdings = await _latest_holdings(ctx)
    if not holdings:
        return "No saved portfolio found. Ask the user to add holdings first."
    r = await _analyze(holdings)
    reb = r.get("rebalance_suggestions", []) or []
    if not reb:
        return "No rebalance suggestions — the portfolio looks reasonably balanced by the model."
    lines = [
        f"- {s.get('action', '').upper()} {s.get('ticker')}: "
        f"{s.get('current_pct', 0):.0f}% → {s.get('target_pct', 0):.0f}% "
        f"[{s.get('priority', 'medium')}] — {s.get('reason', '')}"
        for s in reb[:8]
    ]
    return "Rebalance suggestions (to consider, not directives):\n" + "\n".join(lines)


PORTFOLIO_TOOLS = [
    get_user_holdings,
    analyze_portfolio,
    get_health_score,
    rebalance_portfolio,
]
