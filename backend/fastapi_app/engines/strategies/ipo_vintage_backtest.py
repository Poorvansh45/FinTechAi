"""
IPO Vintage — historical study over the setups the scanner itself produced.

This does NOT re-derive the strategy: it aggregates the RESOLVED and STOPPED
outcomes already computed per symbol by `build_ipo_vintage_result`, so the
numbers on the proof panel are the same numbers on the cards. Pending horizons
are excluded entirely — a trade that hasn't finished cannot contribute to a
historical result.

Deliberate honesty constraints baked into the output:

  • Every horizon is reported side by side. Cherry-picking the best one is the
    single easiest way to make a mediocre setup look good.
  • A per-year breakdown ships with the headline. The aggregate win rate over a
    strong multi-year IPO cycle is not a forecast, and the year rows are what
    make that visible rather than hidden behind one number.
  • `stopped` trades are counted as the losses they are, at the stop return.
  • The equity curve compounds trades SEQUENTIALLY by entry date, one position
    at a time. That is a study of the signal, not a portfolio simulation: it
    ignores capital constraints, overlapping positions, slippage, brokerage and
    taxes, all of which make real results worse.
"""

from __future__ import annotations

from statistics import median
from typing import Optional

from .ipo_vintage import HORIZONS


def _pct(n: int, d: int) -> float:
    return round(n / d * 100.0, 1) if d else 0.0


def _horizon_stats(docs: list[dict], h: int) -> dict:
    """Aggregate one horizon's finished trades. Pending is excluded."""
    key = f"h{h}"
    rets: list[float] = []
    stopped = 0
    for d in docs:
        hz = (d.get("horizons") or {}).get(key) or {}
        status = hz.get("status")
        if status not in ("resolved", "stopped"):
            continue                      # pending -> not a finished trade
        r = hz.get("return_pct")
        if r is None:
            continue
        rets.append(float(r))
        if status == "stopped":
            stopped += 1

    if not rets:
        return {
            "horizon": h, "trades": 0, "win_rate": None, "median_return_pct": None,
            "mean_return_pct": None, "stopped_pct": None, "best_pct": None, "worst_pct": None,
        }

    wins = sum(1 for r in rets if r > 0)
    return {
        "horizon": h,
        "trades": len(rets),
        "win_rate": _pct(wins, len(rets)),
        "median_return_pct": round(median(rets), 2),
        "mean_return_pct": round(sum(rets) / len(rets), 2),
        "stopped_pct": _pct(stopped, len(rets)),
        "best_pct": round(max(rets), 2),
        "worst_pct": round(min(rets), 2),
    }


def _equity_curve(
    docs: list[dict], h: int,
    starting_capital: float = 100_000.0,
    slots: int = 10,
) -> dict:
    """Fixed-size position sizing: `starting_capital / slots` rupees per trade,
    P&L summed. NOT full-capital compounding.

    Why this matters, concretely: these returns have a positive MEAN but a
    negative MEDIAN — a handful of large winners carry the average. Compounding
    the entire account into each of ~550 sequential trades multiplies those
    outliers together and produces astronomical, meaningless equity (this model
    originally printed six-figure multiples). Fixed sizing keeps every trade's
    contribution proportional to what it actually was, so the curve shows the
    signal's real shape instead of a compounding artifact.

    Still a signal study, not a portfolio backtest — see the module docstring.
    """
    key = f"h{h}"
    trades = []
    for d in docs:
        hz = (d.get("horizons") or {}).get(key) or {}
        if hz.get("status") not in ("resolved", "stopped"):
            continue
        r = hz.get("return_pct")
        if r is None or not d.get("trigger_date"):
            continue
        trades.append((d["trigger_date"], d.get("symbol", ""), float(r)))
    trades.sort(key=lambda t: t[0])

    position_size = starting_capital / max(slots, 1)
    equity = starting_capital
    peak = starting_capital
    max_dd = 0.0
    curve = [{"date": None, "symbol": None, "equity": round(equity, 2)}]
    for date, symbol, r in trades:
        equity += position_size * (r / 100.0)
        peak = max(peak, equity)
        if peak > 0:
            max_dd = min(max_dd, (equity - peak) / peak * 100.0)
        curve.append({"date": date, "symbol": symbol, "equity": round(equity, 2)})

    return {
        "starting_capital": starting_capital,
        "position_size": round(position_size, 2),
        "slots": slots,
        "final_equity": round(equity, 2),
        "total_return_pct": round((equity / starting_capital - 1.0) * 100.0, 1),
        "multiple": round(equity / starting_capital, 2),
        "max_drawdown_pct": round(max_dd, 1),
        "trades": len(trades),
        "curve": curve,
    }


def _per_year(docs: list[dict], h: int) -> list[dict]:
    """Year-by-year breakdown, keyed on trigger year. Ships WITH the headline on
    purpose: a single aggregate over one strong IPO cycle reads as a forecast,
    and these rows are what show how much it actually moves year to year."""
    key = f"h{h}"
    buckets: dict[str, list[float]] = {}
    for d in docs:
        hz = (d.get("horizons") or {}).get(key) or {}
        if hz.get("status") not in ("resolved", "stopped"):
            continue
        r = hz.get("return_pct")
        td = d.get("trigger_date")
        if r is None or not td:
            continue
        buckets.setdefault(str(td)[:4], []).append(float(r))

    out = []
    for year in sorted(buckets):
        rets = buckets[year]
        wins = sum(1 for r in rets if r > 0)
        out.append({
            "year": year,
            "trades": len(rets),
            "win_rate": _pct(wins, len(rets)),
            "median_return_pct": round(median(rets), 2),
        })
    return out


def build_ipo_vintage_study(docs: list[dict], headline_horizon: int = 15) -> dict:
    """Full study payload for the UI proof panel."""
    if headline_horizon not in HORIZONS:
        headline_horizon = 15

    by_horizon = [_horizon_stats(docs, h) for h in HORIZONS]
    finished_any = any(s["trades"] for s in by_horizon)
    equity = _equity_curve(docs, headline_horizon)

    risks = [float(d["risk_pct"]) for d in docs if d.get("risk_pct") is not None]
    median_risk = round(median(risks), 1) if risks else None

    return {
        "headline_horizon": headline_horizon,
        "setups_tracked": len(docs),
        "has_data": finished_any,
        "median_risk_pct": median_risk,
        "by_horizon": by_horizon,
        "equity": equity,
        "per_year": _per_year(docs, headline_horizon),
        # Surfaced to the UI so the caveats can never be separated from the
        # numbers they qualify. Derived from the same figures shown above rather
        # than hardcoded — a stale caveat is worse than no caveat.
        "caveats": [
            "Historical study of setups this scanner produced — not a forecast and not a recommendation.",
            f"Fixed ₹{equity['position_size']:,.0f} per trade across {equity['slots']} positions — NOT full-capital compounding. "
            "Excludes brokerage, slippage and taxes, which make real results worse.",
            "Every trade is taken in sequence with no capital or concurrency limit; a real account could not always have a slot free.",
            "Covers a single, unusually strong IPO cycle. Per-year rows show how much the result moves depending on when you sample.",
            f"Stops are wide — median risk to stop is {median_risk}%." if median_risk is not None
            else "Stops on this setup are wide.",
        ],
    }
