"""
FinAI Edge — FastAPI Router: AI
=================================
AI-powered portfolio generation endpoint.
Phase 1: rule-based fallback. Phase 2: full Gemini integration.
"""

import asyncio
import json
import logging
import re

import google.generativeai as genai
from fastapi import APIRouter
from pydantic import BaseModel, Field

from config import get_settings
from schemas.ai import OnboardingRequest

log = logging.getLogger("finai_edge.api.ai")
router = APIRouter()

# Configure genai once on module import
settings = get_settings()
if settings.gemini_available:
    try:
        genai.configure(api_key=settings.gemini_api_key)
        log.info("Gemini AI configured successfully for AI router.")
    except Exception as e:
        log.error(f"Failed to configure Gemini AI: {e}")


# ── Gemini Response Schemas ─────────────────────────────────────────


class GeminiPortfolioAllocation(BaseModel):
    name: str = Field(..., description="Asset or Mutual Fund name in India")
    ticker: str = Field(
        ...,
        description="Ticker or fund symbol (e.g. RELIANCE.NS, NIFTYBEES.NS, GOLDBEES.NS, HDFCBANK.NS, etc.) that can be fetched via yfinance. Make sure to use actual real ticker symbols.",
    )
    allocation_pct: float = Field(
        ..., description="Allocation percentage weight (0-100)"
    )
    asset_type: str = Field(
        ..., description="Type: equity, debt, gold, international, or etf"
    )
    description: str = Field(
        ...,
        description="Brief description for beginners explaining what this fund/stock is",
    )
    risk_level: str = Field(..., description="Risk level: low, moderate, high")


class GeminiPortfolioResponse(BaseModel):
    allocations: list[GeminiPortfolioAllocation]
    reasoning: str = Field(
        ...,
        description="AI's reasoning for this specific asset allocation based on the user goals",
    )
    risk_summary: str = Field(
        ..., description="Risk level explanation of the overall portfolio"
    )
    expected_rate_low: float = Field(
        ...,
        description="Conservative expected annual return rate as a decimal fraction (e.g. 0.08 for 8%)",
    )
    expected_rate_high: float = Field(
        ...,
        description="Optimistic expected annual return rate as a decimal fraction (e.g. 0.15 for 15%)",
    )
    beginner_explanation: str = Field(
        ...,
        description="Simple, jargon-free explanation for first-time investors explaining how this portfolio works",
    )
    goal_alignment: str = Field(
        ...,
        description="How this portfolio directly aligns with the user's stated financial goal",
    )


# ── Rule-based portfolio templates (Fallback) ───────────────────────
PORTFOLIO_TEMPLATES = {
    "conservative": {
        "equity_pct": 40,
        "debt_pct": 40,
        "gold_pct": 15,
        "intl_pct": 5,
        "return_range": "8-11% p.a.",
        "allocations": [
            {
                "name": "HDFC Balanced Advantage Fund",
                "ticker": "HDFCBAF.NS",
                "allocation_pct": 25,
                "asset_type": "equity",
                "risk_level": "moderate",
                "description": "Dynamically balances equity/debt for stability.",
            },
            {
                "name": "ICICI Prudential Corporate Bond Fund",
                "ticker": "ICICPCB.NS",
                "allocation_pct": 20,
                "asset_type": "debt",
                "risk_level": "low",
                "description": "High-quality corporate bonds for steady income.",
            },
            {
                "name": "SBI Magnum Gilt Fund",
                "ticker": "SBIGILT.NS",
                "allocation_pct": 20,
                "asset_type": "debt",
                "risk_level": "low",
                "description": "Government securities fund for safety.",
            },
            {
                "name": "Nippon India Gold BeES",
                "ticker": "GOLDBEES.NS",
                "allocation_pct": 15,
                "asset_type": "gold",
                "risk_level": "low",
                "description": "Gold ETF tracking domestic gold prices.",
            },
            {
                "name": "Kotak Nifty 50 Index Fund",
                "ticker": "KOTAKNIFTY.NS",
                "allocation_pct": 15,
                "asset_type": "equity",
                "risk_level": "moderate",
                "description": "Low-cost index fund tracking Nifty 50.",
            },
            {
                "name": "Motilal Oswal Nasdaq 100 ETF",
                "ticker": "MON100.NS",
                "allocation_pct": 5,
                "asset_type": "international",
                "risk_level": "high",
                "description": "US tech exposure via NASDAQ 100.",
            },
        ],
    },
    "balanced": {
        "equity_pct": 60,
        "debt_pct": 25,
        "gold_pct": 10,
        "intl_pct": 5,
        "return_range": "11-16% p.a.",
        "allocations": [
            {
                "name": "Mirae Asset Large Cap Fund",
                "ticker": "MIRAEELC.NS",
                "allocation_pct": 25,
                "asset_type": "equity",
                "risk_level": "moderate",
                "description": "Diversified large-cap equity exposure.",
            },
            {
                "name": "Parag Parikh Flexi Cap Fund",
                "ticker": "PPFCF.NS",
                "allocation_pct": 20,
                "asset_type": "equity",
                "risk_level": "moderate",
                "description": "Multi-cap fund with international diversification.",
            },
            {
                "name": "Axis Midcap Fund",
                "ticker": "AXISMID.NS",
                "allocation_pct": 15,
                "asset_type": "equity",
                "risk_level": "high",
                "description": "High-growth midcap companies for alpha.",
            },
            {
                "name": "HDFC Corporate Bond Fund",
                "ticker": "HDFCCORP.NS",
                "allocation_pct": 15,
                "asset_type": "debt",
                "risk_level": "low",
                "description": "Quality corporate bonds for portfolio stability.",
            },
            {
                "name": "SBI Liquid Fund",
                "ticker": "SBILIQ.NS",
                "allocation_pct": 10,
                "asset_type": "debt",
                "risk_level": "low",
                "description": "Ultra-safe liquid fund for emergency allocation.",
            },
            {
                "name": "Nippon India Gold BeES",
                "ticker": "GOLDBEES.NS",
                "allocation_pct": 10,
                "asset_type": "gold",
                "risk_level": "low",
                "description": "Gold hedge against equity volatility.",
            },
            {
                "name": "Motilal Oswal Nasdaq 100 ETF",
                "ticker": "MON100.NS",
                "allocation_pct": 5,
                "asset_type": "international",
                "risk_level": "high",
                "description": "US tech sector exposure for global diversification.",
            },
        ],
    },
    "aggressive": {
        "equity_pct": 80,
        "debt_pct": 10,
        "gold_pct": 5,
        "intl_pct": 5,
        "return_range": "14-20% p.a.",
        "allocations": [
            {
                "name": "Quant Small Cap Fund",
                "ticker": "QUANTSM.NS",
                "allocation_pct": 20,
                "asset_type": "equity",
                "risk_level": "high",
                "description": "High-growth small-cap stocks for maximum returns.",
            },
            {
                "name": "Parag Parikh Flexi Cap Fund",
                "ticker": "PPFCF.NS",
                "allocation_pct": 20,
                "asset_type": "equity",
                "risk_level": "moderate",
                "description": "Multi-cap diversified fund.",
            },
            {
                "name": "Nippon India Small Cap Fund",
                "ticker": "NIPPSM.NS",
                "allocation_pct": 15,
                "asset_type": "equity",
                "risk_level": "high",
                "description": "Small-cap fund targeting high alpha.",
            },
            {
                "name": "Axis Midcap Fund",
                "ticker": "AXISMID.NS",
                "allocation_pct": 15,
                "asset_type": "equity",
                "risk_level": "high",
                "description": "Quality midcap stocks.",
            },
            {
                "name": "Nifty 50 Index Fund",
                "ticker": "NIFTY50ETF.NS",
                "allocation_pct": 10,
                "asset_type": "equity",
                "risk_level": "moderate",
                "description": "Core large-cap allocation.",
            },
            {
                "name": "ICICI Prudential Liquid Fund",
                "ticker": "ICICILIQ.NS",
                "allocation_pct": 10,
                "asset_type": "debt",
                "risk_level": "low",
                "description": "Liquidity buffer for rebalancing.",
            },
            {
                "name": "Nippon India Gold BeES",
                "ticker": "GOLDBEES.NS",
                "allocation_pct": 5,
                "asset_type": "gold",
                "risk_level": "low",
                "description": "Small gold hedge.",
            },
            {
                "name": "Motilal Oswal Nasdaq 100 ETF",
                "ticker": "MON100.NS",
                "allocation_pct": 5,
                "asset_type": "international",
                "risk_level": "high",
                "description": "Global tech exposure.",
            },
        ],
    },
}

GOAL_REASONING = {
    "wealth_creation": "Focus on equity-heavy allocation for long-term compounding. Growth stocks and diversified funds form the core.",
    "retirement": "Balanced approach with SIP discipline. Mix of equity growth and debt stability for predictable retirement corpus.",
    "passive_income": "Emphasize dividend-yielding stocks, debt funds, and REITs for regular cash flow generation.",
    "house_purchase": "Medium-term horizon calls for balanced allocation. Debt-heavy if within 3 years, equity tilt if 5+ years.",
    "emergency_fund": "Capital preservation is key. Liquid funds, ultra-short duration debt, and minimal equity exposure.",
}


def _compute_sip_projection(
    monthly_sip: float,
    horizon: str,
    risk: str,
) -> dict:
    """Compute SIP projection based on horizon and risk profile."""
    horizon_map = {"1-3y": 2, "3-7y": 5, "7y+": 10}
    years = horizon_map.get(horizon, 5)

    rate_map = {
        "conservative": (0.08, 0.11),
        "balanced": (0.11, 0.16),
        "aggressive": (0.14, 0.20),
    }
    low_rate, high_rate = rate_map.get(risk, (0.11, 0.16))

    months = years * 12
    total_invested = monthly_sip * months

    # SIP future value formula: FV = P × [(1+r)^n - 1] / r × (1+r)
    def sip_fv(p, r, n):
        monthly_r = r / 12
        return p * (((1 + monthly_r) ** n - 1) / monthly_r) * (1 + monthly_r)

    return {
        "monthly_sip": monthly_sip,
        "horizon_years": years,
        "expected_rate_low": low_rate,
        "expected_rate_high": high_rate,
        "projected_value_low": round(sip_fv(monthly_sip, low_rate, months), 2),
        "projected_value_high": round(sip_fv(monthly_sip, high_rate, months), 2),
        "total_invested": round(total_invested, 2),
    }


@router.post("/generate-portfolio")
async def generate_portfolio(req: OnboardingRequest):
    """
    Generate AI-powered portfolio based on onboarding answers.
    Uses Gemini AI if configured, otherwise falls back to a rule-based template.
    """
    settings = get_settings()
    risk = req.risk or "balanced"

    # ── Option A: Gemini AI Generation ──────────────────────────────
    if settings.gemini_available:
        try:
            log.info(
                "Generating portfolio dynamically using Gemini AI (gemini-2.5-flash)..."
            )
            model = genai.GenerativeModel("gemini-2.5-flash")

            # Format inputs for prompt
            preferences = (
                ", ".join(req.asset_preferences) if req.asset_preferences else "None"
            )
            financial_status_str = ""
            if req.financial_status:
                financial_status_str = (
                    f"- Income bracket: {req.financial_status.income_range}\n"
                    f"- Has existing investments: {req.financial_status.existing_investments}\n"
                    f"- Has active debt obligations: {req.financial_status.debt_obligations}\n"
                    f"- Has emergency fund setup: {req.financial_status.emergency_fund}\n"
                )

            prompt = (
                f"You are Nivro, a premier automated wealth advisory system.\n"
                f"Design a highly optimized, diversified portfolio for the following client onboarding request:\n"
                f"- Primary Financial Goal: {req.goal.replace('_', ' ').title()}\n"
                f"- Investment Horizon: {req.horizon}\n"
                f"- Risk Appetite: {risk.title()}\n"
                f"- Monthly SIP Investment: ₹{req.monthly_investment:,.2f} INR\n"
                f"- Asset Preferences: {preferences}\n"
                f"Client Financial Health Profile:\n"
                f"{financial_status_str}\n"
                f"Guidelines:\n"
                f"1. Propose 4-6 real mutual funds or stock tickers available in India. Every single asset ticker must be a real Yahoo Finance ticker matching Indian markets (ending in '.NS' like RELIANCE.NS, GOLDBEES.NS, HDFCBANK.NS, SBIBAF.NS, NIFTYBEES.NS, etc.).\n"
                f"2. Ensure allocation percentages are integers or clean numbers summing up to exactly 100%.\n"
                f"3. Provide realistic expected annual returns as decimals (e.g. expected_rate_low=0.10 for 10% expected return)."
            )

            # Wrap Gemini call in asyncio.to_thread + timeout to prevent
            # blocking the event loop and hanging indefinitely
            def _sync_gemini_call():
                return model.generate_content(
                    prompt,
                    generation_config=genai.GenerationConfig(
                        response_mime_type="application/json",
                        response_schema=GeminiPortfolioResponse,
                    ),
                )

            try:
                response = await asyncio.wait_for(
                    asyncio.to_thread(_sync_gemini_call),
                    timeout=30.0,
                )
            except asyncio.TimeoutError:
                log.error(
                    "Gemini API call timed out after 30s, falling back to templates"
                )
                raise  # caught by outer except

            # Robust JSON parsing — Gemini can sometimes wrap in markdown
            raw_text = response.text.strip()
            if raw_text.startswith("```"):
                # Strip markdown code fences
                raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
                raw_text = re.sub(r"\s*```$", "", raw_text)

            try:
                ai_data = json.loads(raw_text)
            except json.JSONDecodeError as json_err:
                log.error(f"Gemini returned malformed JSON: {json_err}")
                log.debug(f"Raw Gemini response: {raw_text[:500]}")
                raise ValueError(f"Gemini returned invalid JSON: {json_err}")

            # Parse allocations and ensure they sum exactly to 100
            raw_allocs = ai_data.get("allocations", [])
            total_alloc = sum(a.get("allocation_pct", 0) for a in raw_allocs)

            allocations = []
            horizon_map = {"1-3y": 2, "3-7y": 5, "7y+": 10}
            years = horizon_map.get(req.horizon, 5)

            for a in raw_allocs:
                pct = a.get("allocation_pct", 0)
                if total_alloc > 0:
                    pct = round((pct / total_alloc) * 100, 2)

                monthly_sip = round(req.monthly_investment * pct / 100, 2)
                allocations.append(
                    {
                        "name": a.get("name"),
                        "ticker": a.get("ticker"),
                        "allocation_pct": pct,
                        "asset_type": a.get("asset_type", "equity").lower(),
                        "description": a.get("description", ""),
                        "risk_level": a.get("risk_level", "moderate").lower(),
                        "monthly_sip": monthly_sip,
                    }
                )

            # Adjust rounding errors if total is not exactly 100%
            actual_sum = sum(a["allocation_pct"] for a in allocations)
            if allocations and actual_sum != 100.0:
                diff = round(100.0 - actual_sum, 2)
                allocations[0]["allocation_pct"] = round(
                    allocations[0]["allocation_pct"] + diff, 2
                )
                allocations[0]["monthly_sip"] = round(
                    req.monthly_investment * allocations[0]["allocation_pct"] / 100, 2
                )

            expected_rate_low = ai_data.get("expected_rate_low", 0.08)
            expected_rate_high = ai_data.get("expected_rate_high", 0.15)

            # Calculate SIP projection
            months = years * 12
            total_invested = req.monthly_investment * months

            def sip_fv(p, r, n):
                if r <= 0:
                    return p * n
                monthly_r = r / 12
                return p * (((1 + monthly_r) ** n - 1) / monthly_r) * (1 + monthly_r)

            projected_value_low = round(
                sip_fv(req.monthly_investment, expected_rate_low, months), 2
            )
            projected_value_high = round(
                sip_fv(req.monthly_investment, expected_rate_high, months), 2
            )

            sip_proj = {
                "monthly_sip": req.monthly_investment,
                "horizon_years": years,
                "expected_rate_low": round(expected_rate_low * 100, 1),
                "expected_rate_high": round(expected_rate_high * 100, 1),
                "projected_value_low": projected_value_low,
                "projected_value_high": projected_value_high,
                "total_invested": round(total_invested, 2),
            }

            log.info("Gemini portfolio generation complete.")
            return {
                "allocations": allocations,
                "reasoning": ai_data.get("reasoning", ""),
                "risk_summary": ai_data.get("risk_summary", ""),
                "expected_return_range": f"{int(expected_rate_low * 100)}-{int(expected_rate_high * 100)}% p.a.",
                "sip_projection": sip_proj,
                "warnings": [],
                "beginner_explanation": ai_data.get("beginner_explanation", ""),
                "goal_alignment": ai_data.get("goal_alignment", ""),
                "generation_method": "gemini",
            }

        except Exception:
            log.exception("Gemini portfolio generation failed, falling back to rule-based templates")
            # Fail through to rule-based fallback below

    # ── Option B: Rule-based Fallback ───────────────────────────────
    template = PORTFOLIO_TEMPLATES.get(risk, PORTFOLIO_TEMPLATES["balanced"])

    # Build allocations with SIP amounts
    allocations = []
    for alloc in template["allocations"]:
        monthly_sip = round(req.monthly_investment * alloc["allocation_pct"] / 100, 2)
        allocations.append(
            {
                **alloc,
                "monthly_sip": monthly_sip,
            }
        )

    # SIP projection
    sip_proj = _compute_sip_projection(req.monthly_investment, req.horizon, risk)

    # Goal reasoning
    reasoning = GOAL_REASONING.get(
        req.goal,
        "Diversified portfolio aligned with your stated goals and risk tolerance.",
    )

    # Risk summary
    risk_summaries = {
        "conservative": "Low-risk allocation prioritizing capital preservation. Suitable for short-term goals and risk-averse investors.",
        "balanced": "Moderate-risk allocation balancing growth and stability. Ideal for medium-term goals with 5+ year horizon.",
        "aggressive": "High-growth allocation maximizing equity exposure. Best for long-term wealth creation with 7+ year horizon.",
    }

    warnings = ["FastAPI is using rule-based allocation templates as a fallback."]
    if not settings.gemini_available:
        warnings.append("GEMINI_API_KEY is not set in the backend environment.")

    return {
        "allocations": allocations,
        "reasoning": reasoning,
        "risk_summary": risk_summaries.get(risk, "Balanced risk approach."),
        "expected_return_range": template["return_range"],
        "sip_projection": sip_proj,
        "warnings": warnings,
        "beginner_explanation": (
            f"We've built a {risk} portfolio for your '{req.goal.replace('_', ' ')}' goal. "
            f"Each month, ₹{req.monthly_investment:,.0f} will be split across {len(allocations)} "
            f"investments. The mix of equity, debt, and gold helps balance growth with safety."
        ),
        "goal_alignment": f"This portfolio is designed for {req.goal.replace('_', ' ')} with a {req.horizon} horizon.",
        "generation_method": "rule_based",
    }
