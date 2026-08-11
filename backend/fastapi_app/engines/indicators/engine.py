"""
IndicatorEngine — computes the full indicator set for one symbol, once.

Returns latest-bar values using the canonical `ema`/`rsi`/`macd`/`atr`/volume
functions. The daily scan and any query-time strategy consume this instead of
recomputing EMA/RSI/MACD themselves (the previous duplication).
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass

import pandas as pd

from .atr import atr, atr_pct
from .ema import ema, ema_distance_pct
from .macd import macd
from .rsi import rsi
from .volume import avg_volume, volume_ratio


def _safe(v) -> float | None:
    try:
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else round(f, 4)
    except Exception:
        return None


@dataclass
class IndicatorSet:
    price: float | None = None
    ema_9: float | None = None
    ema_50: float | None = None
    ema_200: float | None = None
    ema_50_dist_pct: float | None = None
    ema_200_dist_pct: float | None = None
    rsi_14: float | None = None
    macd: float | None = None
    macd_signal: float | None = None
    macd_hist: float | None = None
    atr_14: float | None = None
    atr_pct: float | None = None
    avg_volume_20: float | None = None
    volume: float | None = None
    volume_ratio: float | None = None

    def as_dict(self) -> dict:
        return asdict(self)


class IndicatorEngine:
    """Stateless; call `compute(df)` per symbol."""

    @staticmethod
    def compute(df: pd.DataFrame) -> IndicatorSet:
        cols = {c.lower(): c for c in df.columns}
        if "close" not in cols or len(df) == 0:
            return IndicatorSet()

        close = pd.to_numeric(df[cols["close"]], errors="coerce")
        price = _safe(close.iloc[-1])

        ema_9 = ema(close, 9)
        ema_50 = ema(close, 50)
        ema_200 = ema(close, 200)
        macd_res = macd(close)
        rsi_series = rsi(close, 14)

        e50 = _safe(ema_50.iloc[-1])
        e200 = _safe(ema_200.iloc[-1])

        vol_series = (
            pd.to_numeric(df[cols["volume"]], errors="coerce")
            if "volume" in cols
            else None
        )
        avg_vol_20 = (
            _safe(avg_volume(vol_series, 20).iloc[-1])
            if vol_series is not None
            else None
        )
        cur_vol = _safe(vol_series.iloc[-1]) if vol_series is not None else None

        atr_val = None
        if all(c in cols for c in ("high", "low", "close")) and len(df) > 14:
            atr_val = _safe(atr(df, 14).iloc[-1])

        return IndicatorSet(
            price=price,
            ema_9=_safe(ema_9.iloc[-1]),
            ema_50=e50,
            ema_200=e200,
            ema_50_dist_pct=ema_distance_pct(price, e50) if price is not None else None,
            ema_200_dist_pct=ema_distance_pct(price, e200)
            if price is not None
            else None,
            rsi_14=_safe(rsi_series.iloc[-1]),
            macd=_safe(macd_res.macd.iloc[-1]),
            macd_signal=_safe(macd_res.signal.iloc[-1]),
            macd_hist=_safe(macd_res.hist.iloc[-1]),
            atr_14=atr_val,
            atr_pct=atr_pct(atr_val, price),
            avg_volume_20=avg_vol_20,
            volume=cur_vol,
            volume_ratio=volume_ratio(cur_vol, avg_vol_20),
        )
