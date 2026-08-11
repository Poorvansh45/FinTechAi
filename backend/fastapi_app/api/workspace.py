"""
FinAI Edge — FastAPI Router: Workspace (foundation)
=====================================================
Phase 1 surface for the Workspace productivity suite. Owns media uploads
(screenshots, charts, PDFs) via the pluggable StorageProvider, plus a ping the
frontend shell uses to confirm connectivity. Trading- and Investment-Desk data
routers land in later phases; this router is the shared foundation.

All endpoints are JWT-scoped to the caller (`get_current_user`).
"""

import logging

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
)
from fastapi.responses import Response

from config import get_settings
from services.media_service import MediaError, MediaService
from utils.auth import get_current_user

log = logging.getLogger("finai_edge.api.workspace")
router = APIRouter()


def _db(request: Request):
    db = getattr(request.app.state, "db", None)
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")
    return db


@router.get("/ping")
async def ping(user_id: str = Depends(get_current_user)):
    """Connectivity + auth check used by the Workspace shell on mount."""
    return {"success": True, "user_id": user_id, "module": "workspace"}


# ── Media ─────────────────────────────────────────────────────────────────────


@router.post("/media")
async def upload_media(
    request: Request,
    file: UploadFile = File(...),
    kind: str = Form("screenshot"),
    linked_type: str | None = Form(None),
    linked_id: str | None = Form(None),
    user_id: str = Depends(get_current_user),
):
    """Upload one media file. Stores bytes via the StorageProvider and metadata
    in `ws_media`; returns `{id, url}` to embed on a trade/note."""
    settings = get_settings()
    svc = MediaService(_db(request), max_mb=settings.workspace_max_upload_mb)
    data = await file.read()
    try:
        res = await svc.upload(
            user_id=user_id,
            filename=file.filename or "upload",
            data=data,
            content_type=file.content_type or "application/octet-stream",
            kind=kind,
            linked_type=linked_type,
            linked_id=linked_id,
        )
    except MediaError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {"success": True, **res}


@router.get("/media/{media_id}/raw")
async def serve_media(
    media_id: str, request: Request, user_id: str = Depends(get_current_user)
):
    """Stream a stored media object back (authenticated — private like a bucket)."""
    svc = MediaService(_db(request))
    got = await svc.open(user_id, media_id)
    if got is None:
        raise HTTPException(status_code=404, detail="Media not found")
    data, mime = got
    return Response(
        content=data,
        media_type=mime,
        headers={"Cache-Control": "private, max-age=3600"},
    )


@router.get("/media")
async def list_media(
    request: Request,
    linked_type: str = Query(...),
    linked_id: str = Query(...),
    user_id: str = Depends(get_current_user),
):
    """List media linked to an entity (e.g. all screenshots on a trade)."""
    svc = MediaService(_db(request))
    return {
        "success": True,
        "media": await svc.list_for(user_id, linked_type, linked_id),
    }


@router.delete("/media/{media_id}")
async def delete_media(
    media_id: str, request: Request, user_id: str = Depends(get_current_user)
):
    svc = MediaService(_db(request))
    ok = await svc.delete(user_id, media_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Media not found")
    return {"success": True}
