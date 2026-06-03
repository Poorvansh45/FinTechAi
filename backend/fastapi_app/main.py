"""
FinAI Edge — FastAPI Application Entry Point
==============================================
Analytics, AI, and portfolio intelligence layer.

Runs alongside Express (port 8080) on port 8000.
Express handles: auth, JWT, sessions, Finnhub market proxy.
FastAPI handles: portfolio analytics, AI generation, financial intelligence.
"""

import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging

from config import get_settings

# ── Logging ─────────────────────────────────────────────────────────
settings = get_settings()

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="[FastAPI] %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("finai_edge")


# ── Lifespan (startup / shutdown) ───────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    log.info("Starting FinAI Edge FastAPI...")
    log.info(f"  Environment: {settings.environment}")
    log.info(f"  Groww API:   {'✓ configured' if settings.groww_available else '✗ not set (using yfinance)'}")
    log.info(f"  Gemini AI:   {'✓ configured' if settings.gemini_available else '✗ not set (rule-based fallback)'}")
    log.info(f"  Finnhub:     {'✓ configured' if settings.finnhub_available else '✗ not set'}")
    log.info(f"  MongoDB:     {settings.mongodb_uri[:40]}...")

    # Initialize MongoDB connection
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        app.state.mongo_client = AsyncIOMotorClient(
            settings.mongodb_uri,
            serverSelectionTimeoutMS=5000,
        )
        # Ping to verify connection
        await app.state.mongo_client.admin.command('ping')
        app.state.db = app.state.mongo_client.get_default_database("finai_edge")
        app.state.mongo_connected = True
        log.info("  MongoDB:     connected [OK]")
    except Exception as mongo_err:
        log.warning(f"  MongoDB:     connection failed - {mongo_err}")
        log.warning("  MongoDB:     portfolio save/load features will be disabled")
        app.state.mongo_client = None
        app.state.db = None
        app.state.mongo_connected = False

    # Initialize Market Data Service
    from services.market_service import get_market_service
    app.state.market_service = get_market_service()
    log.info("  Market Data: service initialized ✓")

    log.info("  ─────────────────────────────────────────")
    log.info("  FinAI Edge FastAPI ready! 🚀")
    log.info(f"  Docs: http://localhost:{settings.fastapi_port}/docs")
    log.info("  ─────────────────────────────────────────")

    yield

    # Shutdown
    if app.state.mongo_client:
        app.state.mongo_client.close()
    log.info("FastAPI shutdown complete.")


# ── App Factory ─────────────────────────────────────────────────────
app = FastAPI(
    title="FinAI Edge — Portfolio Intelligence API",
    description=(
        "AI-powered portfolio analytics, optimization, and recommendation engine.\n\n"
        "**Endpoints:**\n"
        "- `/api/v2/portfolio` — Holdings analysis, MPT optimization, health check\n"
        "- `/api/v2/analytics` — Risk, sector, diversification analysis\n"
        "- `/api/v2/market` — Quotes, search, candles (Groww→yfinance→Finnhub)\n"
        "- `/api/v2/ai` — AI portfolio generation\n"
    ),
    version="2.0.0",
    lifespan=lifespan,
)

# ── CORS ────────────────────────────────────────────────────────────
allowed_origins = [
    "http://localhost:9002",
    "http://localhost:3000",
    "http://localhost:3001",
    settings.frontend_url,
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in allowed_origins if o],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request Timing Middleware ───────────────────────────────────────
@app.middleware("http")
async def add_timing_header(request: Request, call_next):
    """Add X-Process-Time header and log slow requests."""
    start = time.time()
    response = await call_next(request)
    duration = time.time() - start
    response.headers["X-Process-Time"] = f"{duration:.3f}s"

    # Log slow requests (>2s)
    if duration > 2.0:
        log.warning(
            f"Slow request: {request.method} {request.url.path} → {duration:.2f}s"
        )

    return response


# ── Global Exception Handler ───────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch unhandled exceptions and return structured error."""
    log.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc) if not settings.is_production else "An unexpected error occurred.",
        },
    )


# ── Health Check ────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "finai-edge-fastapi",
        "version": "2.0.0",
        "providers": {
            "groww": settings.groww_available,
            "gemini": settings.gemini_available,
            "finnhub": settings.finnhub_available,
        },
    }


# ── System Status Endpoint ──────────────────────────────────────────
@app.get("/api/v2/status", tags=["System"])
async def system_status(request: Request):
    """Full system status: providers, cache, MongoDB, env."""
    from services.market_service import get_market_service
    svc = get_market_service()
    return {
        "status": "healthy",
        "service": "finai-edge-fastapi",
        "version": "2.0.0",
        "environment": settings.environment,
        "mongodb": {
            "connected": getattr(request.app.state, "mongo_connected", False),
            "uri_prefix": settings.mongodb_uri[:30] + "...",
        },
        "api_keys": {
            "groww": settings.groww_available,
            "gemini": settings.gemini_available,
            "finnhub": settings.finnhub_available,
        },
        "providers": svc.get_provider_status(),
        "cache": svc.get_cache_stats(),
    }


# ── Register Routers ───────────────────────────────────────────────
from api.portfolio import router as portfolio_router
from api.analytics import router as analytics_router
from api.market import router as market_router
from api.ai import router as ai_router

app.include_router(portfolio_router, prefix="/api/v2/portfolio", tags=["Portfolio"])
app.include_router(analytics_router, prefix="/api/v2/analytics", tags=["Analytics"])
app.include_router(market_router, prefix="/api/v2/market", tags=["Market Data"])
app.include_router(ai_router, prefix="/api/v2/ai", tags=["AI"])


# ── Direct run ──────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.fastapi_port,
        reload=not settings.is_production,
        log_level="info",
    )
