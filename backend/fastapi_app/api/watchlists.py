from fastapi import APIRouter, Request, HTTPException, Depends
from typing import List, Dict, Any

from db.models.watchlist import WatchlistCreate, WatchlistStockCreate
from services.watchlist_service import get_watchlist_service, WatchlistService
from utils.auth import get_current_user, require_not_demo

router = APIRouter(prefix="/api/v2/watchlists", tags=["Watchlists"])

# The demo credential is published publicly, so it is shared by strangers who
# would otherwise overwrite each other's lists. Reads stay open so a visitor can
# explore the feature; writes are refused.
DEMO_READONLY = Depends(require_not_demo("Editing watchlists"))

def get_service(request: Request) -> WatchlistService:
    if not hasattr(request.app.state, "db") or request.app.state.db is None:
        raise HTTPException(503, "Database not connected")
    return get_watchlist_service(request.app.state.db)

@router.post("", dependencies=[DEMO_READONLY])
async def create_watchlist(data: WatchlistCreate, request: Request, user_id: str = Depends(get_current_user)):
    svc = get_service(request)
    wl = await svc.create_watchlist(data, user_id=user_id)
    return {"success": True, "watchlist": wl}

@router.get("")
async def get_watchlists(request: Request, user_id: str = Depends(get_current_user)):
    svc = get_service(request)
    watchlists = await svc.get_user_watchlists(user_id=user_id)
    return {"success": True, "data": watchlists}

@router.get("/leaderboard")
async def get_watchlist_leaderboard(request: Request, user_id: str = Depends(get_current_user)):
    svc = get_service(request)
    leaderboard = await svc.get_watchlist_leaderboard(user_id)
    return {"success": True, "leaderboard": leaderboard}

@router.get("/source-performance")
async def get_source_performance(request: Request, user_id: str = Depends(get_current_user)):
    svc = get_service(request)
    perf = await svc.get_source_performance()
    return {"success": True, "source_performance": perf}

@router.get("/{id}")
async def get_watchlist_details(id: str, request: Request, user_id: str = Depends(get_current_user)):
    svc = get_service(request)
    details = await svc.get_watchlist_details(id, user_id)
    return {"success": True, **details}

@router.get("/{id}/performance")
async def get_watchlist_performance(id: str, request: Request, user_id: str = Depends(get_current_user)):
    svc = get_service(request)
    perf = await svc.get_watchlist_performance_by_source(id, user_id)
    return {"success": True, **perf}

@router.post("/{id}/stocks", dependencies=[DEMO_READONLY])
async def add_stock(id: str, data: WatchlistStockCreate, request: Request, user_id: str = Depends(get_current_user)):
    svc = get_service(request)
    stock = await svc.add_stock(id, data, user_id)
    return {"success": True, "stock": stock}

@router.delete("/{id}/stocks/{symbol}", dependencies=[DEMO_READONLY])
async def remove_stock(id: str, symbol: str, request: Request, user_id: str = Depends(get_current_user)):
    svc = get_service(request)
    await svc.remove_stock(id, symbol, user_id)
    return {"success": True, "message": f"Stock {symbol} removed and archived to history"}

@router.patch("/{id}", dependencies=[DEMO_READONLY])
async def update_watchlist(id: str, request: Request, user_id: str = Depends(get_current_user)):
    svc = get_service(request)
    data = await request.json()
    if "name" in data:
        await svc.rename_watchlist(id, data["name"], user_id)
    if data.get("is_archived"):
        await svc.archive_watchlist(id, user_id)
    return {"success": True}

@router.delete("/{id}", dependencies=[DEMO_READONLY])
async def delete_watchlist(id: str, request: Request, user_id: str = Depends(get_current_user)):
    svc = get_service(request)
    await svc.delete_watchlist(id, user_id)
    return {"success": True, "message": "Watchlist deleted and history preserved"}

@router.post("/{id}/duplicate", dependencies=[DEMO_READONLY])
async def duplicate_watchlist(id: str, request: Request, user_id: str = Depends(get_current_user)):
    svc = get_service(request)
    wl = await svc.duplicate_watchlist(id, user_id)
    return {"success": True, "watchlist": wl}
