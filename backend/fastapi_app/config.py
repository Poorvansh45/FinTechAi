"""
FinAI Edge — FastAPI Configuration
====================================
Pydantic Settings loading from .env with sensible defaults.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # ── Server ──────────────────────────────────────────────────────
    fastapi_port: int = 8000
    environment: str = "development"
    frontend_url: str = "http://localhost:9002"

    # ── Database ────────────────────────────────────────────────────
    mongodb_uri: str = "mongodb://localhost:27017/finai_edge"

    # ── API Keys (all optional — graceful fallback) ─────────────────
    groww_api_key: Optional[str] = None
    groww_totp_secret: Optional[str] = None
    gemini_api_key: Optional[str] = None
    finnhub_api_key: Optional[str] = None

    # ── Logging ─────────────────────────────────────────────────────
    log_level: str = "INFO"

    # ── Cache TTLs (seconds) ────────────────────────────────────────
    quote_cache_ttl: int = 300       # 5 minutes
    candle_cache_ttl: int = 3600     # 1 hour
    analytics_cache_ttl: int = 600   # 10 minutes

    # ── Portfolio Engine Defaults ───────────────────────────────────
    risk_free_rate: float = 0.065    # Indian 10Y treasury yield
    trading_days: int = 252
    monte_carlo_simulations: int = 3000
    min_history_days: int = 60
    min_assets: int = 2

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def groww_available(self) -> bool:
        return bool(self.groww_api_key and self.groww_totp_secret)

    @property
    def gemini_available(self) -> bool:
        return bool(self.gemini_api_key)

    @property
    def finnhub_available(self) -> bool:
        return bool(self.finnhub_api_key)

    model_config = {
        "env_file": "../.env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache()
def get_settings() -> Settings:
    """Cached settings singleton."""
    return Settings()
