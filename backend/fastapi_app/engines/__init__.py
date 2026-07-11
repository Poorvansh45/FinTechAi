"""
FinTechAI — Reusable Scanner Engines
=====================================
Clean, layered engines that every scanner/strategy reuses:

    Indicator Engine  → EMA / RSI / MACD / ATR / volume (one canonical impl)
    Pattern Engine    → FVG, order blocks (pure OHLCV pattern detection)
    Strategy Engine   → LaunchPad / Alpha Zone (compose indicators + patterns)
    Ranking Engine    → explainable confidence / quality scoring

No strategy computes an indicator or detects a pattern directly — they consume
these engines. See docs in each subpackage.
"""
