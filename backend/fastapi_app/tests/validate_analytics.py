#!/usr/bin/env python3
"""
FinAI Edge — Analytics Validation Script
==========================================
Verifies all analytics calculations produce correct results with known inputs.
Run from:  backend/fastapi_app/
    python tests/validate_analytics.py

All tests are deterministic (fixed seed). No network calls.
Exit code 0 = all passed. Exit code 1 = failures.
"""
import sys
import numpy as np
import pandas as pd

np.random.seed(42)

PASS = "PASS"
FAIL = "FAIL"
WARN = "WARN"

results: list[dict] = []


def record(name: str, status: str, detail: str = ""):
    results.append({"name": name, "status": status, "detail": detail})
    icon = {"PASS": "v", "FAIL": "X", "WARN": "!"}.get(status, "?")
    line = f"  [{icon}] {name}"
    if detail:
        line += f"  ->  {detail}"
    print(line)


def check(name: str, condition: bool, detail: str = "", warn_only=False):
    if condition:
        record(name, PASS, detail)
    elif warn_only:
        record(name, WARN, detail)
    else:
        record(name, FAIL, detail)


# ============================================================
# 1. Import Checks
# ============================================================
print("\n" + "=" * 55)
print("1. IMPORTS")
print("=" * 55)

try:
    from analytics.risk_engine import (
        compute_portfolio_volatility, compute_portfolio_return,
        compute_sharpe_ratio, compute_var, compute_max_drawdown,
        compute_beta, estimate_risk_level, compute_safe_covariance,
        compute_correlation_matrix, compute_sortino_ratio,
        compute_treynor_ratio, compute_cagr_from_prices,
    )
    record("analytics.risk_engine", PASS)
except Exception as e:
    record("analytics.risk_engine", FAIL, str(e)); sys.exit(1)

try:
    from analytics.diversification import (
        compute_diversification_score, compute_herfindahl_index,
        compute_effective_number_of_stocks, compute_concentration_score,
    )
    record("analytics.diversification", PASS)
except Exception as e:
    record("analytics.diversification", FAIL, str(e)); sys.exit(1)

try:
    from analytics.health_score import compute_portfolio_health
    record("analytics.health_score", PASS)
except Exception as e:
    record("analytics.health_score", FAIL, str(e)); sys.exit(1)

try:
    from analytics.sector_analysis import (
        compute_sector_exposure, compute_sector_concentration, detect_sector_bias,
    )
    record("analytics.sector_analysis", PASS)
except Exception as e:
    record("analytics.sector_analysis", FAIL, str(e)); sys.exit(1)

try:
    from analytics.rebalancer import generate_rebalance_suggestions
    record("analytics.rebalancer", PASS)
except Exception as e:
    record("analytics.rebalancer", FAIL, str(e)); sys.exit(1)

try:
    from portfolio.calculator import (
        compute_cagr, compute_all_holdings, generate_insights,
    )
    record("portfolio.calculator", PASS)
except Exception as e:
    record("portfolio.calculator", FAIL, str(e)); sys.exit(1)


# ============================================================
# 2. Risk Engine Tests
# ============================================================
print("\n" + "=" * 55)
print("2. RISK ENGINE")
print("=" * 55)

weights = np.array([0.40, 0.35, 0.25])
returns_data = {
    "RELIANCE.NS": np.random.normal(0.0009, 0.016, 500),
    "TCS.NS":      np.random.normal(0.0008, 0.013, 500),
    "HDFCBANK.NS": np.random.normal(0.0007, 0.011, 500),
}
returns_df = pd.DataFrame(returns_data)
nifty_returns = np.random.normal(0.0006, 0.012, 500)

cov = compute_safe_covariance(returns_df)
vol = compute_portfolio_volatility(weights, cov)
ret = compute_portfolio_return(weights, returns_df)
sharpe = compute_sharpe_ratio(ret, vol)
sortino = compute_sortino_ratio(returns_df, weights)
treynor = compute_treynor_ratio(ret, beta=1.05)
var_stats = compute_var(returns_df, weights)
max_dd = compute_max_drawdown(returns_df, weights)
port_daily = returns_df.values @ weights
beta = compute_beta(port_daily, nifty_returns)

check("volatility in [0, 1]", 0.0 < vol < 1.0, f"vol={vol:.4f}")
check("volatility annualized (>daily)", vol > 0.001, f"vol={vol:.4f}")
check("volatility realistic 5-50%", 0.05 < vol < 0.50, f"{vol*100:.1f}%", warn_only=True)
check("port_return is finite", np.isfinite(ret), f"ret={ret:.5f}")
check("port_return in realistic range", -0.5 < ret < 1.0, f"{ret*100:.2f}%")
check("sharpe is finite", np.isfinite(sharpe), f"sharpe={sharpe:.3f}")
check("sharpe in realistic range", -5 < sharpe < 5, f"{sharpe:.3f}", warn_only=True)
check("sortino >= sharpe - 0.5 (less penalty)", sortino >= sharpe - 0.5,
      f"sortino={sortino:.3f} sharpe={sharpe:.3f}")
check("treynor is finite", np.isfinite(treynor), f"treynor={treynor:.4f}")
check("var_95 key exists", "var_95" in var_stats)
check("var_99 key exists", "var_99" in var_stats)
check("VaR 95% is negative", var_stats["var_95"] < 0, f"var95={var_stats['var_95']:.5f}")
check("VaR 99% <= VaR 95%", var_stats["var_99"] <= var_stats["var_95"],
      f"var99={var_stats['var_99']:.5f}")
check("VaR 95% in plausible range", -0.20 < var_stats["var_95"] < 0,
      f"{var_stats['var_95']*100:.2f}%")
check("max_drawdown <= 0", max_dd <= 0, f"dd={max_dd:.5f}")
check("max_drawdown > -1", max_dd > -1.0, f"dd={max_dd:.5f}")
check("beta in [0, 3]", 0 < beta < 3.0, f"beta={beta:.3f}")

risk = estimate_risk_level(volatility=0.22, concentration_score=55, sector_concentration=38.0)
check("risk level keys present", all(k in risk for k in ["level", "score", "color", "factors"]))
check("risk score in [0, 100]", 0 <= risk["score"] <= 100, f"score={risk['score']}")
check("risk level valid string", risk["level"] in ["Low", "Moderate", "Elevated", "High"])
check("risk color is hex", risk["color"].startswith("#"))

risk_high = estimate_risk_level(volatility=0.45, concentration_score=90, sector_concentration=70)
risk_low  = estimate_risk_level(volatility=0.05, concentration_score=10, sector_concentration=15)
check("high inputs -> higher risk score", risk_high["score"] > risk_low["score"],
      f"high={risk_high['score']} low={risk_low['score']}")


# ============================================================
# 3. CAGR Tests
# ============================================================
print("\n" + "=" * 55)
print("3. CAGR")
print("=" * 55)

cagr_val = compute_cagr(100_000, 150_000, 3.0)
check("cagr positive for gain", cagr_val > 0, f"{cagr_val:.2f}%")
check("cagr ~14.47% for 1.5x in 3y", 13.0 < cagr_val < 16.0, f"{cagr_val:.2f}%")
check("cagr negative for loss", compute_cagr(100_000, 80_000, 2.0) < 0)
check("cagr = 0 for zero start", compute_cagr(0, 50_000, 1.0) == 0.0)

dates = pd.date_range("2022-01-01", periods=504, freq="B")
price_s = pd.Series(np.cumprod(1 + np.random.normal(0.0006, 0.015, 504)) * 100, index=dates)
cagr_p = compute_cagr_from_prices(price_s)
check("cagr_from_prices finite", np.isfinite(cagr_p), f"{cagr_p:.4f}")
check("cagr_from_prices realistic", -0.5 < cagr_p < 2.0, f"{cagr_p*100:.1f}%")


# ============================================================
# 4. Diversification + Concentration
# ============================================================
print("\n" + "=" * 55)
print("4. DIVERSIFICATION & CONCENTRATION")
print("=" * 55)

div = compute_diversification_score(weights, cov)
check("diversification_score in [0,100]", 0 <= div <= 100, f"score={div}")
check("diversification_score > 0", div > 0, f"score={div}")
check("single stock diversification = 0",
      compute_diversification_score(np.array([1.0]), np.array([[0.04]])) == 0.0)

check("equal-weight HHI < 5", compute_herfindahl_index([25]*4) < 5.0)
check("single holding HHI = 100", compute_herfindahl_index([100.0]) == 100.0)
check("skewed HHI > equal HHI",
      compute_herfindahl_index([70, 15, 10, 5]) > compute_herfindahl_index([25]*4))

eff = compute_effective_number_of_stocks([25]*4)
check("effective stocks = 4 for equal-weight 4-stock", 3.8 < eff < 4.2, f"eff={eff}")
check("effective stocks = 1 for single holding",
      0.9 < compute_effective_number_of_stocks([100.0]) < 1.1)

conc = compute_concentration_score([40, 30, 20, 10])
check("concentration has required keys",
      all(k in conc for k in ["hhi", "effective_stocks", "top_holding_pct", "score"]))
check("top_holding_pct = 40", abs(conc["top_holding_pct"] - 40.0) < 0.5, f"{conc['top_holding_pct']}")
check("top3_holding_pct = 90", abs(conc["top3_holding_pct"] - 90.0) < 0.5, f"{conc['top3_holding_pct']}")
check("concentration score in [0,100]", 0 <= conc["score"] <= 100, f"{conc['score']}")
check("concentration level valid", conc["concentration_level"] in ["low", "moderate", "high"])


# ============================================================
# 5. Health Score
# ============================================================
print("\n" + "=" * 55)
print("5. HEALTH SCORE")
print("=" * 55)

h_strong = compute_portfolio_health(80, 20, 75, 70, stock_count=8)
h_weak   = compute_portfolio_health(10, 85, 15, 20, stock_count=1)
h_mid    = compute_portfolio_health(50, 45, 50, 50, stock_count=5)

check("strong score >= 75", h_strong["score"] >= 75, f"score={h_strong['score']}")
check("strong label = 'Strong'", h_strong["label"] == "Strong")
check("weak score < 58", h_weak["score"] < 58, f"score={h_weak['score']}")
check("strong > mid > weak", h_strong["score"] > h_mid["score"] > h_weak["score"],
      f"{h_strong['score']} > {h_mid['score']} > {h_weak['score']}")
check("breakdown has 4 keys", len(h_strong["breakdown"]) == 4)
check("breakdown values in [0,100]", all(0 <= v <= 100 for v in h_strong["breakdown"].values()))


# ============================================================
# 6. Sector Analysis
# ============================================================
print("\n" + "=" * 55)
print("6. SECTOR ANALYSIS")
print("=" * 55)

holdings_s = [
    {"ticker": "RELIANCE.NS", "name": "Reliance", "value": 60000, "allocation": 40, "sector": "Energy"},
    {"ticker": "TCS.NS",      "name": "TCS",      "value": 52500, "allocation": 35, "sector": "IT"},
    {"ticker": "HDFCBANK.NS", "name": "HDFC",     "value": 37500, "allocation": 25, "sector": "Banking"},
]
exposure = compute_sector_exposure(holdings_s)
w_sum = sum(e["weight_pct"] for e in exposure)

check("sector count = 3", len(exposure) == 3)
check("weights sum to 100%", abs(w_sum - 100.0) < 0.5, f"sum={w_sum:.1f}%")
check("sorted by weight desc", exposure[0]["weight_pct"] >= exposure[-1]["weight_pct"])
check("required sector fields",
      all(all(k in e for k in ["sector", "weight_pct", "stock_count"]) for e in exposure))

sc = compute_sector_concentration(exposure)
check("top_sector_pct = 40", abs(sc["top_sector_pct"] - 40.0) < 0.5)
check("sector_count = 3", sc["sector_count"] == 3)
check("score in [0,100]", 0 <= sc["score"] <= 100)

bias = detect_sector_bias(exposure)
check("bias has required keys",
      all(k in bias for k in ["defensive_weight", "aggressive_weight", "bias"]))
check("bias is valid string", bias["bias"] in ["defensive", "balanced", "aggressive"])
total_w = bias["defensive_weight"] + bias["aggressive_weight"] + bias["neutral_weight"]
check("bias weights sum to ~100", abs(total_w - 100.0) < 1.0, f"sum={total_w:.1f}%")


# ============================================================
# 7. Portfolio Calculator
# ============================================================
print("\n" + "=" * 55)
print("7. PORTFOLIO CALCULATOR")
print("=" * 55)

raw = [
    {"ticker": "RELIANCE.NS", "name": "Reliance", "quantity": 10, "avg_buy_price": 2800, "current_price": 3000},
    {"ticker": "TCS.NS",      "name": "TCS",      "quantity": 5,  "avg_buy_price": 3500, "current_price": 3700},
    {"ticker": "HDFCBANK.NS", "name": "HDFC",     "quantity": 15, "avg_buy_price": 1500, "current_price": 1650},
]
enriched, totals = compute_all_holdings(raw)
expected_pnl = 10*200 + 5*200 + 15*150  # 2000 + 1000 + 2250 = 5250

check("holdings count = 3", len(enriched) == 3)
check("total_pnl positive", totals["total_pnl"] > 0, f"pnl={totals['total_pnl']}")
check("total_pnl accurate", abs(totals["total_pnl"] - expected_pnl) < 1.0,
      f"expected={expected_pnl} got={totals['total_pnl']}")
check("allocations sum to 100%", abs(sum(h["allocation"] for h in enriched) - 100.0) < 0.5)
check("total_value matches sum", abs(totals["total_value"] - sum(h["value"] for h in enriched)) < 0.01)

empty_e, empty_t = compute_all_holdings([])
check("empty holdings -> empty list", len(empty_e) == 0)
check("empty holdings -> zero totals", empty_t["total_value"] == 0)


# ============================================================
# 8. Rebalancer
# ============================================================
print("\n" + "=" * 55)
print("8. REBALANCER")
print("=" * 55)

current_w = {"RELIANCE.NS": 55.0, "TCS.NS": 30.0, "HDFCBANK.NS": 15.0}
sugs = generate_rebalance_suggestions(current_weights=current_w, sector_exposure=exposure)

check("returns list", isinstance(sugs, list))
check("at least 1 suggestion for concentrated", len(sugs) >= 1, f"got {len(sugs)}")
trim_s = [s for s in sugs if s["action"] == "trim" and "RELIANCE" in s["ticker"]]
check("trim suggestion for 55% holding", len(trim_s) >= 1)

equal_w = {"A": 25.0, "B": 25.0, "C": 25.0, "D": 25.0}
equal_s = generate_rebalance_suggestions(current_weights=equal_w)
check("equal-weight has 0 drift suggestions",
      len([s for s in equal_s if s["category"] == "drift"]) == 0)

p_map = {"high": 0, "medium": 1, "low": 2}
priorities = [s["priority"] for s in sugs]
check("sorted high->low priority",
      all(p_map[priorities[i]] <= p_map[priorities[i+1]] for i in range(len(priorities)-1)),
      f"{priorities}")


# ============================================================
# 9. Edge Cases
# ============================================================
print("\n" + "=" * 55)
print("9. EDGE CASES")
print("=" * 55)

check("volatility empty weights = 0.0",
      compute_portfolio_volatility(np.array([]), np.array([[]])) == 0.0)
check("max_drawdown empty = 0.0",
      compute_max_drawdown(pd.DataFrame(), np.array([])) == 0.0)
check("var empty = defaults",
      compute_var(pd.DataFrame(), np.array([])) == {"var_95": 0.0, "var_99": 0.0, "var_95_annual": 0.0, "var_99_annual": 0.0})
check("beta short series = 1.0",
      compute_beta(np.array([0.01]), np.array([0.01])) == 1.0)
check("sharpe zero vol = 0.0", compute_sharpe_ratio(0.12, 0.0) == 0.0)
check("cagr_from_prices empty = 0.0", compute_cagr_from_prices(pd.Series([])) == 0.0)
check("concentration empty -> high",
      compute_concentration_score([])["concentration_level"] == "high")
check("sector exposure empty -> []", compute_sector_exposure([]) == [])


# ============================================================
# SUMMARY
# ============================================================
print("\n" + "=" * 55)
print("SUMMARY")
print("=" * 55)

passes = sum(1 for r in results if r["status"] == PASS)
fails  = sum(1 for r in results if r["status"] == FAIL)
warns  = sum(1 for r in results if r["status"] == WARN)
total  = len(results)

print(f"  Total  : {total}")
print(f"  Passed : {passes}")
print(f"  Warned : {warns}  (non-blocking)")
print(f"  FAILED : {fails}")

if fails:
    print("\nFailed:")
    for r in results:
        if r["status"] == FAIL:
            print(f"  [X] {r['name']}: {r['detail']}")

if warns:
    print("\nWarnings:")
    for r in results:
        if r["status"] == WARN:
            print(f"  [!] {r['name']}: {r['detail']}")

print()
if fails == 0:
    print("All analytics calculations verified. Phase 1 backend PASSED.")
else:
    print(f"{fails} failure(s) found. Fix before deployment.")
    sys.exit(1)
