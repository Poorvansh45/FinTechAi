"""
FinAI Edge — FastAPI Application Entry Point (v2)
====================================================
Port 8000. Handles: auth (login/session), portfolio analytics, AI, market
data, scanner pipelines, SMC, watchlists — the whole backend.
"""

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import get_settings
from middleware.auth_guard import AuthGuardMiddleware

settings = get_settings()

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="[FastAPI] %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("finai_edge")


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Starting Nivro FastAPI v2…")
    log.info(f"  Environment: {settings.environment}")
    log.info(
        f"  Groww API:   {'✓' if settings.groww_available else '✗ (using yfinance)'}"
    )
    log.info(
        f"  Gemini AI:   {'✓' if settings.gemini_available else '✗ (rule-based fallback)'}"
    )
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

        # ── Scan crash recovery ─────────────────────────────────────────
        # A killed/crashed process can leave scan_meta.overall_status stuck
        # RUNNING forever (nothing in-memory survives to correct it — see
        # engines/orchestration/recovery.py). Every fresh boot's own
        # _ACTIVE_SCANS registry is necessarily empty, so any persisted
        # RUNNING doc at this point is provably orphaned; heal it before
        # serving any traffic.
        try:
            from engines.orchestration import reconcile_orphaned_scans

            healed = await reconcile_orphaned_scans(app.state.db)
            log.info(
                f"  Scan state:  {'✓ healed 1 orphaned scan' if healed else '✓ clean'}"
            )
        except Exception as e:
            log.warning(f"  Scan state:  ✗ reconciliation failed: {e}")

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
            from services.universe_cache import get_universe_cached, is_universe_fresh

            if await is_universe_fresh(app.state.db):
                log.info("  Universe:    ✓ cache fresh")
            else:
                symbols = await get_universe_cached(app.state.db)
                log.info(f"  Universe:    ✓ {len(symbols)} symbols cached")
        except Exception as e:
            log.warning(f"  Universe:    ✗ {e}")

        # ── Scheduler ─────────────────────────────────────────────────
        try:
            from schedulers.daily_refresh import setup_scheduler

            setup_scheduler(app.state)
            # asyncio.create_task(maybe_run_on_startup(app.state))
            log.info(
                "  Scheduler:   ✓ pre-market check at 08:00 IST, daily scan at 15:45 IST"
            )
        except Exception as e:
            log.warning(f"  Scheduler:   ✗ {e}")

        # ── Local OHLC Startup Scan ──────────────────────────────────
        try:
            # asyncio.create_task(scan_all_local_files(app.state.db, app.state.market_service))
            log.info("  Local OHLC:  ✓ startup scan disabled on startup")
        except Exception as e:
            log.warning(f"  Local OHLC:  ✗ {e}")

    log.info("  Nivro ready 🚀  http://localhost:8000/docs")

    yield

    if app.state.mongo_client:
        app.state.mongo_client.close()
    # The OHLCV store holds its own synchronous pymongo pool (see
    # services/ohlcv_store.py), which Motor's client does not own.
    try:
        from services.ohlcv_store import close as close_ohlcv_store

        close_ohlcv_store()
    except Exception as e:  # pragma: no cover - shutdown must not raise
        log.warning(f"OHLCV store close failed: {e}")
    log.info("FastAPI shutdown.")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Nivro — Portfolio Intelligence API",
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
    # Interactive docs publish the entire API surface, so they are development
    # only. Outside development all three are unmounted rather than protected —
    # nothing to probe, nothing to misconfigure.
    docs_url="/docs" if settings.environment == "development" else None,
    redoc_url="/redoc" if settings.environment == "development" else None,
    openapi_url="/openapi.json" if settings.environment == "development" else None,
)

# ── Auth guard (deny by default) ──────────────────────────────────────────────
# Registered BEFORE CORS on purpose. Starlette builds the stack so that the most
# recently added middleware is the OUTERMOST, so adding CORS afterwards leaves it
# wrapping this one. That ordering matters: a 401 produced here must still carry
# CORS headers, otherwise the browser reports an opaque CORS failure instead of
# the actual status and the frontend cannot redirect to the login page.
app.add_middleware(AuthGuardMiddleware)

# ── CORS ──────────────────────────────────────────────────────────────────────
allowed_origins = list(
    filter(
        None,
        [
            "http://localhost:9002",
            "http://localhost:3000",
            "http://localhost:3001",
            settings.frontend_url,
        ],
    )
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Timing + security headers ─────────────────────────────────────────────────
# Extends the existing timing middleware rather than adding a second one, so the
# middleware stack order (AuthGuard inside CORS) is left exactly as it is.
#
# Deliberately NOT set here:
#   • Content-Security-Policy — this service returns JSON, and a CSP would apply
#     to the /docs Swagger UI in development, which loads its own CDN assets.
#   • Access-Control-* — owned by CORSMiddleware; setting them here would
#     conflict with it.
SECURITY_HEADERS = {
    # Stops a browser re-interpreting a JSON error body as HTML/JS.
    "X-Content-Type-Options": "nosniff",
    # This API is never meant to be framed.
    "X-Frame-Options": "DENY",
    # Do not leak API paths (which contain ids) to third-party sites.
    "Referrer-Policy": "no-referrer",
    "X-Permitted-Cross-Domain-Policies": "none",
}


@app.middleware("http")
async def add_timing(request: Request, call_next):
    t = time.time()
    resp = await call_next(request)
    dur = time.time() - t
    resp.headers["X-Process-Time"] = f"{dur:.3f}s"

    for k, v in SECURITY_HEADERS.items():
        resp.headers.setdefault(k, v)
    # HSTS only in production: Render terminates TLS there, but local
    # development runs plain HTTP and sending HSTS would pin the browser to
    # https://localhost for a year.
    if settings.is_production:
        resp.headers.setdefault(
            "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
        )

    if dur > 2.0:
        log.warning(f"Slow: {request.method} {request.url.path} → {dur:.2f}s")
    return resp


# ── Global error handler ──────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exc(request: Request, exc: Exception):
    # Always log full detail (with traceback) server-side. exc_info=exc rather
    # than exc_info=True: this handler receives `exc` as a plain parameter, not
    # via an active `except` clause, so passing the exception object explicitly
    # is correct regardless of whether ambient sys.exc_info() is still set.
    log.error(
        f"Unhandled error: {request.method} {request.url.path}: {exc}", exc_info=exc
    )
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
            "groww": settings.groww_available,
            "gemini": settings.gemini_available,
            "finnhub": settings.finnhub_available,
        },
    }


@app.get("/api/v2/status", tags=["System"])
async def system_status(request: Request):
    from services.market_service import get_market_service

    svc = get_market_service()
    return {
        "status": "healthy",
        "version": "2.0.0",
        "environment": settings.environment,
        "mongodb": {"connected": getattr(request.app.state, "mongo_connected", False)},
        "api_keys": {
            "groww": settings.groww_available,
            "gemini": settings.gemini_available,
            "finnhub": settings.finnhub_available,
        },
        "providers": svc.get_provider_status(),
        "cache": svc.get_cache_stats(),
    }


# ── Routers ───────────────────────────────────────────────────────────────────
from api.ai import router as ai_router
from api.analytics import router as analytics_router
from api.auth import router as auth_router
from api.copilot import router as copilot_router
from api.local_ohlc import router as local_ohlc_router
from api.market import router as market_router
from api.portfolio import router as portfolio_router
from api.screener import router as screener_router
from api.screener import v2_router as screener_v2_router
from api.smc import router as smc_router
from api.watchlists import router as watchlists_router
from api.workspace import router as workspace_router

app.include_router(auth_router, prefix="/api/auth")
app.include_router(portfolio_router, prefix="/api/v2/portfolio")
app.include_router(analytics_router, prefix="/api/v2/analytics")
app.include_router(market_router, prefix="/api/v2/market")
app.include_router(ai_router, prefix="/api/v2/ai")
app.include_router(screener_router)  # /api/scanner/*
app.include_router(
    screener_v2_router
)  # /api/v2/scanner/scan-status + /trigger-scan + /ipo-vintage/listings
app.include_router(watchlists_router)  # /api/v2/watchlists
app.include_router(smc_router)  # /api/v2/scanner/smc + /zone-proximity
app.include_router(local_ohlc_router)  # /api/v2/scanner/local-ohlc/*
app.include_router(copilot_router)  # /api/v2/copilot/* (agentic AI copilot)
app.include_router(
    workspace_router, prefix="/api/v2/workspace"
)  # media + (later) desks


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.fastapi_port,
        reload=not settings.is_production,
        log_level="info",
    )
