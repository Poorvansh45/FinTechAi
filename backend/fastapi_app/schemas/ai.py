"""
FinAI Edge — AI Request Schemas
=================================
Pydantic v2 schemas for the AI portfolio generation endpoint.

COPY TO: backend/fastapi_app/schemas/ai.py
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional


VALID_GOALS = {
    'wealth_creation', 'retirement', 'passive_income',
    'house_purchase', 'emergency_fund',
}

VALID_HORIZONS = {'1-3y', '3-7y', '7y+'}

VALID_RISK = {'conservative', 'balanced', 'aggressive'}


class FinancialStatus(BaseModel):
    """Optional financial health snapshot from onboarding."""
    income_range: Optional[str] = Field(None, description="e.g. '5-10L', '10-25L', '25L+'")
    existing_investments: Optional[bool] = Field(None, description="Has any existing investment")
    debt_obligations: Optional[bool] = Field(None, description="Has active EMIs / debt")
    emergency_fund: Optional[bool] = Field(None, description="Has 3-6 month emergency fund")


class OnboardingRequest(BaseModel):
    """Request body for POST /api/v2/ai/generate-portfolio."""

    goal: str = Field(
        ...,
        description="Financial goal: wealth_creation | retirement | passive_income | house_purchase | emergency_fund",
    )
    horizon: str = Field(
        ...,
        description="Investment horizon: 1-3y | 3-7y | 7y+",
    )
    risk: Optional[str] = Field(
        'balanced',
        description="Risk profile: conservative | balanced | aggressive",
    )
    monthly_investment: float = Field(
        ..., gt=499,
        description="Monthly SIP amount in INR (minimum ₹500)",
    )
    asset_preferences: Optional[list[str]] = Field(
        None,
        description="Optional list of preferred asset types (e.g. ['Index Funds', 'Gold ETF'])",
        max_length=8,
    )
    financial_status: Optional[FinancialStatus] = Field(
        None,
        description="Optional financial health snapshot for AI context",
    )

    @field_validator('goal')
    @classmethod
    def validate_goal(cls, v: str) -> str:
        if v not in VALID_GOALS:
            raise ValueError(f"goal must be one of {VALID_GOALS}")
        return v

    @field_validator('horizon')
    @classmethod
    def validate_horizon(cls, v: str) -> str:
        if v not in VALID_HORIZONS:
            raise ValueError(f"horizon must be one of {VALID_HORIZONS}")
        return v

    @field_validator('risk')
    @classmethod
    def validate_risk(cls, v: Optional[str]) -> str:
        if v is not None and v not in VALID_RISK:
            raise ValueError(f"risk must be one of {VALID_RISK}")
        return v or 'balanced'


class AIPortfolioAllocation(BaseModel):
    """Single allocation item in an AI-generated portfolio."""
    name: str
    ticker: str
    allocation_pct: float
    asset_type: str
    description: str
    risk_level: str
    monthly_sip: float


class SIPProjection(BaseModel):
    """SIP future value projection."""
    monthly_sip: float
    horizon_years: int
    expected_rate_low: float
    expected_rate_high: float
    projected_value_low: float
    projected_value_high: float
    total_invested: float


class AIPortfolioResponse(BaseModel):
    """Response from POST /api/v2/ai/generate-portfolio."""
    allocations: list[AIPortfolioAllocation]
    reasoning: str
    risk_summary: str
    expected_return_range: str
    sip_projection: SIPProjection
    warnings: list[str]
    beginner_explanation: str
    goal_alignment: str
    generation_method: str  # 'gemini' | 'rule_based'
