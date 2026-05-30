"""
FinAI Edge — Pydantic Schemas: AI Portfolio Generation
========================================================
"""

from pydantic import BaseModel, Field
from typing import Optional


class FinancialStatus(BaseModel):
    """User's financial status (Step 5 of onboarding)."""
    income_range: str = Field(
        default="prefer_not_to_say",
        description="Income bracket: below_5L, 5_10L, 10_25L, above_25L, prefer_not_to_say"
    )
    existing_investments: bool = Field(
        default=False,
        description="Whether the user has existing investments"
    )
    debt_obligations: bool = Field(
        default=False,
        description="Whether the user has significant debt (loans, EMIs)"
    )
    emergency_fund: bool = Field(
        default=False,
        description="Whether the user has an emergency fund (3-6 months expenses)"
    )


class OnboardingRequest(BaseModel):
    """Full onboarding input from the frontend Option B flow."""
    goal: str = Field(..., description="Financial goal: wealth_creation, retirement, passive_income, house_purchase, emergency_fund")
    horizon: str = Field(..., description="Investment horizon: 1-3y, 3-7y, 7y+")
    risk: str = Field(..., description="Risk appetite: conservative, balanced, aggressive")
    monthly_investment: float = Field(..., gt=0, description="Monthly SIP amount in INR")
    asset_preferences: list[str] = Field(
        default_factory=list,
        description="Preferred asset classes: equity, gold, international, debt, crypto"
    )
    financial_status: Optional[FinancialStatus] = None


class PortfolioAllocation(BaseModel):
    """Single asset allocation in the AI-generated portfolio."""
    name: str = Field(..., description="Asset/Fund name")
    ticker: str = Field(..., description="Ticker or fund symbol")
    allocation_pct: float = Field(..., ge=0, le=100, description="Allocation percentage")
    asset_type: str = Field(default="equity", description="Type: equity, etf, debt, gold, international")
    description: str = Field(default="", description="Brief description for beginners")
    risk_level: str = Field(default="moderate", description="Risk level of this specific asset")
    monthly_sip: float = Field(default=0, description="Suggested monthly SIP for this asset in INR")


class SIPProjection(BaseModel):
    """SIP projection for a given horizon."""
    monthly_sip: float
    horizon_years: int
    expected_rate_low: float
    expected_rate_high: float
    projected_value_low: float
    projected_value_high: float
    total_invested: float


class AIPortfolioResponse(BaseModel):
    """Full AI portfolio generation response."""
    allocations: list[PortfolioAllocation]
    reasoning: str = Field(..., description="AI's reasoning for this allocation")
    risk_summary: str = Field(..., description="Risk level explanation")
    expected_return_range: str = Field(..., description="Expected return range string, e.g., '11-16% p.a.'")
    sip_projection: SIPProjection
    warnings: list[str] = Field(default_factory=list)
    beginner_explanation: str = Field(
        default="",
        description="Simple, jargon-free explanation for first-time investors"
    )
    goal_alignment: str = Field(
        default="",
        description="How this portfolio aligns with the user's stated goal"
    )
    generation_method: str = Field(
        default="gemini",
        description="Method used: 'gemini' or 'rule_based'"
    )
