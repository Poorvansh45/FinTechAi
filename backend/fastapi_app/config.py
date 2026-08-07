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

    # ── OHLCV source ────────────────────────────────────────────────
    # "csv"   — backend/data/Stock_Data.csv, loaded whole into RAM (~235 MB).
    #           Works fully offline; the download path writes back to the file.
    # "mongo" — services/ohlcv_store.py, one document per symbol, fetched on
    #           demand behind a bounded LRU (~9 MB). Required for deployment:
    #           the CSV is 196 MB, gitignored, and does not survive an
    #           ephemeral filesystem.
    #
    # Defaults to "csv" so local development is unchanged until deliberately
    # switched. There is NO automatic fallback between the two: if Mongo is
    # unreachable in "mongo" mode this fails loudly rather than silently
    # serving a stale CSV, because a scan must never leave you guessing which
    # source produced it. Switching back is this one setting.
    ohlcv_backend: str = "csv"

    # ── Auth ────────────────────────────────────────────────────────
    # Same secret Express uses to sign JWTs (backend/utils/generateToken.js) —
    # required so this service can verify tokens issued by Express.
    jwt_secret: str = "change_this_secret_in_production"

    # ── API Keys (all optional — graceful fallback) ─────────────────
    groww_api_key: Optional[str] = None
    groww_totp_secret: Optional[str] = None
    gemini_api_key: Optional[str] = None
    finnhub_api_key: Optional[str] = None

    # ── Bulk OHLCV ingestion (services/ohlc_downloader.py) ──────────
    # OHLCV for the scanner pipeline is sourced SOLELY from Upstox's public V3
    # historical endpoint (no auth; multi-year daily history in one call). Groww
    # was removed from the OHLCV path — its candles were inaccurate — and yfinance
    # remains only as a disaster fallback for the ^NSEI index. This field is kept
    # for backward compat with existing .env files but is no longer read; the
    # source is always Upstox. (Live LTP quotes are a separate, unaffected path.)
    ohlc_primary_provider: str = "upstox"
    upstox_instruments_url: str = (
        "https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz"
    )

    # ── AI Copilot / LLM provider ───────────────────────────────────
    # LLMManager always tries Gemini first, then fails over to Groq (see
    # services/llm/). This flag is not consulted by the manager itself; it's
    # kept for any tooling that still wants to force a single provider.
    ai_model_provider: str = "gemini"
    groq_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None   # placeholder — provider not wired yet
    gemini_model: str = "gemini-2.5-flash"
    groq_model: str = "llama-3.3-70b-versatile"

    # ── Workspace media storage ─────────────────────────────────────
    # Pluggable storage backend. "local" writes to `workspace_uploads_dir`
    # during development; "r2" / "s3" (added later) use the same
    # StorageProvider interface so business logic never changes.
    storage_backend: str = "local"
    workspace_uploads_dir: str = "uploads"          # relative to the FastAPI app root
    workspace_max_upload_mb: int = 15               # per-file upload guard
    # Public base URL for cloud buckets (r2/s3). Ignored for local (served via API).
    storage_public_base_url: Optional[str] = None

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
        """True if at least one LLM provider (Gemini or Groq) has a usable key —
        LLMManager fails over automatically, so either is sufficient."""
        return self.gemini_available or self.groq_available

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
