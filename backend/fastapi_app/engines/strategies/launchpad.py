"""
LaunchPad — momentum-swing accumulation/continuation strategy (5-7 day hold).

Setup: inside a healthy uptrend band around the 200 EMA, price is sitting INSIDE
a still-valid bullish FVG (accumulation) or holding just above its top
(continuation). The gap acts as demand; a bullish FVG stays valid until a candle
CLOSES below its floor (wicks below are tolerated).

Pipeline (all via the engines — nothing computed inline):
  1. Price ≥ ₹100                                        (hard price filter, first)
  2. EMA200 distance in [-10%, +20%]                     (Indicator Engine)
  3. Still-valid bullish FVG, gap ≥ 0.5%                 (Pattern Engine)
     (valid = no candle has CLOSED below the FVG floor)
  4. Price location: FVG_low ≤ price ≤ FVG_high·1.02     (Pattern Engine)
  5. Derive a real trade + explainable confidence        (TradePlan + Ranking Engine)

Every returned number is derived from actual price structure — no placeholders.
"""

from __future__ import annotations

from engines.patterns import fvg_backtest, nearest_launchpad_fvg
from engines.patterns.fvg import LAUNCHPAD_MIN_GAP_PCT, LAUNCHPAD_OVERSHOOT_PCT
from engines.ranking import score_launchpad, strength_label

from .base import Strategy, StrategyResult, SymbolContext, TradePlan

MIN_PRICE = 100.0  # reject anything trading below ₹100 (first filter)
EMA_DIST_MIN = -10.0
EMA_DIST_MAX = 20.0
MIN_GAP_PCT = 0.5  # LaunchPad spec (relative to the gap floor / C1.High)
OVERSHOOT_PCT = LAUNCHPAD_OVERSHOOT_PCT  # price may sit up to this % above the gap top
REWARD_MULTIPLE = 2.0


def build_launchpad_result(
    *,
    symbol: str,
    company_name: str,
    price: float,
    ema_200: float | None,
    ema_200_dist_pct: float | None,
    fvg_low: float,
    fvg_high: float,
    age_days: int,
    atr: float | None,
    fvg_date: str = "",
) -> StrategyResult | None:
    """
    Shared derivation used by BOTH the scan-time path (df available) and the
    cache path (fields read from precomputed caches). Applies the LaunchPad
    filters and returns a fully-derived result, or None if the setup fails.
    Gap % is always recomputed to the spec definition (relative to FVG floor).
    Assumes the caller has already confirmed the FVG is *valid* (no candle has
    closed below its floor); this function re-checks price/EMA/gap/location.
    """
    if price is None or price <= 0 or fvg_high <= 0 or fvg_low <= 0:
        return None

    # 1. Price filter — reject sub-₹100 names first.
    if price < MIN_PRICE:
        return None

    # 2. EMA200 trend band.
    if ema_200_dist_pct is None or not (
        EMA_DIST_MIN <= ema_200_dist_pct <= EMA_DIST_MAX
    ):
        return None

    # 3. Gap size.
    gap_pct = (fvg_high - fvg_low) / fvg_low * 100.0  # spec: relative to C1.High
    if gap_pct < MIN_GAP_PCT:
        return None

    # 4. Price location: inside the gap, or up to OVERSHOOT_PCT% above its top.
    #    Reject anything below the floor or more than OVERSHOOT_PCT% above the top.
    if not (fvg_low <= price <= fvg_high * (1.0 + OVERSHOOT_PCT / 100.0)):
        return None

    # Signed distance of price from the gap top (negative ⇒ price inside the gap).
    dist_pct = (price - fvg_high) / fvg_high * 100.0
    setup = "accumulation" if price <= fvg_high else "continuation"

    confidence, breakdown = score_launchpad(
        price=price,
        fvg_low=fvg_low,
        fvg_high=fvg_high,
        gap_pct=gap_pct,
        ema200_dist_pct=ema_200_dist_pct,
        age_days=age_days,
        overshoot_pct=OVERSHOOT_PCT,
    )
    trade = TradePlan.from_support(
        entry=price, support_level=fvg_low, atr=atr, reward_multiple=REWARD_MULTIPLE
    )

    return StrategyResult(
        symbol=symbol,
        company_name=company_name or symbol,
        strategy=LaunchPadStrategy.name,
        cmp=price,
        signal_strength=strength_label(confidence),
        confidence=confidence,
        confidence_breakdown=breakdown,
        trade=trade,
        holding_period=LaunchPadStrategy.holding_period,
        metrics={
            "ema_200": round(ema_200, 2) if ema_200 else None,
            "ema_200_dist_pct": round(ema_200_dist_pct, 2),
            "atr_14": round(atr, 2) if atr else None,
            "fvg_low": round(fvg_low, 2),
            "fvg_high": round(fvg_high, 2),
            "gap_pct": round(gap_pct, 2),
            "fvg_dist_pct": round(dist_pct, 2),
            "days_since_formation": age_days,
            "fvg_date": fvg_date,
            "setup": setup,
        },
    )


class LaunchPadStrategy(Strategy):
    name = "launchpad"
    holding_period = "5-7 days"

    def evaluate(self, ctx: SymbolContext) -> StrategyResult | None:
        """Scan-time path: find the still-valid LaunchPad FVG from the df via the
        Pattern Engine, then run the shared derivation. Cheap when the caller
        already has the df loaded (e.g. the daily scan)."""
        ind = ctx.indicators
        price = ind.price
        if price is None or price < MIN_PRICE:
            return None
        if ind.ema_200_dist_pct is None or not (
            EMA_DIST_MIN <= ind.ema_200_dist_pct <= EMA_DIST_MAX
        ):
            return None

        # Still-valid gap (no candle closed below its floor) that price is inside
        # or up to OVERSHOOT_PCT% above.
        fvg = nearest_launchpad_fvg(
            ctx.df,
            price,
            min_gap_pct=LAUNCHPAD_MIN_GAP_PCT,
            overshoot_pct=OVERSHOOT_PCT,
        )
        if fvg is None:
            return None

        res = build_launchpad_result(
            symbol=ctx.symbol,
            company_name=ctx.company_name,
            price=price,
            ema_200=ind.ema_200,
            ema_200_dist_pct=ind.ema_200_dist_pct,
            fvg_low=fvg.low,
            fvg_high=fvg.high,
            age_days=fvg.age_days,
            atr=ind.atr_14,
            fvg_date=fvg.end_date,
        )
        if res is not None:
            # Enrich the qualifying setup (only ~hundreds of these, so the extra
            # per-symbol work is cheap): 20-day average volume for a liquidity
            # filter, and this symbol's historical bullish-FVG track record so
            # the card can show "how often FVGs work here + avg win/loss".
            res.metrics["avg_volume"] = (
                round(ind.avg_volume_20) if ind.avg_volume_20 else None
            )
            res.metrics.update(fvg_backtest(ctx.df))
        return res
