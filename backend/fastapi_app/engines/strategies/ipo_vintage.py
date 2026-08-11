"""
IPO Vintage — opening-range breakout on recently listed stocks (rule-based, no ML).

The setup, in one line: after a stock lists, wait for the first session that
CLOSES above the entire first-day range, enter there, and stop out below that
same first-day range.

  • Opening candle  — the first traded session on or after the listing date.
  • Breakout level  — the opening candle's HIGH (the whole first-day range, not
                      where it happened to settle).
  • Entry           — the close of the first session after the opening candle
                      whose close > opening high.
  • Stop            — the opening candle's LOW. Hit when any later session's
                      low <= stop.
  • Exits           — fixed horizons at 7/15/30/60/90 sessions from entry. There
                      is no price target; the only exit besides the stop is time.

Risk on this setup is WIDE — the opening-candle range on a new listing is often
10-20% — so `risk_pct` is a first-class output, and the confidence scorer weights
it more heavily than the breakout itself.

The trigger fires ONCE per listing, at the first qualifying close, and it ages
out: after `LIVE_WINDOW_SESSIONS` the setup is `expired` — real history, but not
a trade anyone can still enter, since the entry was that one session's close.
Only `is_live` setups belong in an opportunity list.

Once the stop is breached the trade is over: every horizon at or after the stop
session reports the stop-loss return, never a later close the position never saw.
A bar that both breaches the stop and completes a horizon counts as STOPPED
(the conservative assumption — intraday we cannot know which came first).

Mirrors alpha_zone.py's shape: a plain `build_ipo_vintage_result(...) ->
Optional[dict]` plus a local, transparent scorer. No model, no fundamentals, no
subscription/GMP data — this is pure price action on the first-day range.
"""

from __future__ import annotations

import pandas as pd

HORIZONS = (7, 15, 30, 60, 90)  # trading sessions from entry — fixed, time-based exits
HOLDING_PERIOD = "7-90"

# How many sessions a trigger stays ACTIONABLE.
#
# The trigger is a one-time historical event: entry was the close of that one
# session. Once it is far enough behind us, the setup is a record of what
# happened, NOT a trade anyone can still take — the entry price is stale and
# the move has already played out. Such setups are marked `expired` and are
# kept strictly out of the live list; they only ever appear in the isolated
# track record.
#
# This is why a stock that listed years ago, crossed its opening high once
# early on, and has been drifting ever since must never surface as an
# opportunity — and why a LATER re-cross does not resurrect it either: the
# trigger scan takes only the FIRST close above the opening high, so a
# re-cross is not a new signal.
LIVE_WINDOW_SESSIONS = 30

# Universe bound. The 90-session horizon needs ~130 calendar days AFTER the
# trigger, and the trigger itself can arrive weeks after listing (90th pct ~58
# sessions). At 180 days most rows would age out before their longest horizon
# ever resolved, so the tracked window is deliberately generous.
MAX_LISTING_AGE_DAYS = 400

# If the first available bar is more than this many calendar days after the
# stated listing date, the listing candle is genuinely missing from the OHLC
# history — we must NOT silently substitute a later bar as the opening range.
MAX_LISTING_GAP_DAYS = 7

# Trigger-day volume vs the preceding N-session average, for volume confirmation.
VOL_LOOKBACK = 5


def _clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))


def _breakout_strength_score(pct: float) -> float:
    """How decisively the trigger close cleared the opening-candle HIGH.
    0% → 0, ramping to 100 by +8%."""
    return _clamp(pct / 8.0 * 100.0)


def _risk_quality_score(risk_pct: float) -> float:
    """INVERSE of risk — a tight stop scores high. 100 at <=5% risk, decaying
    linearly to 0 at 25%. This carries the most weight because the opening-candle
    stop is the dominant risk in this setup: a 20%-risk setup is materially worse
    than an 8%-risk one at identical breakout strength."""
    if risk_pct <= 5.0:
        return 100.0
    if risk_pct >= 25.0:
        return 0.0
    return _clamp((25.0 - risk_pct) / 20.0 * 100.0)


def _volume_score(ratio: float | None) -> float:
    """Trigger-session volume vs the prior VOL_LOOKBACK-session average.
    1.0x → 50 (neutral), 100 by 2.5x. None → neutral."""
    if ratio is None:
        return 50.0
    return _clamp(50.0 + (ratio - 1.0) / 1.5 * 50.0)


# Weights sum to 1.0. `actionability`/freshness is deliberately NOT a component —
# freshness is a filter (`setup_status`), not a quality signal; folding it in made
# stale-but-good setups look worse than fresh-but-weak ones.
_WEIGHTS = {"breakout_strength": 0.35, "risk_quality": 0.40, "volume": 0.25}


def score_ipo_vintage(
    breakout_strength_pct: float,
    risk_pct: float,
    volume_ratio: float | None,
) -> tuple[float, dict]:
    """Return (confidence 0-100, named sub-score breakdown). Purely rule-based —
    there is no trained model anywhere in this strategy."""
    subs = {
        "breakout_strength": round(_breakout_strength_score(breakout_strength_pct), 1),
        "risk_quality": round(_risk_quality_score(risk_pct), 1),
        "volume": round(_volume_score(volume_ratio), 1),
    }
    confidence = sum(subs[k] * _WEIGHTS[k] for k in _WEIGHTS)
    return round(_clamp(confidence), 1), subs


def strength_label(confidence: float) -> str:
    if confidence >= 75:
        return "Strong"
    if confidence >= 55:
        return "Medium"
    return "Weak"


def build_ipo_vintage_result(
    *,
    symbol: str,
    company_name: str,
    df: pd.DataFrame,
    listing_date,
    issue_price: float | None = None,
    max_age_days: int | None = MAX_LISTING_AGE_DAYS,
) -> dict | None:
    """
    Evaluate one tracked listing. Returns None (no signal) when:
      - the OHLC history has no bar within MAX_LISTING_GAP_DAYS of `listing_date`
        (the listing candle is missing — a data-coverage gap, not a non-signal;
        the caller counts these separately),
      - the listing has aged out of `max_age_days`, or
      - no session after the opening candle has yet CLOSED above its HIGH.

    `max_age_days=None` disables the age bound. The historical study uses that to
    evaluate every listing in the price history through the EXACT same code path
    as the live scanner — if the study ran on its own reimplementation, it would
    not be evidence about this scanner.
    """
    if df is None or df.empty or listing_date is None:
        return None

    d = df.sort_values("Date").reset_index(drop=True)
    d["_date"] = pd.to_datetime(d["Date"]).dt.normalize()
    listing_ts = pd.to_datetime(listing_date).normalize()

    # ── Opening candle: first traded session on/after the listing date ────────
    on_or_after = d.index[d["_date"] >= listing_ts]
    if len(on_or_after) == 0:
        return None
    i0 = int(on_or_after[0])
    if (d.loc[i0, "_date"] - listing_ts).days > MAX_LISTING_GAP_DAYS:
        return None  # listing candle genuinely absent — do NOT use a later bar

    last_idx = len(d) - 1
    if (
        max_age_days is not None
        and (d["_date"].iloc[last_idx] - listing_ts).days > max_age_days
    ):
        return None  # aged out of the tracked vintage window

    opening_high = float(d.loc[i0, "High"])
    opening_low = float(d.loc[i0, "Low"])
    opening_close = float(d.loc[i0, "Close"])
    if opening_high <= 0 or opening_low <= 0 or opening_high <= opening_low:
        return None

    # ── Entry trigger: first session AFTER the opening candle closing > high ──
    trigger_idx: int | None = None
    for i in range(i0 + 1, last_idx + 1):
        if float(d.loc[i, "Close"]) > opening_high:
            trigger_idx = i
            break
    if trigger_idx is None:
        return None  # hasn't broken the first-day range yet — no signal

    entry = float(d.loc[trigger_idx, "Close"])
    stop_loss = opening_low
    risk_pct = round((entry - stop_loss) / entry * 100.0, 2)
    breakout_strength_pct = round((entry - opening_high) / opening_high * 100.0, 2)
    trigger_date = d.loc[trigger_idx, "_date"]

    # ── Stop-hit scan: first session after entry whose LOW <= stop ────────────
    stop_idx: int | None = None
    for i in range(trigger_idx + 1, last_idx + 1):
        if float(d.loc[i, "Low"]) <= stop_loss:
            stop_idx = i
            break
    stop_hit = stop_idx is not None
    stop_return_pct = round((stop_loss - entry) / entry * 100.0, 2)  # negative

    # ── Volume confirmation (prior sessions, never crossing the opening bar) ──
    vol_ratio: float | None = None
    lo = max(i0, trigger_idx - VOL_LOOKBACK)
    if trigger_idx > lo and "Volume" in d.columns:
        prior_avg = float(d.loc[lo : trigger_idx - 1, "Volume"].mean())
        if prior_avg > 0:
            vol_ratio = round(float(d.loc[trigger_idx, "Volume"]) / prior_avg, 2)

    # ── Horizons ─────────────────────────────────────────────────────────────
    # Stop is checked BEFORE the horizon on the same bar: a bar that both
    # breaches the stop and completes a horizon counts as stopped.
    horizons: dict[str, dict] = {}
    for h in HORIZONS:
        key = f"h{h}"
        target_idx = trigger_idx + h
        if stop_hit and stop_idx <= target_idx:
            horizons[key] = {
                "status": "stopped",
                "exit_date": d.loc[stop_idx, "_date"].strftime("%Y-%m-%d"),
                "exit_price": round(stop_loss, 2),
                "return_pct": stop_return_pct,
                "days_remaining": None,
            }
        elif target_idx <= last_idx:
            exit_price = float(d.loc[target_idx, "Close"])
            horizons[key] = {
                "status": "resolved",
                "exit_date": d.loc[target_idx, "_date"].strftime("%Y-%m-%d"),
                "exit_price": round(exit_price, 2),
                "return_pct": round((exit_price - entry) / entry * 100.0, 2),
                "days_remaining": None,
            }
        else:
            horizons[key] = {
                "status": "pending",
                "exit_date": None,
                "exit_price": None,
                "return_pct": None,
                "days_remaining": target_idx - last_idx,
            }

    # ── Excursions over the holding window ───────────────────────────────────
    # Starts at trigger_idx + 1, NOT the trigger bar. Entry is that bar's CLOSE,
    # so its own intraday swing happened before the position existed — counting
    # it would report a drawdown on a trade that has not yet moved (a setup that
    # triggered today would show the trigger day's full range as "heat taken").
    win_end = min(
        stop_idx if stop_hit else last_idx, trigger_idx + HORIZONS[-1], last_idx
    )
    win = d.loc[trigger_idx + 1 : win_end]

    if win.empty:
        # Triggered on the latest bar — nothing has happened to the position yet.
        mae_pct = mfe_pct = max_drawdown_pct = 0.0
    else:
        lowest_low = float(win["Low"].min())
        if stop_hit:
            lowest_low = max(
                lowest_low, stop_loss
            )  # floor MAE at the stop — we exited there
        highest_high = float(win["High"].max())
        # Excursions are measured against ENTRY, so a position that only ever went
        # up has MAE 0 (not a positive number) and vice versa.
        mae_pct = round(min(0.0, (lowest_low - entry) / entry * 100.0), 2)
        mfe_pct = round(max(0.0, (highest_high - entry) / entry * 100.0), 2)

        # Peak-to-trough, measured INTRADAY (running high watermark vs subsequent
        # lows) rather than close-to-close. The stop is an intraday event, so a
        # close-based drawdown could report 0% on a trade that was actually
        # stopped out — the two numbers must not be able to contradict.
        lows = win["Low"].copy()
        if stop_hit:
            lows = lows.clip(lower=stop_loss)  # exited at the stop; no deeper
        running_peak = win["High"].cummax().clip(lower=entry)  # peak starts at entry
        dd = (lows - running_peak) / running_peak * 100.0
        max_drawdown_pct = round(float(min(0.0, dd.min())), 2)

    days_since_trigger = last_idx - trigger_idx
    current_price = float(d.loc[last_idx, "Close"])

    # Three mutually exclusive states. Only "live" is tradeable now:
    #   live    — triggered within LIVE_WINDOW_SESSIONS and never stopped out
    #   stopped — the opening-candle low was breached; the trade is closed
    #   expired — never stopped, but the trigger is too old to act on
    if stop_hit:
        setup_status = "stopped"
        unrealized_return_pct = stop_return_pct
    else:
        unrealized_return_pct = round((current_price - entry) / entry * 100.0, 2)
        setup_status = (
            "live" if days_since_trigger <= LIVE_WINDOW_SESSIONS else "expired"
        )
    is_live = setup_status == "live"

    confidence, breakdown = score_ipo_vintage(
        breakout_strength_pct, risk_pct, vol_ratio
    )

    return {
        "symbol": symbol,
        "company_name": company_name or symbol,
        "strategy": "ipo_vintage",
        "listing_date": listing_ts.strftime("%Y-%m-%d"),
        "issue_price": round(float(issue_price), 2) if issue_price else None,
        "opening_high": round(opening_high, 2),
        "opening_low": round(opening_low, 2),
        "opening_close": round(opening_close, 2),
        "trigger_date": trigger_date.strftime("%Y-%m-%d"),
        "entry": round(entry, 2),
        "entry_session": trigger_idx - i0,
        "stop_loss": round(stop_loss, 2),
        "risk_pct": risk_pct,
        "breakout_strength_pct": breakout_strength_pct,
        "cmp": round(current_price, 2),
        "unrealized_return_pct": unrealized_return_pct,
        "stop_hit": stop_hit,
        "stop_hit_date": d.loc[stop_idx, "_date"].strftime("%Y-%m-%d")
        if stop_hit
        else None,
        "stop_hit_session": (stop_idx - trigger_idx) if stop_hit else None,
        "mae_pct": mae_pct,
        "mfe_pct": mfe_pct,
        "max_drawdown_pct": max_drawdown_pct,
        "volume_ratio": vol_ratio,
        "days_since_trigger": days_since_trigger,
        "sessions_left_in_window": max(0, LIVE_WINDOW_SESSIONS - days_since_trigger)
        if is_live
        else 0,
        "is_live": is_live,  # the single flag the UI keys on
        "setup_status": setup_status,  # "live" | "stopped" | "expired"
        "confidence": confidence,
        "confidence_breakdown": breakdown,
        "signal_strength": strength_label(confidence),
        "holding_period": HOLDING_PERIOD,
        "horizons": horizons,
    }
