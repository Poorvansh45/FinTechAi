"""
FinAI Edge — FastAPI Router: Market Data
==========================================
Market data endpoints: quotes, search, candles, bulk quotes, provider status.
"""

import logging
from fastapi import APIRouter, HTTPException, Query
from services.market_service import get_market_service

log = logging.getLogger("finai_edge.api.market")
router = APIRouter()


@router.get("/quote/{symbol}")
async def get_quote(symbol: str):
    """Get live quote for a symbol (cached 5 min)."""
    try:
        service = get_market_service()
        quote = await service.get_quote(symbol)
        return {
            "success": True,
            "data": quote.model_dump(),
        }
    except Exception as e:
        log.error(f"Quote failed for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search")
async def search_instruments(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(12, ge=1, le=50),
):
    """Search instruments by ticker, name, or sector."""
    try:
        service = get_market_service()
        results = await service.search(q, limit)
        return {
            "success": True,
            "results": [r.model_dump() for r in results],
            "count": len(results),
        }
    except Exception as e:
        log.error(f"Search failed for '{q}': {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/candles/{symbol}")
async def get_candles(
    symbol: str,
    interval: str = Query("1d", description="Candle interval: 1d, 1h, 5m"),
    period: str = Query("1y", description="Time period: 1mo, 3mo, 6mo, 1y, 2y, 5y"),
):
    """Get historical OHLCV candles (cached 1 hour)."""
    try:
        service = get_market_service()
        candles = await service.get_historical(symbol, interval, period)
        return {
            "success": True,
            "symbol": symbol,
            "interval": interval,
            "period": period,
            "count": len(candles),
            "candles": [c.model_dump() for c in candles],
        }
    except Exception as e:
        log.error(f"Candles failed for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/bulk-quotes")
async def get_bulk_quotes(
    symbols: str = Query(..., description="Comma-separated ticker symbols"),
):
    """Get quotes for multiple symbols at once."""
    try:
        symbol_list = [s.strip() for s in symbols.split(",") if s.strip()]
        if not symbol_list:
            raise HTTPException(status_code=400, detail="No symbols provided.")
        if len(symbol_list) > 30:
            raise HTTPException(status_code=400, detail="Maximum 30 symbols per request.")

        service = get_market_service()
        quotes = await service.get_bulk_quotes(symbol_list)
        return {
            "success": True,
            "quotes": {sym: q.model_dump() for sym, q in quotes.items()},
            "count": len(quotes),
        }
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Bulk quotes failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/provider-status")
async def provider_status():
    """Check which market data providers are active and healthy."""
    try:
        service = get_market_service()
        return {
            "success": True,
            "providers": service.get_provider_status(),
            "cache": service.get_cache_stats(),
        }
    except Exception as e:
        log.error(f"Provider status check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
