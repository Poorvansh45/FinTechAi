"""
FinAI Edge — Portfolio Request Schemas
========================================
Pydantic v2 schemas for all portfolio-related API endpoints.

COPY TO: backend/fastapi_app/schemas/portfolio.py
"""

from pydantic import BaseModel, Field, field_validator


class HoldingInput(BaseModel):
    """Single holding input for portfolio analysis."""

    ticker: str = Field(
        ...,
        min_length=1,
        max_length=25,
        description="Yahoo Finance ticker symbol (e.g. RELIANCE.NS)",
    )
    name: str = Field(
        ..., min_length=1, max_length=120, description="Company or fund name"
    )
    quantity: float = Field(..., gt=0, description="Number of units held")
    avg_buy_price: float = Field(
        ..., gt=0, description="Average purchase price per unit (INR)"
    )
    current_price: float = Field(
        ..., gt=0, description="Current market price per unit (INR)"
    )
    sector: str | None = Field(
        None, description="Sector (auto-detected if not provided)"
    )

    @field_validator("ticker")
    @classmethod
    def clean_ticker(cls, v: str) -> str:
        """Normalize ticker to uppercase and add .NS suffix if bare."""
        t = v.strip().upper()
        # If no exchange suffix, add .NS (NSE India default)
        if "." not in t and "^" not in t:
            t = f"{t}.NS"
        return t

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        return v.strip()


class AnalyzeHoldingsRequest(BaseModel):
    """Request body for POST /portfolio/analyze-holdings."""

    holdings: list[HoldingInput] = Field(
        ...,
        min_length=1,
        max_length=50,
        description="List of holdings (1–50 stocks)",
    )


class AnalyzePortfolioRequest(BaseModel):
    """Request body for POST /portfolio/analyze (MPT optimization)."""

    tickers: list[str] = Field(
        ...,
        min_length=2,
        max_length=30,
        description="Ticker symbols for optimization",
    )
    weights: dict[str, float] = Field(
        default_factory=dict,
        description="Optional current weights (0–1), defaults to equal-weight",
    )
    risk_profile: str = Field(
        default="balanced",
        description="Risk profile: conservative | balanced | aggressive",
    )

    @field_validator("risk_profile")
    @classmethod
    def validate_risk_profile(cls, v: str) -> str:
        valid = {"conservative", "balanced", "aggressive"}
        if v not in valid:
            raise ValueError(f"risk_profile must be one of {valid}")
        return v


class HealthCheckRequest(BaseModel):
    """Request body for POST /portfolio/health."""

    holdings: list[HoldingInput] = Field(
        ...,
        min_length=1,
        max_length=50,
    )


class RebalanceRequest(BaseModel):
    """Request body for POST /portfolio/rebalance."""

    holdings: list[HoldingInput] = Field(
        ...,
        min_length=1,
        max_length=50,
    )
    target_weights: dict[str, float] | None = Field(
        None,
        description="Optional target weights. Defaults to equal-weight if not provided.",
    )
