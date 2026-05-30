"""
FinAI Edge — Pydantic Schemas: Portfolio
==========================================
Request/Response schemas for portfolio endpoints.
"""

from pydantic import BaseModel, Field
from typing import Optional


# ── Request Schemas ─────────────────────────────────────────────────

class HoldingInput(BaseModel):
    """Single holding input from frontend."""
    ticker: str = Field(..., min_length=1, max_length=25)
    name: str = ""
    quantity: float = Field(..., gt=0)
    avg_buy_price: float = Field(..., gt=0)
    current_price: float = Field(..., gt=0)
    sector: str = "Other"


class AnalyzeHoldingsRequest(BaseModel):
    """Request body for holdings-based analysis."""
    holdings: list[HoldingInput] = Field(..., min_length=1)


class AnalyzePortfolioRequest(BaseModel):
    """Request body for MPT portfolio analysis."""
    tickers: list[str] = Field(..., min_length=2)
    weights: dict[str, float]
    risk_profile: str = "balanced"


class HealthCheckRequest(BaseModel):
    """Request body for portfolio health check."""
    holdings: list[HoldingInput] = Field(..., min_length=1)


class RebalanceRequest(BaseModel):
    """Request body for rebalance suggestions."""
    holdings: list[HoldingInput] = Field(..., min_length=1)
    target_weights: Optional[dict[str, float]] = None


# ── Response Schemas ────────────────────────────────────────────────

class HoldingStats(BaseModel):
    """Computed stats for a single holding."""
    ticker: str
    name: str
    sector: str
    quantity: float
    avg_buy_price: float
    current_price: float
    invested: float
    value: float
    pnl: float
    pnl_pct: float
    allocation: float
    daily_pnl: float = 0.0
    daily_pnl_pct: float = 0.0


class PortfolioTotals(BaseModel):
    """Aggregate portfolio totals."""
    total_value: float
    total_invested: float
    total_pnl: float
    total_pnl_pct: float
    daily_pnl: float = 0.0
    daily_pnl_pct: float = 0.0
    holding_count: int


class SectorExposure(BaseModel):
    """Sector allocation breakdown."""
    sector: str
    value: float
    weight_pct: float
    stock_count: int
    tickers: list[str]


class PortfolioHealthResponse(BaseModel):
    """Full health analysis response."""
    score: int
    label: str
    color: str
    breakdown: dict[str, float]
    summary: str


class HoldingsAnalysisResponse(BaseModel):
    """Full holdings analysis response."""
    holdings: list[HoldingStats]
    totals: PortfolioTotals
    sector_exposure: list[SectorExposure]
    health: PortfolioHealthResponse
    risk: dict
    concentration: dict
    sector_bias: dict
    rebalance_suggestions: list[dict]
    insights: list[dict]
