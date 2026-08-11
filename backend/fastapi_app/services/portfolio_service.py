"""
FinAI Edge — Portfolio Analytics Service
==========================================
Orchestrates calculator + analytics engines + market data for
comprehensive portfolio analysis. Server-side computation layer.
"""

import asyncio
import logging
import time

import numpy as np

from analytics import (
    compute_beta,
    compute_cagr_from_prices,
    compute_concentration_score,
    compute_correlation_matrix,
    compute_diversification_score,
    compute_max_drawdown,
    compute_portfolio_health,
    compute_portfolio_return,
    compute_portfolio_volatility,
    compute_safe_covariance,
    compute_sector_concentration,
    compute_sector_exposure,
    compute_sharpe_ratio,
    compute_sortino_ratio,
    compute_treynor_ratio,
    compute_var,
    detect_sector_bias,
    estimate_risk_level,
    generate_rebalance_suggestions,
)
from config import get_settings
from portfolio.calculator import (
    compute_all_holdings,
    compute_cagr,
    generate_insights,
)
from services.market_service import get_market_service

log = logging.getLogger("finai_edge.portfolio_service")

NIFTY50_TICKER = "^NSEI"
TRADING_DAYS = 252
ANALYSIS_TIMEOUT = 90.0  # seconds — hard ceiling for any analyze_holdings call


class PortfolioService:
    """
    Unified portfolio analysis service.
    Ties together: calculator → analytics → market data → insights.
    """

    def __init__(self):
        self._settings = get_settings()

    async def analyze_holdings(self, holdings: list[dict]) -> dict:
        """Timeout-wrapped entry point for holdings analysis (90 s hard limit)."""
        start = time.perf_counter()
        try:
            result = await asyncio.wait_for(
                self._analyze_holdings_impl(holdings),
                timeout=ANALYSIS_TIMEOUT,
            )
            elapsed = time.perf_counter() - start
            log.info(
                f"analyze_holdings completed in {elapsed:.2f}s "
                f"({len(holdings)} holdings, "
                f"health={result.get('health', {}).get('score', '?')}/100)"
            )
            return result
        except asyncio.TimeoutError:
            elapsed = time.perf_counter() - start
            log.error(
                f"analyze_holdings timed out after {elapsed:.1f}s "
                f"({len(holdings)} holdings) — returning partial result"
            )
            # Return a graceful partial response so the frontend doesn't see a 500
            enriched, totals = compute_all_holdings(holdings)
            return {
                **self._empty_response(),
                "holdings": enriched,
                "totals": totals,
                "insights": [
                    {
                        "title": "Analysis timed out",
                        "body": (
                            "The portfolio analysis took too long (market data may be slow). "
                            "Basic P&L is shown; refresh to retry full analytics."
                        ),
                        "tone": "warn",
                    }
                ],
            }
        except Exception:
            elapsed = time.perf_counter() - start
            log.exception(f"analyze_holdings failed after {elapsed:.2f}s")
            raise

    async def _analyze_holdings_impl(self, holdings: list[dict]) -> dict:
        """
        Full holdings-based analysis.

        Args:
            holdings: List of { ticker, name, quantity, avg_buy_price, current_price, sector? }

        Returns:
            Complete analysis dict matching HoldingsAnalysisResponse schema.
        """
        t0 = time.perf_counter()
        log.info(f"[portfolio] Analyzing {len(holdings)} holdings…")

        # ── Step 1: Basic holding stats + totals ────────────────────
        enriched, totals = compute_all_holdings(holdings)
        log.debug(f"  [step1] calc totals: {time.perf_counter() - t0:.2f}s")

        if not enriched:
            return self._empty_response()

        # ── Step 2: Sector analysis ─────────────────────────────────
        log.debug(f"  [step2] sector analysis start: {time.perf_counter() - t0:.2f}s")
        sector_exposure = compute_sector_exposure(enriched)
        sector_concentration = compute_sector_concentration(sector_exposure)
        sector_bias = detect_sector_bias(sector_exposure)

        # ── Step 3: Concentration analysis ──────────────────────────
        allocations = [h["allocation"] for h in enriched]
        concentration = compute_concentration_score(allocations)

        # ── Step 4: Try to fetch historical data for advanced metrics
        log.debug(f"  [step4] historical fetch start: {time.perf_counter() - t0:.2f}s")
        tickers = [h["ticker"] for h in enriched]
        market_service = get_market_service()

        risk_data = {
            "volatility": 0.0,
            "volatility_pct": 0.0,
            "sharpe_ratio": 0.0,
            "sortino_ratio": 0.0,
            "treynor_ratio": 0.0,
            "var_95": 0.0,
            "var_99": 0.0,
            "max_drawdown": 0.0,
            "max_drawdown_pct": 0.0,
            "beta": 1.0,
            "cagr": 0.0,
            "risk_level": estimate_risk_level(
                volatility=0.0,
                concentration_score=concentration.get("hhi", 50),
                sector_concentration=sector_concentration.get("top_sector_pct", 0),
            ),
            "data_source": "estimated",
        }

        diversification_score = 0.0

        try:
            prices = await market_service.get_bulk_prices(tickers, period="2y")

            if not prices.empty and len(prices) >= self._settings.min_history_days:
                log.info(
                    f"  Historical data: {len(prices)} days, {len(prices.columns)} tickers"
                )

                # Daily returns
                returns = prices.pct_change().dropna()

                if not returns.empty and len(returns) >= 20:
                    # Build weight vector aligned with price columns
                    weight_map = {}
                    for h in enriched:
                        weight_map[h["ticker"]] = h["allocation"] / 100.0

                    valid_tickers = [t for t in prices.columns if t in weight_map]
                    if len(valid_tickers) >= 2:
                        aligned_returns = returns[valid_tickers]
                        weights = np.array([weight_map[t] for t in valid_tickers])

                        # Normalize weights in case some tickers are missing
                        w_sum = weights.sum()
                        if w_sum > 0:
                            weights = weights / w_sum

                        # Covariance matrix
                        cov_matrix = compute_safe_covariance(aligned_returns)

                        # Core risk metrics
                        volatility = compute_portfolio_volatility(weights, cov_matrix)
                        port_return = compute_portfolio_return(weights, aligned_returns)
                        sharpe = compute_sharpe_ratio(port_return, volatility)
                        sortino = compute_sortino_ratio(aligned_returns, weights)
                        var_stats = compute_var(aligned_returns, weights)
                        max_dd = compute_max_drawdown(aligned_returns, weights)

                        # Beta vs Nifty 50
                        beta = 1.0
                        try:
                            nifty_prices = await market_service.get_bulk_prices(
                                [NIFTY50_TICKER], period="2y"
                            )
                            if not nifty_prices.empty:
                                nifty_returns = nifty_prices.pct_change().dropna()
                                if NIFTY50_TICKER in nifty_returns.columns:
                                    port_daily = aligned_returns.values @ weights
                                    port_daily = port_daily[np.isfinite(port_daily)]
                                    bench = nifty_returns[NIFTY50_TICKER].values
                                    beta = compute_beta(port_daily, bench)
                        except Exception as e:
                            log.warning(f"Beta calculation failed: {e}")

                        treynor = compute_treynor_ratio(port_return, beta)

                        # Diversification score
                        diversification_score = compute_diversification_score(
                            weights, cov_matrix
                        )

                        # CAGR from portfolio value series
                        port_prices = (aligned_returns + 1).cumprod()
                        port_value_series = (port_prices * weights).sum(axis=1)
                        cagr = compute_cagr_from_prices(port_value_series) * 100  # to %

                        # Risk level assessment
                        risk_level = estimate_risk_level(
                            volatility=volatility,
                            concentration_score=concentration.get("hhi", 50),
                            sector_concentration=sector_concentration.get(
                                "top_sector_pct", 0
                            ),
                            max_drawdown=max_dd,
                        )

                        risk_data = {
                            "volatility": round(volatility, 5),
                            "volatility_pct": round(volatility * 100, 2),
                            "sharpe_ratio": sharpe,
                            "sortino_ratio": sortino,
                            "treynor_ratio": treynor,
                            "var_95": var_stats.get("var_95", 0),
                            "var_99": var_stats.get("var_99", 0),
                            "var_95_annual": var_stats.get("var_95_annual", 0),
                            "var_99_annual": var_stats.get("var_99_annual", 0),
                            "max_drawdown": round(max_dd, 5),
                            "max_drawdown_pct": round(abs(max_dd) * 100, 2),
                            "beta": beta,
                            "cagr": round(cagr, 2),
                            "risk_level": risk_level,
                            "data_source": "historical",
                            "data_points": len(aligned_returns),
                        }

                        log.info(
                            f"  [risk] vol={risk_data['volatility_pct']}% "
                            f"sharpe={sharpe:.2f} beta={beta:.2f} "
                            f"CAGR={cagr:.1f}% elapsed={time.perf_counter() - t0:.1f}s"
                        )
        except Exception as e:
            log.warning(f"Historical analysis failed, using estimation: {e}")

        # If no historical data, estimate diversification from holdings count
        if diversification_score == 0.0:
            diversification_score = min(85, len(enriched) * 12)

        # ── Step 5: Health score ────────────────────────────────────
        log.debug(f"  [step5] health score: {time.perf_counter() - t0:.2f}s")
        health = compute_portfolio_health(
            diversification_score=diversification_score,
            risk_score=risk_data["risk_level"]["score"],
            concentration_score=concentration.get("score", 50),
            sector_balance_score=sector_concentration.get("score", 50),
            stock_count=len(enriched),
        )

        # ── Step 6: Rebalance suggestions ───────────────────────────
        log.debug(f"  [step6] rebalance: {time.perf_counter() - t0:.2f}s")
        current_weights = {h["ticker"]: h["allocation"] for h in enriched}
        rebalance = generate_rebalance_suggestions(
            current_weights=current_weights,
            sector_exposure=sector_exposure,
            health_data=health,
        )

        # ── Step 7: Insights ────────────────────────────────────────
        insights = generate_insights(
            holdings_stats=enriched,
            health=health,
            sector_exposure=sector_exposure,
            totals=totals,
        )

        # ── Step 8: CAGR from invested → current value ─────────────
        # If historical CAGR failed, estimate from P&L
        if risk_data.get("cagr", 0) == 0 and totals["total_invested"] > 0:
            # Assume ~1 year average holding period for estimation
            estimated_cagr = compute_cagr(
                totals["total_invested"],
                totals["total_value"],
                years=1.0,
            )
            risk_data["cagr"] = estimated_cagr
            risk_data["cagr_note"] = "estimated (assumes 1y holding period)"

        return {
            "holdings": enriched,
            "totals": totals,
            "sector_exposure": sector_exposure,
            "sector_concentration": sector_concentration,
            "sector_bias": sector_bias,
            "concentration": concentration,
            "risk": risk_data,
            "health": health,
            "rebalance_suggestions": rebalance,
            "insights": insights,
            "diversification_score": round(diversification_score, 1),
        }

    async def analyze_portfolio(
        self,
        tickers: list[str],
        weights: dict[str, float],
        risk_profile: str = "balanced",
    ) -> dict:
        """
        MPT-based portfolio optimization analysis.

        Args:
            tickers: list of ticker symbols
            weights: { ticker: weight_fraction } (should sum to ~1.0)
            risk_profile: 'conservative' | 'balanced' | 'aggressive'

        Returns:
            Full MPT analysis with efficient frontier, optimal portfolios, etc.
        """
        from scipy.optimize import minimize

        log.info(f"MPT analysis for {len(tickers)} tickers, profile={risk_profile}")

        market_service = get_market_service()
        prices = await market_service.get_bulk_prices(tickers, period="2y")

        if prices.empty:
            return {
                "error": "Could not fetch price data for any of the provided tickers."
            }

        # Filter to tickers that have data
        valid_tickers = [t for t in tickers if t in prices.columns]
        failed_tickers = [t for t in tickers if t not in prices.columns]

        if len(valid_tickers) < 2:
            return {
                "error": f"Need at least 2 valid tickers. Only got data for: {valid_tickers}",
                "failedTickers": failed_tickers,
            }

        prices = prices[valid_tickers]
        returns = prices.pct_change().dropna()

        if len(returns) < 30:
            return {
                "error": "Insufficient historical data (need at least 30 trading days)."
            }

        # Build weight vector
        w = np.array([weights.get(t, 1.0 / len(valid_tickers)) for t in valid_tickers])
        w = w / w.sum()

        # Core computations
        cov_matrix = compute_safe_covariance(returns)
        annual_returns = returns.mean().values * TRADING_DAYS
        n = len(valid_tickers)

        # Current portfolio metrics
        port_vol = compute_portfolio_volatility(w, cov_matrix)
        port_ret = compute_portfolio_return(w, returns)
        sharpe = compute_sharpe_ratio(port_ret, port_vol)

        # Individual stock metrics
        individual = {}
        for i, t in enumerate(valid_tickers):
            individual[t] = {
                "annualReturn": round(float(annual_returns[i]) * 100, 2),
                "volatility": round(float(np.sqrt(cov_matrix[i, i])) * 100, 2),
            }

        # Correlation matrix
        corr = compute_correlation_matrix(returns)

        # ── Efficient Frontier ──────────────────────────────────────
        def neg_sharpe(w_arr):
            ret = float(np.dot(w_arr, annual_returns))
            vol = float(np.sqrt(np.dot(w_arr, np.dot(cov_matrix, w_arr))))
            return -(ret - self._settings.risk_free_rate) / max(vol, 1e-10)

        constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1}]
        bounds = [(0.0, 1.0)] * n

        # Max Sharpe portfolio
        try:
            opt_result = minimize(
                neg_sharpe,
                x0=np.ones(n) / n,
                method="SLSQP",
                bounds=bounds,
                constraints=constraints,
            )
            opt_w = opt_result.x
            opt_ret = float(np.dot(opt_w, annual_returns))
            opt_vol = float(np.sqrt(np.dot(opt_w, np.dot(cov_matrix, opt_w))))
        except Exception:
            opt_w = w
            opt_ret, opt_vol = port_ret, port_vol

        # Min Volatility portfolio
        try:
            min_vol_result = minimize(
                lambda w_arr: float(np.dot(w_arr, np.dot(cov_matrix, w_arr))),
                x0=np.ones(n) / n,
                method="SLSQP",
                bounds=bounds,
                constraints=constraints,
            )
            mv_w = min_vol_result.x
            mv_ret = float(np.dot(mv_w, annual_returns))
            mv_vol = float(np.sqrt(np.dot(mv_w, np.dot(cov_matrix, mv_w))))
        except Exception:
            mv_w = w
            mv_ret, mv_vol = port_ret, port_vol

        # Efficient frontier points
        frontier = []
        target_returns = np.linspace(mv_ret, max(annual_returns), 30)
        for target in target_returns:
            try:
                result = minimize(
                    lambda w_arr: float(np.dot(w_arr, np.dot(cov_matrix, w_arr))),
                    x0=np.ones(n) / n,
                    method="SLSQP",
                    bounds=bounds,
                    constraints=[
                        {"type": "eq", "fun": lambda w: np.sum(w) - 1},
                        {
                            "type": "eq",
                            "fun": lambda w, r=target: (
                                float(np.dot(w, annual_returns)) - r
                            ),
                        },
                    ],
                )
                if result.success:
                    f_vol = float(np.sqrt(result.fun))
                    f_ret = float(np.dot(result.x, annual_returns))
                    frontier.append(
                        {"risk": round(f_vol, 5), "return": round(f_ret, 5)}
                    )
            except Exception as e:
                log.debug(f"efficient frontier point skipped: {e}")
                continue

        # VaR & Drawdown
        var_stats = compute_var(returns, w)
        max_dd = compute_max_drawdown(returns, w)
        diversification = compute_diversification_score(w, cov_matrix)

        # Warnings
        warnings = []
        if failed_tickers:
            warnings.append(f"No data for: {', '.join(failed_tickers)}")
        if port_vol > 0.3:
            warnings.append(
                "Portfolio volatility exceeds 30% — consider diversification."
            )

        return {
            "success": True,
            "validTickers": valid_tickers,
            "failedTickers": failed_tickers,
            "warnings": warnings,
            "expectedReturn": round(port_ret * 100, 2),
            "volatility": round(port_vol * 100, 2),
            "sharpeRatio": sharpe,
            "diversificationScore": round(diversification, 1),
            "correlationMatrix": corr,
            "individualMetrics": individual,
            "efficientFrontier": frontier,
            "optimalPortfolio": {
                "risk": round(opt_vol, 5),
                "return": round(opt_ret, 5),
                "weights": {
                    t: round(float(opt_w[i]), 4) for i, t in enumerate(valid_tickers)
                },
            },
            "minVolPortfolio": {
                "risk": round(mv_vol, 5),
                "return": round(mv_ret, 5),
                "weights": {
                    t: round(float(mv_w[i]), 4) for i, t in enumerate(valid_tickers)
                },
            },
            "currentPortfolio": {
                "risk": round(port_vol, 5),
                "return": round(port_ret, 5),
            },
            "varStats": {
                "var95": var_stats.get("var_95", 0),
                "var99": var_stats.get("var_99", 0),
                "maxDrawdown": round(max_dd, 5),
            },
        }

    def _empty_response(self) -> dict:
        """Return empty analysis response."""
        return {
            "holdings": [],
            "totals": {
                "total_value": 0,
                "total_invested": 0,
                "total_pnl": 0,
                "total_pnl_pct": 0,
                "holding_count": 0,
            },
            "sector_exposure": [],
            "sector_concentration": {},
            "sector_bias": {},
            "concentration": {},
            "risk": {},
            "health": {
                "score": 0,
                "label": "N/A",
                "color": "#64748b",
                "breakdown": {},
                "summary": "Add holdings to see analysis.",
            },
            "rebalance_suggestions": [],
            "insights": [
                {
                    "title": "Empty portfolio",
                    "body": "Add holdings to see insights.",
                    "tone": "info",
                }
            ],
            "diversification_score": 0,
        }


# ── Module-level singleton ──────────────────────────────────────────
_service: PortfolioService | None = None


def get_portfolio_service() -> PortfolioService:
    """Get or create the global PortfolioService singleton."""
    global _service
    if _service is None:
        _service = PortfolioService()
    return _service
