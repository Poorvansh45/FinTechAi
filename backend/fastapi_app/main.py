"""
FinAI Edge — FastAPI Application Entry Point (v2)
====================================================
Port 8000. Handles: portfolio analytics, AI, market data,
scanner pipelines, SMC, watchlists.

Express (port 8080) handles: auth, JWT, sessions.
"""

import asyncio
import time
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from config import get_settings

settings = get_settings()

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="[FastAPI] %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("finai_edge")


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Starting FinAI Edge FastAPI v2…")
    log.info(f"  Environment: {settings.environment}")
    log.info(f"  Groww API:   {'✓' if settings.groww_available else '✗ (using yfinance)'}")
    log.info(f"  Gemini AI:   {'✓' if settings.gemini_available else '✗ (rule-based fallback)'}")
    log.info(f"  Finnhub:     {'✓' if settings.finnhub_available else '✗'}")

    # ── MongoDB ───────────────────────────────────────────────────────
    try:
        import certifi
        from motor.motor_asyncio import AsyncIOMotorClient

        app.state.mongo_client = AsyncIOMotorClient(
            settings.mongodb_uri,
            serverSelectionTimeoutMS=5000,
            tlsCAFile=certifi.where(),
        )
        await app.state.mongo_client.admin.command("ping")
        app.state.db = app.state.mongo_client.get_default_database("finai_edge")
        app.state.mongo_connected = True
        log.info("  MongoDB:     ✓ connected")

        # ── Create indexes ────────────────────────────────────────────
        try:
            from scripts.setup_indexes import create_indexes
            await create_indexes(app.state.db)
            log.info("  Indexes:     ✓ created/verified")
        except Exception as e:
            log.warning(f"  Indexes:     ✗ {e}")

    except Exception as e:
        log.warning(f"  MongoDB:     ✗ {e}")
        app.state.mongo_client = None
        app.state.db = None
        app.state.mongo_connected = False

    # ── Market Service ────────────────────────────────────────────────
    from services.market_service import get_market_service
    app.state.market_service = get_market_service()
    log.info("  Market:      ✓ service initialized")

    # ── Universe cache ────────────────────────────────────────────────
    if app.state.mongo_connected:
        try:
            from services.universe_cache import is_universe_fresh, get_universe_cached
            if await is_universe_fresh(app.state.db):
                log.info("  Universe:    ✓ cache fresh")
            else:
                symbols = await get_universe_cached(app.state.db)
                log.info(f"  Universe:    ✓ {len(symbols)} symbols cached")
        except Exception as e:
            log.warning(f"  Universe:    ✗ {e}")

        # ── Scheduler ─────────────────────────────────────────────────
        try:
            from schedulers.daily_refresh import setup_scheduler, maybe_run_on_startup
            setup_scheduler(app.state)
            # asyncio.create_task(maybe_run_on_startup(app.state))
            log.info("  Scheduler:   ✓ pre-market check at 08:00 IST, daily scan at 15:45 IST")
        except Exception as e:
            log.warning(f"  Scheduler:   ✗ {e}")

        # ── Local OHLC Startup Scan ──────────────────────────────────
        try:
            from services.local_ohlc_service import scan_all_local_files
            # asyncio.create_task(scan_all_local_files(app.state.db, app.state.market_service))
            log.info("  Local OHLC:  ✓ startup scan disabled on startup")
        except Exception as e:
            log.warning(f"  Local OHLC:  ✗ {e}")

    log.info("  FinAI Edge ready 🚀  http://localhost:8000/docs")

    yield

    if app.state.mongo_client:
        app.state.mongo_client.close()
    log.info("FastAPI shutdown.")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="FinAI Edge — Portfolio Intelligence API",
    description=(
        "AI-powered portfolio analytics, scanner pipelines, SMC, FVG, Momentum, Watchlists.\n\n"
        "- `/api/v2/portfolio`  — Holdings analysis, MPT, health\n"
        "- `/api/v2/analytics`  — Risk, sector, diversification\n"
        "- `/api/v2/market`     — Quotes, candles, search\n"
        "- `/api/v2/ai`         — AI portfolio generation\n"
        "- `/api/scanner`       — Technical, Volume, FVG, Momentum scanners\n"
        "- `/api/v2/scanner`    — SMC scanner, zone proximity, scan control\n"
        "- `/api/v2/watchlists` — Smart watchlists with full analytics\n"
    ),
    version="2.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
allowed_origins = list(filter(None, [
    "http://localhost:9002",
    "http://localhost:3000",
    "http://localhost:3001",
    settings.frontend_url,
]))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Timing middleware ─────────────────────────────────────────────────────────
@app.middleware("http")
async def add_timing(request: Request, call_next):
    t    = time.time()
    resp = await call_next(request)
    dur  = time.time() - t
    resp.headers["X-Process-Time"] = f"{dur:.3f}s"
    if dur > 2.0:
        log.warning(f"Slow: {request.method} {request.url.path} → {dur:.2f}s")
    return resp


# ── Global error handler ──────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exc(request: Request, exc: Exception):
    # Always log full detail (with traceback) server-side
    log.error(f"Unhandled error: {request.method} {request.url.path}: {exc}", exc_info=True)
    # Only expose exception detail to clients outside production
    content = {"error": "Internal server error"}
    if not settings.is_production:
        content["detail"] = str(exc)
    return JSONResponse(status_code=500, content=content)


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health():
    return {
        "status": "healthy",
        "service": "finai-edge-fastapi",
        "version": "2.0.0",
        "providers": {
            "groww":   settings.groww_available,
            "gemini":  settings.gemini_available,
            "finnhub": settings.finnhub_available,
        },
    }


@app.get("/api/v2/status", tags=["System"])
async def system_status(request: Request):
    from services.market_service import get_market_service
    svc = get_market_service()
    return {
        "status":      "healthy",
        "version":     "2.0.0",
        "environment": settings.environment,
        "mongodb":     {"connected": getattr(request.app.state, "mongo_connected", False)},
        "api_keys": {
            "groww":   settings.groww_available,
            "gemini":  settings.gemini_available,
            "finnhub": settings.finnhub_available,
        },
        "providers": svc.get_provider_status(),
        "cache":     svc.get_cache_stats(),
    }


# ── Routers ───────────────────────────────────────────────────────────────────
from api.portfolio  import router as portfolio_router
from api.analytics  import router as analytics_router
from api.market     import router as market_router
from api.ai         import router as ai_router
from api.screener   import router as screener_router, v2_router as screener_v2_router
from api.watchlists import router as watchlists_router
from api.smc        import router as smc_router
from api.local_ohlc import router as local_ohlc_router

app.include_router(portfolio_router,   prefix="/api/v2/portfolio")
app.include_router(analytics_router,   prefix="/api/v2/analytics")
app.include_router(market_router,      prefix="/api/v2/market")
app.include_router(ai_router,          prefix="/api/v2/ai")
app.include_router(screener_router)     # /api/scanner/*
app.include_router(screener_v2_router)  # /api/v2/scanner/scan-status + /trigger-scan
app.include_router(watchlists_router)   # /api/v2/watchlists
app.include_router(smc_router)          # /api/v2/scanner/smc + /zone-proximity
app.include_router(local_ohlc_router)   # /api/v2/scanner/local-ohlc/*


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.fastapi_port,
        reload=not settings.is_production,
        log_level="info",
    )
