"""
Alpha Zone — dedicated Internal Bullish Order Block detector.

Independent of `scanners/smc_scanner.py` (the shared SMC scanner) and of the
generic FVG scanner. Implements ONLY what Alpha Zone needs, faithful to the
LuxAlgo Pine Script's *internal* order-block logic, with Alpha Zone's own
lifecycle:

  • Internal swings (pivot leg size 5), bullish internal BOS/CHoCH via close-cross.
  • OB candle = the lowest `parsedLow` candle in the leg from the broken pivot to
    the break bar; zone = [parsedLow, parsedHigh] of that candle (re-ordered).
  • High-volatility parsing: on a climax bar (range ≥ 2·ATR) parsedHigh/parsedLow
    swap, so oversized candles don't create oversized OBs (matches Pine).
  • VALIDITY (Alpha Zone rule): a zone stays valid until a candle CLOSES below the
    zone floor. Wicks below the floor are tolerated. No % buffer, no discard —
    strictly the Pine "CLOSE" mitigation option.
  • Every OB carries a real, explainable INSTITUTIONAL score built from the
    formation window (displacement / volume / spread / base / origin candle).

Detection is stateless and bounded to a recent lookback for a fast full-universe
scan; results are deterministic (recompute reproduces the same zones).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

import numpy as np
import pandas as pd

SWING_LEN = 5
LOOKBACK = 500                 # recent candles considered for revisitable zones
NEAR_MAX_PCT = 3.0             # price may sit up to this % above the zone top
ABOVE_MAX_PCT = 1.5           # actionable "above zone" band (vs "near zone")

# Institutional-score weights (sum = 1.0).
_INST_WEIGHTS = {"disp": 0.30, "vol": 0.25, "spr": 0.20, "base": 0.15, "obq": 0.10}


def _clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))


@dataclass
class AlphaZoneOB:
    zone_low: float
    zone_high: float
    ob_idx: int
    break_idx: int
    event: str                 # "BOS" | "CHoCH"
    start_date: str
    formed_date: str
    age_days: int
    touch_count: int = 0
    institutional_score: float = 0.0
    inst_breakdown: dict = field(default_factory=dict)

    @property
    def mid(self) -> float:
        return (self.zone_low + self.zone_high) / 2.0

    def distance_pct(self, price: float) -> float:
        """0 if price is inside the zone, else signed % above the zone top."""
        if self.zone_low <= price <= self.zone_high:
            return 0.0
        return (price - self.zone_high) / self.zone_high * 100.0 if self.zone_high else 0.0


# ── Volatility parsing (parsedHigh / parsedLow) ─────────────────────────────────
def _atr_sma(df: pd.DataFrame, period: int = 14) -> np.ndarray:
    high = df["High"].to_numpy("float64")
    low = df["Low"].to_numpy("float64")
    close = df["Close"].to_numpy("float64")
    prev = np.concatenate([[close[0]], close[:-1]])
    tr = np.maximum.reduce([high - low, np.abs(high - prev), np.abs(low - prev)])
    return pd.Series(tr).rolling(period, min_periods=1).mean().to_numpy()


# ── Internal swings (centred pivots, leg size 5) ────────────────────────────────
def _swings(df: pd.DataFrame, n: int = SWING_LEN):
    win = 2 * n + 1
    sh = (df["High"] == df["High"].rolling(win, center=True, min_periods=win).max()).to_numpy()
    sl = (df["Low"] == df["Low"].rolling(win, center=True, min_periods=win).min()).to_numpy()
    return sh, sl


# ── Bullish internal structure events (BOS / CHoCH) ─────────────────────────────
def _bullish_structure_events(df: pd.DataFrame, sh: np.ndarray, sl: np.ndarray) -> list[dict]:
    """Emit bullish internal breaks with the leg start (last swing low) and break bar."""
    high = df["High"].to_numpy("float64")
    low = df["Low"].to_numpy("float64")
    close = df["Close"].to_numpy("float64")
    n = len(df)

    events: list[dict] = []
    trend: Optional[str] = None
    last_sh = last_sl = None
    last_sh_idx = last_sl_idx = None

    for i in range(n):
        if sh[i]:
            last_sh, last_sh_idx = high[i], i
        if sl[i]:
            last_sl, last_sl_idx = low[i], i

        # Bullish break: close crosses above the last swing high.
        if last_sh is not None and close[i] > last_sh:
            events.append({
                "event": "BOS" if trend == "bullish" else "CHoCH",
                "break_idx": i,
                "leg_start_idx": last_sl_idx,
            })
            trend = "bullish"
            last_sh = None
        # Bearish break only flips the trend (so the next bullish break is tagged right).
        if last_sl is not None and close[i] < last_sl:
            trend = "bearish"
            last_sl = None

    return events


def _institutional_score(
    high: np.ndarray, low: np.ndarray, close: np.ndarray, openp: np.ndarray,
    vol: np.ndarray, atr: np.ndarray, ob_idx: int, brk_idx: int,
    zone_high: float,
) -> tuple[float, dict]:
    """Real institutional score from the formation window (0-100 sub-scores)."""
    a = atr[brk_idx] if atr[brk_idx] > 0 else max(1e-9, (high[brk_idx] - low[brk_idx]))

    # DISP — displacement off the zone in ATRs (impulsive departure).
    disp = (close[brk_idx] - zone_high) / a
    s_disp = _clamp(disp / 3.0 * 100.0)

    # VOL — volume expansion vs the 20-bar baseline before the OB.
    base_lo = max(0, ob_idx - 20)
    prior = vol[base_lo:ob_idx]
    depart = vol[ob_idx:brk_idx + 1]
    prior_mean = float(prior.mean()) if prior.size else float(depart.mean() or 1.0)
    v = (float(depart.mean()) / prior_mean) if prior_mean > 0 else 1.0
    s_vol = _clamp((v - 1.0) / 1.5 * 100.0)

    # SPR — departure candle spread vs ATR (clean displacement).
    rng = (high[ob_idx:brk_idx + 1] - low[ob_idx:brk_idx + 1])
    s = (float(rng.mean()) / a) if rng.size else 0.0
    s_spr = _clamp((s - 0.8) / 1.2 * 100.0)

    # BASE — tightness of the 5 candles before the OB (accumulation base).
    b_lo = max(0, ob_idx - 5)
    if ob_idx - b_lo >= 2:
        br = (float(high[b_lo:ob_idx].max()) - float(low[b_lo:ob_idx].min())) / a
        s_base = _clamp(100.0 - (br - 1.0) / 3.0 * 100.0)
    else:
        s_base = 50.0

    # OBQ — origin candle absorption (lower-wick ratio).
    rng_ob = high[ob_idx] - low[ob_idx]
    lw = ((min(openp[ob_idx], close[ob_idx]) - low[ob_idx]) / rng_ob) if rng_ob > 0 else 0.0
    s_obq = _clamp(lw * 100.0)

    subs = {
        "disp": round(s_disp, 1), "vol": round(s_vol, 1), "spr": round(s_spr, 1),
        "base": round(s_base, 1), "obq": round(s_obq, 1),
    }
    score = sum(subs[k] * _INST_WEIGHTS[k] for k in _INST_WEIGHTS)
    return round(_clamp(score), 1), subs


def detect_internal_bullish_obs(
    df: pd.DataFrame, lookback: int = LOOKBACK
) -> list[AlphaZoneOB]:
    """All still-VALID internal bullish OBs (oldest→newest) within `lookback`."""
    if df is None or df.empty or len(df) < 2 * SWING_LEN + 5:
        return []
    d = df.sort_values("Date")
    if lookback and len(d) > lookback:
        d = d.iloc[-lookback:]
    d = d.reset_index(drop=True)

    high = d["High"].to_numpy("float64")
    low = d["Low"].to_numpy("float64")
    close = d["Close"].to_numpy("float64")
    openp = d["Open"].to_numpy("float64")
    vol = d["Volume"].to_numpy("float64") if "Volume" in d.columns else np.ones(len(d))
    dates = pd.to_datetime(d["Date"]).to_numpy()
    atr = _atr_sma(d, 14)
    n = len(d)

    # parsedHigh / parsedLow with the high-volatility swap.
    highvol = (high - low) >= (2.0 * atr)
    parsed_high = np.where(highvol, low, high)
    parsed_low = np.where(highvol, high, low)

    sh, sl = _swings(d, SWING_LEN)
    events = _bullish_structure_events(d, sh, sl)
    now = pd.Timestamp(datetime.now())

    obs: list[AlphaZoneOB] = []
    for ev in events:
        brk = ev["break_idx"]
        leg_start = ev["leg_start_idx"]
        if leg_start is None or leg_start >= brk:
            continue

        # OB candle = lowest parsedLow in the leg [leg_start, brk).
        seg_pl = parsed_low[leg_start:brk]
        if seg_pl.size == 0:
            continue
        ob_idx = leg_start + int(np.argmin(seg_pl))
        zl = float(min(parsed_low[ob_idx], parsed_high[ob_idx]))
        zh = float(max(parsed_low[ob_idx], parsed_high[ob_idx]))
        if zh <= zl:
            continue
        # Degenerate width guard.
        if (zh - zl) < max(0.001 * close[brk], 0.2 * atr[brk]):
            continue

        # VALIDITY: invalid if any candle after the break CLOSES below the floor.
        after = close[brk + 1:]
        if after.size and bool((after < zl).any()):
            continue

        # touch_count = distinct re-entry events after the break.
        touches = 0
        inside_prev = False
        for k in range(brk + 1, n):
            inside = (low[k] <= zh) and (high[k] >= zl)
            if inside and not inside_prev:
                touches += 1
            inside_prev = inside

        inst_score, inst_bd = _institutional_score(
            high, low, close, openp, vol, atr, ob_idx, brk, zh
        )
        c_brk = pd.Timestamp(dates[brk])
        obs.append(AlphaZoneOB(
            zone_low=round(zl, 2), zone_high=round(zh, 2),
            ob_idx=ob_idx, break_idx=brk, event=ev["event"],
            start_date=pd.Timestamp(dates[leg_start]).strftime("%Y-%m-%d"),
            formed_date=c_brk.strftime("%Y-%m-%d"),
            age_days=max(0, (now - c_brk).days),
            touch_count=touches,
            institutional_score=inst_score, inst_breakdown=inst_bd,
        ))

    return _dedupe_overlaps(obs)


def _dedupe_overlaps(obs: list[AlphaZoneOB]) -> list[AlphaZoneOB]:
    """Overlapping/nested zones → keep the higher institutional score (tie: recent)."""
    kept: list[AlphaZoneOB] = []
    for ob in obs:
        overlap_idx = next(
            (i for i, k in enumerate(kept)
             if ob.zone_low <= k.zone_high and ob.zone_high >= k.zone_low), None
        )
        if overlap_idx is None:
            kept.append(ob)
            continue
        k = kept[overlap_idx]
        if (ob.institutional_score, ob.break_idx) >= (k.institutional_score, k.break_idx):
            kept[overlap_idx] = ob
    return kept


def nearest_reacting_ob(
    df: pd.DataFrame, price: float, lookback: int = LOOKBACK,
    near_max_pct: float = NEAR_MAX_PCT,
) -> Optional[AlphaZoneOB]:
    """
    The active Alpha Zone: among all valid internal bullish OBs, the one price is
    currently reacting to — inside the zone, or up to `near_max_pct`% above its
    top. Nearest by distance-to-zone wins; ties go to the more recent zone.
    """
    elig = [
        ob for ob in detect_internal_bullish_obs(df, lookback=lookback)
        if ob.zone_low <= price <= ob.zone_high * (1.0 + near_max_pct / 100.0)
    ]
    if not elig:
        return None
    return min(elig, key=lambda ob: (ob.distance_pct(price), -ob.break_idx))
