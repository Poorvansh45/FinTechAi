"""
Strategy base contracts.

- SymbolContext : everything a strategy needs for one symbol (df + precomputed
  indicators + market context), built ONCE per symbol and shared by all
  strategies so nothing recomputes.
- TradePlan     : a real, derived trade (entry/stop/target from actual price
  structure + ATR) — replaces the previous hardcoded 1:3 / ASCII values.
- StrategyResult: the output row a strategy emits (or None to reject).
- Strategy      : the ABC every scanner implements (SOLID: open for extension).
"""

from __future__ import annotations

import abc
from dataclasses import asdict, dataclass, field

import pandas as pd

from engines.indicators import IndicatorSet


@dataclass
class MarketContext:
    """Broad-market context shared across all symbols in a scan run."""

    index_symbol: str = "^NSEI"
    index_above_ema200: bool | None = None  # regime; None if unknown


@dataclass
class SymbolContext:
    symbol: str
    df: pd.DataFrame
    indicators: IndicatorSet
    company_name: str = ""
    market: MarketContext = field(default_factory=MarketContext)

    @property
    def price(self) -> float | None:
        return self.indicators.price


@dataclass
class TradePlan:
    entry: float
    stop_loss: float
    target: float
    risk_per_share: float
    reward_per_share: float
    risk_reward: float  # reward / risk (e.g. 2.0 → "1:2.0")
    risk_pct: float  # risk as % of entry

    @staticmethod
    def from_support(
        entry: float,
        support_level: float,
        atr: float | None,
        reward_multiple: float = 2.0,
        atr_buffer: float = 0.25,
        min_risk_atr: float = 0.5,
    ) -> TradePlan:
        """
        Build a trade from a real support level (e.g. an FVG floor).
        Stop = support − atr_buffer·ATR. If the resulting risk is implausibly
        tight (< min_risk_atr·ATR), widen the stop to a sane ATR-based distance.
        Target = entry + reward_multiple · risk. All values are derived — nothing
        is hardcoded.
        """
        a = atr if (atr and atr > 0) else entry * 0.02  # 2% fallback if ATR missing
        stop = support_level - atr_buffer * a
        risk = entry - stop
        if risk < min_risk_atr * a:
            stop = entry - 1.5 * a
            risk = entry - stop
        risk = max(risk, 1e-6)
        reward = reward_multiple * risk
        target = entry + reward
        return TradePlan(
            entry=round(entry, 2),
            stop_loss=round(stop, 2),
            target=round(target, 2),
            risk_per_share=round(risk, 2),
            reward_per_share=round(reward, 2),
            risk_reward=round(reward / risk, 2),
            risk_pct=round(risk / entry * 100, 2),
        )

    def as_dict(self) -> dict:
        return asdict(self)


@dataclass
class StrategyResult:
    symbol: str
    company_name: str
    strategy: str
    cmp: float
    signal_strength: str  # "Strong" | "Medium" | "Weak"
    confidence: float  # 0-100, real & explainable
    confidence_breakdown: dict  # sub-scores → transparency in the UI
    trade: TradePlan
    holding_period: str  # strategy constant, e.g. "5-7 days"
    metrics: dict = field(default_factory=dict)  # strategy-specific fields

    def to_doc(self) -> dict:
        d = {
            "symbol": self.symbol,
            "company_name": self.company_name,
            "strategy": self.strategy,
            "cmp": round(self.cmp, 2),
            "signal_strength": self.signal_strength,
            "confidence": round(self.confidence, 1),
            "confidence_breakdown": self.confidence_breakdown,
            "holding_period": self.holding_period,
            **self.trade.as_dict(),
            **self.metrics,
        }
        return d


class Strategy(abc.ABC):
    """A proprietary scanner. Stateless; `evaluate` is pure."""

    name: str
    holding_period: str = ""

    @abc.abstractmethod
    def evaluate(self, ctx: SymbolContext) -> StrategyResult | None:
        """Return a StrategyResult if `ctx` qualifies, else None."""
        ...
