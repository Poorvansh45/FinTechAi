"""
FVG pattern helpers for the Pattern Engine.

Two families of helpers live here, kept deliberately separate:

  • Generic ICT helpers that wrap `scanners.fvg.detect_bullish_fvgs` (the shared
    detector, unchanged): `detect_bullish_fvgs`, `latest_bullish_fvg`,
    `nearest_active_fvg`, `classify_continuation`. These use ICT "mitigation"
    (a gap dies the moment price trades into it) and are used by the generic
    FVG scanner / Alpha-Zone-adjacent code.

  • LaunchPad-OWNED detection: `_fast_launchpad_fvgs`, `launchpad_valid_fvgs`,
    `nearest_launchpad_fvg`. These scan raw OHLCV directly (vectorised numpy —
    no `scanners.fvg` call) and apply LaunchPad's OWN validity rule:

        A bullish FVG stays valid until a candle CLOSES below the gap floor
        (FVG Low). Wicks below the floor are tolerated.

    This makes LaunchPad fully independent of the generic ICT active-FVG logic.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

import numpy as np
import pandas as pd

from scanners.fvg import detect_bullish_fvgs as _detect_bullish_fvgs

# LaunchPad spec: minimum 0.5% gap (vs the scanner's default 1%).
LAUNCHPAD_MIN_GAP_PCT = 0.005
# Guard rails for LaunchPad's own detector.
LAUNCHPAD_MAX_GAP_PCT = 10.0  # ignore >10% gaps (bad data / non-actionable)
LAUNCHPAD_MAX_SPAN_DAYS = 7  # C1→C3 must not straddle a data gap
LAUNCHPAD_LOOKBACK = 250  # only recent candles matter for a 5-7d swing


@dataclass
class FVG:
    low: float
    high: float
    gap_pct: float
    age_days: int
    start_date: str
    end_date: str
    is_active: bool  # unmitigated (price never traded back into the gap)
    formed_idx: int = (
        -1
    )  # row index (sorted-by-Date) of C3 — the candle that completes the gap

    @property
    def mid(self) -> float:
        return (self.low + self.high) / 2.0

    @property
    def spec_gap_pct(self) -> float:
        """Gap size per the LaunchPad spec: (C3.Low − C1.High) / C1.High × 100,
        i.e. relative to the gap floor (self.low = C1.High)."""
        return (self.high - self.low) / self.low * 100.0 if self.low else 0.0

    def contains(self, price: float) -> bool:
        return self.low <= price <= self.high

    def distance_pct(self, price: float) -> float:
        """Signed distance of price from the top of the gap (+ = price above)."""
        return (price - self.high) / self.high * 100.0 if self.high else 0.0


def _to_fvg(d: dict) -> FVG:
    return FVG(
        low=d["low"],
        high=d["high"],
        gap_pct=d.get("gap_pct", 0.0),
        age_days=d.get("age_days", 0),
        start_date=d.get("start_date", ""),
        end_date=d.get("end_date", ""),
        is_active=d.get("is_active", False),
        formed_idx=d.get("formed_idx", -1),
    )


def detect_bullish_fvgs(
    df: pd.DataFrame, min_gap_pct: float = LAUNCHPAD_MIN_GAP_PCT
) -> list[FVG]:
    """All bullish FVGs (non-duplicate), oldest→newest, at the LaunchPad gap threshold."""
    raw = _detect_bullish_fvgs(df, min_gap_pct=min_gap_pct)
    return [_to_fvg(d) for d in raw if not d.get("is_duplicate", False)]


def latest_bullish_fvg(
    df: pd.DataFrame, min_gap_pct: float = LAUNCHPAD_MIN_GAP_PCT
) -> FVG | None:
    """Most recently formed bullish FVG (regardless of mitigation)."""
    fvgs = detect_bullish_fvgs(df, min_gap_pct=min_gap_pct)
    return fvgs[-1] if fvgs else None


def nearest_active_fvg(
    df: pd.DataFrame, price: float, min_gap_pct: float = LAUNCHPAD_MIN_GAP_PCT
) -> FVG | None:
    """Closest unmitigated bullish FVG to the current price."""
    active = [
        f for f in detect_bullish_fvgs(df, min_gap_pct=min_gap_pct) if f.is_active
    ]
    if not active:
        return None
    return min(active, key=lambda f: abs(price - f.mid))


# LaunchPad price-location band: how far ABOVE the gap top price may sit and
# still be considered a valid entry (in % of the gap high).
LAUNCHPAD_OVERSHOOT_PCT = 2.0


def _fast_launchpad_fvgs(
    df: pd.DataFrame,
    min_gap_pct: float = LAUNCHPAD_MIN_GAP_PCT,
    lookback: int = LAUNCHPAD_LOOKBACK,
) -> list[FVG]:
    """
    Vectorised bullish-FVG detector that scans raw OHLCV DIRECTLY — no call into
    `scanners.fvg`. Returns gaps that are still VALID under the LaunchPad rule:

        A bullish FVG (C1.High < C3.Low) stays valid until a candle CLOSES below
        its floor (C1.High). Wicks below the floor are tolerated.

    Only the last `lookback` candles are examined — for a 5-7 day swing, gaps
    older than that are stale, and bounding the window keeps a full-universe
    (~4200 symbol) scan practical. All heavy work is numpy array math, so this
    is ~100× faster than an `iloc` row loop.
    """
    if df is None or df.empty or len(df) < 3:
        return []
    d = df.sort_values("Date")
    if lookback and len(d) > lookback + 2:
        d = d.iloc[-(lookback + 2) :]  # +2 so the oldest kept row can still be a C1
    d = d.reset_index(drop=True)

    high = d["High"].to_numpy(dtype="float64")
    low = d["Low"].to_numpy(dtype="float64")
    close = d["Close"].to_numpy(dtype="float64")
    dates = pd.to_datetime(d["Date"]).to_numpy()
    n = len(high)
    if n < 3:
        return []

    # Suffix-min of Close: suf_min[k] = min(close[k:]) — lets us check "did any
    # later candle close below the floor?" in O(1) per gap.
    suf_min = np.minimum.accumulate(close[::-1])[::-1]
    now = pd.Timestamp(datetime.now())

    out: list[FVG] = []
    for i in range(n - 2):
        gl = high[i]  # gap floor  = C1.High
        gh = low[i + 2]  # gap ceiling = C3.Low
        if gh <= gl:
            continue
        gap = gh - gl
        if gap < gl * min_gap_pct or gap > gl * (LAUNCHPAD_MAX_GAP_PCT / 100.0):
            continue
        j = i + 2  # C3 index
        # Data-continuity: C1→C3 must not straddle a big calendar gap.
        if (
            pd.Timestamp(dates[j]) - pd.Timestamp(dates[i])
        ).days > LAUNCHPAD_MAX_SPAN_DAYS:
            continue
        # LaunchPad validity: no candle AFTER C3 has closed below the floor.
        if j + 1 < n and suf_min[j + 1] < gl:
            continue
        c3 = pd.Timestamp(dates[j])
        out.append(
            FVG(
                low=round(float(gl), 2),
                high=round(float(gh), 2),
                gap_pct=round(gap / gl * 100.0, 2),
                age_days=max(0, (now - c3).days),
                start_date=pd.Timestamp(dates[i]).strftime("%Y-%m-%d"),
                end_date=c3.strftime("%Y-%m-%d"),
                is_active=True,  # valid under the LaunchPad rule
                formed_idx=j,
            )
        )
    return out


def launchpad_valid_fvgs(
    df: pd.DataFrame,
    min_gap_pct: float = LAUNCHPAD_MIN_GAP_PCT,
    lookback: int = LAUNCHPAD_LOOKBACK,
) -> list[FVG]:
    """All bullish FVGs still valid under the LaunchPad close-below-floor rule
    (oldest→newest), detected directly from OHLCV."""
    return _fast_launchpad_fvgs(df, min_gap_pct=min_gap_pct, lookback=lookback)


def nearest_launchpad_fvg(
    df: pd.DataFrame,
    price: float,
    min_gap_pct: float = LAUNCHPAD_MIN_GAP_PCT,
    overshoot_pct: float = LAUNCHPAD_OVERSHOOT_PCT,
    lookback: int = LAUNCHPAD_LOOKBACK,
) -> FVG | None:
    """
    Nearest still-valid bullish FVG whose zone price is currently sitting in the
    LaunchPad accumulation/continuation band:

        FVG_low  <=  price  <=  FVG_high * (1 + overshoot_pct/100)

    i.e. price is anywhere inside the gap, or up to `overshoot_pct`% above its
    top. Among the eligible valid gaps, the closest to price (by midpoint) wins.
    """
    elig = [
        f
        for f in _fast_launchpad_fvgs(df, min_gap_pct=min_gap_pct, lookback=lookback)
        if f.low <= price <= f.high * (1.0 + overshoot_pct / 100.0)
    ]
    if not elig:
        return None
    return min(elig, key=lambda f: abs(price - f.mid))


# ── Historical FVG backtest ──────────────────────────────────────────────────
# Forward window (trading days) to resolve each past FVG's outcome, and the
# reward multiple used to place the take-profit relative to the gap-floor risk.
FVG_BACKTEST_WINDOW = 10
FVG_BACKTEST_REWARD = 2.0


def fvg_backtest(
    df: pd.DataFrame,
    forward_days: int = FVG_BACKTEST_WINDOW,
    reward_multiple: float = FVG_BACKTEST_REWARD,
    min_gap_pct: float = LAUNCHPAD_MIN_GAP_PCT,
) -> dict:
    """
    How well has THIS symbol historically respected bullish FVGs?

    For every past bullish FVG (same 3-candle geometry LaunchPad uses), we treat
    the gap top as the continuation entry and the gap floor as the invalidation
    level — LaunchPad's own "a close below the floor kills the gap" rule — and
    place a take-profit at `reward_multiple`× the entry→floor risk. Walking up to
    `forward_days` bars after the gap forms:

        • a Close below the floor first   → FAIL, return = (floor − entry)/entry
        • the target High is reached first → WIN,  return = (target − entry)/entry
        • neither within the window        → resolved by the final close's sign

    Only gaps with a FULL forward window are counted, so outcomes are never
    look-ahead/incomplete (the current still-open setup is naturally excluded).
    Overlapping consecutive gaps are de-duplicated to avoid double-counting the
    same imbalance, mirroring `detect_bullish_fvgs`.

    Returns:
        {fvg_sample, fvg_win_rate (%), fvg_avg_win (%), fvg_avg_loss (%)}
    a plain dict so it can be spread straight into a StrategyResult's metrics.
    """
    empty = {
        "fvg_sample": 0,
        "fvg_win_rate": None,
        "fvg_avg_win": None,
        "fvg_avg_loss": None,
    }
    if df is None or df.empty or len(df) < forward_days + 3:
        return empty

    d = df.sort_values("Date").reset_index(drop=True)
    high = d["High"].to_numpy(dtype="float64")
    low = d["Low"].to_numpy(dtype="float64")
    close = d["Close"].to_numpy(dtype="float64")
    dates = pd.to_datetime(d["Date"]).to_numpy()
    n = len(close)

    wins: list[float] = []
    losses: list[float] = []
    prev_zone: tuple[float, float] | None = None

    for i in range(n - 2):
        gl = high[i]  # gap floor  = C1.High
        gh = low[i + 2]  # gap ceiling = C3.Low
        if gh <= gl:
            continue
        gap = gh - gl
        if gap < gl * min_gap_pct or gap > gl * (LAUNCHPAD_MAX_GAP_PCT / 100.0):
            continue
        j = i + 2  # C3 index (gap completes here)
        if (
            pd.Timestamp(dates[j]) - pd.Timestamp(dates[i])
        ).days > LAUNCHPAD_MAX_SPAN_DAYS:
            continue

        # De-dup overlapping consecutive gaps (same imbalance chain).
        is_dup = prev_zone is not None and max(prev_zone[0], gl) < min(prev_zone[1], gh)
        prev_zone = (gl, gh)
        if is_dup:
            continue

        if j + forward_days >= n:  # need a full forward window to know the outcome
            continue

        entry, floor = gh, gl
        if entry <= 0 or entry <= floor:
            continue
        target = entry + reward_multiple * (entry - floor)

        outcome: float | None = None
        for k in range(j + 1, j + 1 + forward_days):
            if close[k] < floor:  # invalidated first → loss
                outcome = (floor - entry) / entry * 100.0
                break
            if high[k] >= target:  # target hit first → win
                outcome = (target - entry) / entry * 100.0
                break
        if outcome is None:  # timed out → resolve by final close
            outcome = (close[j + forward_days] - entry) / entry * 100.0

        (wins if outcome >= 0 else losses).append(outcome)

    total = len(wins) + len(losses)
    if total == 0:
        return empty
    return {
        "fvg_sample": total,
        "fvg_win_rate": round(len(wins) / total * 100.0, 1),
        "fvg_avg_win": round(sum(wins) / len(wins), 1) if wins else None,
        "fvg_avg_loss": round(sum(losses) / len(losses), 1) if losses else None,
    }


def classify_continuation(
    fvg: FVG | None,
    price: float,
    max_distance_pct: float = 3.0,
) -> str | None:
    """
    Continuation classification for a bullish FVG relative to price:
      - "at_support"  : price is within `max_distance_pct` above the gap (ideal entry)
      - "extended"    : price is further above the gap (trend intact, worse entry)
      - "inside"      : price is inside the gap (being mitigated — not continuation)
      - "below"       : price below the gap (broken support)
    Returns None if there is no FVG.
    """
    if fvg is None:
        return None
    if fvg.contains(price):
        return "inside"
    if price < fvg.low:
        return "below"
    dist = fvg.distance_pct(price)  # positive here (price above gap)
    return "at_support" if dist <= max_distance_pct else "extended"
