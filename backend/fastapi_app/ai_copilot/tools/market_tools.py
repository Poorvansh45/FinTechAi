"""
Market tools — wrap the existing MarketDataService (Groww → yfinance → Finnhub).

No new data providers are introduced; these tools call the Phase 1 singleton
`services.market_service.get_market_service()` and normalise its output to short
strings for the agent.
"""

from __future__ import annotations

import logging

from langchain_core.tools import tool

log = logging.getLogger("finai_edge.copilot.tools.market")


def _svc():
    from services.market_service import get_market_service

    return get_market_service()


def _fmt_quote(q) -> str:
    if not getattr(q, "available", False) or q.price is None:
        return f"{getattr(q, 'ticker', '?')}: quote unavailable right now."
    return (
        f"{q.ticker}: ₹{q.price:,.2f} ({q.change_pct:+.2f}%), "
        f"day range ₹{q.low or 0:,.2f}–₹{q.high or 0:,.2f}, "
        f"prev close ₹{q.prev_close or 0:,.2f}, source {q.source}."
    )


@tool
async def get_quote(symbol: str) -> str:
    """Get the live price and day stats for one stock symbol (NSE, e.g. 'RELIANCE' or
    'TCS'). Use for 'what's the price of X' or as the first step in analysing a stock."""
    try:
        q = await _svc().get_quote(symbol)
        return _fmt_quote(q)
    except Exception as e:
        log.warning(f"[tool] get_quote({symbol}) failed: {e}")
        return f"Could not fetch a quote for {symbol}."


@tool
async def get_stock_info(query: str) -> str:
    """Look up basic instrument info (name, sector, exchange) for a company or ticker
    query. Use to identify a stock and its sector before deeper analysis."""
    try:
        results = await _svc().search(query, limit=3)
        if not results:
            return f"No instrument found for '{query}'."
        lines = [
            f"- {r.ticker} — {r.name} ({r.sector}, {r.exchange}, {r.instrument_type})"
            for r in results
        ]
        return "Matches:\n" + "\n".join(lines)
    except Exception as e:
        log.warning(f"[tool] get_stock_info({query}) failed: {e}")
        return f"Could not look up '{query}'."


@tool
async def compare_stocks(symbols: list[str]) -> str:
    """Compare live quotes for 2-5 stock symbols side by side (e.g. TCS vs INFY). Use
    for 'X vs Y' questions. Present the data; explain trade-offs rather than naming a
    single 'winner'."""
    symbols = [s for s in (symbols or []) if s][:5]
    if len(symbols) < 2:
        return "Provide at least two symbols to compare."
    try:
        quotes = await _svc().get_bulk_quotes(symbols)
        lines = [_fmt_quote(quotes.get(s)) if quotes.get(s) else f"{s}: unavailable" for s in symbols]
        return "Comparison:\n" + "\n".join(lines)
    except Exception as e:
        log.warning(f"[tool] compare_stocks failed: {e}")
        return "Could not compare those symbols right now."


@tool
async def sector_analysis(symbol: str) -> str:
    """Identify the sector of a stock and give a brief read on it. Use for questions
    about which sector a stock belongs to, or as context for concentration risk."""
    try:
        results = await _svc().search(symbol, limit=1)
        if not results:
            return f"Could not identify a sector for '{symbol}'."
        r = results[0]
        return (
            f"{r.ticker} ({r.name}) is in the {r.sector} sector on {r.exchange}. "
            f"Concentration in a single sector raises portfolio risk if it dominates allocation."
        )
    except Exception as e:
        log.warning(f"[tool] sector_analysis({symbol}) failed: {e}")
        return f"Could not analyse the sector for '{symbol}'."


MARKET_TOOLS = [get_quote, get_stock_info, compare_stocks, sector_analysis]
