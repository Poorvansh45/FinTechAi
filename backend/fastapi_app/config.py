"""
FinAI Edge — FastAPI Configuration
====================================
Pydantic Settings loading from .env with sensible defaults.
"""

import os
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

    # ── Auth ────────────────────────────────────────────────────────
    # Same secret Express uses to sign JWTs (backend/utils/generateToken.js) —
    # required so this service can verify tokens issued by Express.
    jwt_secret: str = "change_this_secret_in_production"

    # ── API Keys (all optional — graceful fallback) ─────────────────
    groww_api_key: Optional[str] = None
    groww_totp_secret: Optional[str] = None
    gemini_api_key: Optional[str] = None
    finnhub_api_key: Optional[str] = None

    # ── AI Copilot / LLM provider ───────────────────────────────────
    # Switch providers via AI_MODEL_PROVIDER (gemini | groq | openai | claude).
    # Default: cheapest reliable model (Gemini Flash).
    ai_model_provider: str = "gemini"
    groq_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None   # placeholder — provider not wired yet
    gemini_model: str = "gemini-2.5-flash"
    groq_model: str = "llama-3.3-70b-versatile"

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
    def groq_available(self) -> bool:
        return bool(self.groq_api_key)

    @property
    def finnhub_available(self) -> bool:
        return bool(self.finnhub_api_key)

    @property
    def copilot_llm_available(self) -> bool:
        """True if the configured copilot provider has a usable API key."""
        provider = (self.ai_model_provider or "gemini").lower()
        if provider == "gemini":
            return self.gemini_available
        if provider == "groq":
            return self.groq_available
        if provider == "openai":
            return bool(self.openai_api_key)
        return False

    model_config = {
        "env_file": "../.env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache()
def get_settings() -> Settings:
    """Cached settings singleton."""
    settings = Settings()
    if settings.is_production and not os.environ.get("JWT_SECRET"):
        raise RuntimeError(
            "[FATAL] JWT_SECRET is not set. Refusing to start in production with an "
            "insecure default (mirrors the same guard in backend/config/env.js)."
        )
    return settings
