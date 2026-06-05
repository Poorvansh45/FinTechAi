"""
FinAI Edge — TA-Lib Indicator Engine
======================================
Vectorized technical indicator calculations.

Indicators computed:
  - RSI(14)
  - EMA(50), EMA(200)
  - EMA50 Distance %  = (close - EMA50)  / EMA50  * 100
  - EMA200 Distance % = (close - EMA200) / EMA200 * 100
  - MACD(12,26,9), Signal, Histogram

EMA Distance % is the correct way to filter EMAs across a 2000-stock
universe — absolute EMA values are meaningless when comparing a ₹50 stock
to a ₹5000 stock.
"""

import logging
import math
import pandas as pd

try:
    import talib
except ImportError:
    talib = None

log = logging.getLogger("finai_edge.talib_engine")


def safe_float(val) -> float | None:
    try:
        f = float(val)
        return None if (math.isnan(f) or math.isinf(f)) else round(f, 4)
    except Exception:
        return None


def compute_technical_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes technical indicators for a single stock's historical DataFrame.
    Expects columns: 'close' (required), 'high', 'low', 'volume' (optional)

    Returns df with added columns:
      RSI_14, EMA_50, EMA_200,
      EMA_50_DIST_PCT, EMA_200_DIST_PCT,
      MACD, MACD_Signal, MACD_Hist
    """
    if df.empty or len(df) < 50:
        log.warning("DataFrame too small to compute accurate indicators.")
        return df

    if not talib:
        log.warning("TA-Lib not installed. Skipping technical indicators.")
        return df

    try:
        close_col = "close" if "close" in df.columns else "Close"
        close_px  = pd.to_numeric(df[close_col], errors="coerce").ffill()

        df["RSI_14"]  = talib.RSI(close_px, timeperiod=14)
        df["EMA_50"]  = talib.EMA(close_px, timeperiod=50)
        df["EMA_200"] = talib.EMA(close_px, timeperiod=200)

        # % distance: works identically for ₹50 and ₹5000 stocks
        df["EMA_50_DIST_PCT"]  = ((close_px - df["EMA_50"])  / df["EMA_50"])  * 100
        df["EMA_200_DIST_PCT"] = ((close_px - df["EMA_200"]) / df["EMA_200"]) * 100

        macd, macdsignal, macdhist = talib.MACD(
            close_px, fastperiod=12, slowperiod=26, signalperiod=9
        )
        df["MACD"]       = macd
        df["MACD_Signal"] = macdsignal
        df["MACD_Hist"]  = macdhist

        return df

    except Exception as e:
        log.error(f"Error computing TA-Lib indicators: {e}")
        return df


def compute_indicators_from_series(close_arr) -> dict:
    """
    Convenience: given a numpy close array, return a dict of latest indicator values.
    Used by ingest scripts.
    """
    if not talib or len(close_arr) < 50:
        return {}

    try:
        rsi_14  = safe_float(talib.RSI(close_arr, timeperiod=14)[-1])
        ema_50  = safe_float(talib.EMA(close_arr, timeperiod=50)[-1])
        ema_200 = safe_float(talib.EMA(close_arr, timeperiod=200)[-1])
        close   = safe_float(close_arr[-1])

        ema_50_dist  = safe_float(((close_arr[-1] - talib.EMA(close_arr, timeperiod=50)[-1])  / talib.EMA(close_arr, timeperiod=50)[-1])  * 100) if ema_50 else None
        ema_200_dist = safe_float(((close_arr[-1] - talib.EMA(close_arr, timeperiod=200)[-1]) / talib.EMA(close_arr, timeperiod=200)[-1]) * 100) if ema_200 else None

        macd_v, macd_sig, macd_hist_v = talib.MACD(close_arr, 12, 26, 9)
        macd        = safe_float(macd_v[-1])
        macd_signal = safe_float(macd_sig[-1])
        macd_hist   = safe_float(macd_hist_v[-1])

        return {
            "rsi_14":          rsi_14,
            "ema_50":          ema_50,
            "ema_200":         ema_200,
            "ema_50_dist_pct":  ema_50_dist,
            "ema_200_dist_pct": ema_200_dist,
            "macd":            macd,
            "macd_signal":     macd_signal,
            "macd_hist":       macd_hist,
        }
    except Exception as e:
        log.error(f"compute_indicators_from_series error: {e}")
        return {}
