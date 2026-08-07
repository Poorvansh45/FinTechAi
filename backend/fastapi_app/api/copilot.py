"""
FastAPI Router: AI Copilot (Phase 2A)
=====================================
Endpoints for the LangGraph agentic copilot, mounted at /api/v2/copilot.

Security: every route derives identity from the verified Express JWT via
`Depends(get_current_user)` (Phase 6 boundary). The chat request body does NOT
carry a user_id — it is taken from the token — and the /history path parameter
is ignored in favour of the token id, so a user can only ever see their own data.
"""

from __future__ import annotations

import logging
import time
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request

from config import get_settings
from utils.auth import get_current_user, get_current_role
from utils.rate_limit import check_rate_limit

from ai_copilot.schemas.chat import ChatRequest, ChatResponse
from ai_copilot.memory.memory_manager import MemoryManager
from ai_copilot.models.llm_provider import provider_status

log = logging.getLogger("finai_edge.api.copilot")
router = APIRouter(prefix="/api/v2/copilot", tags=["AI Copilot"])


def _db(request: Request):
    if getattr(request.app.state, "mongo_connected", False):
        return request.app.state.db
    return None


def _llm_ready() -> bool:
    status = provider_status()
    return bool(status.get("configured") or status.get("override_active"))


@router.post("/chat", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    request: Request,
    user_id: str = Depends(get_current_user),
    role: str = Depends(get_current_role),
):
    """Run one agentic copilot turn. Identity comes from the JWT, not the body."""
    # Every turn is a paid LLM call, and the demo credential is shared publicly —
    # so budget is enforced per account before any provider work begins.
    check_rate_limit("copilot_chat", user_id, role)

    session_id = req.session_id or f"sess_{uuid.uuid4().hex[:16]}"

    if not _llm_ready():
        # Graceful, non-error response so the UI can render a helpful message.
        return ChatResponse(
            answer=(
                "The AI copilot isn't configured yet. Set an API key for the active "
                "provider (e.g. GEMINI_API_KEY) to enable live analysis."
            ),
            agent_used="none",
            tools_called=[],
            reasoning_summary="LLM provider not configured.",
            suggestions=[],
            session_id=session_id,
        )

    # Import here so module import (and the CI smoke test) never needs the LLM stack.
    from ai_copilot.graph.workflow import run_copilot

    t0 = time.time()
    try:
        result = await run_copilot(
            message=req.message,
            user_id=user_id,
            session_id=session_id,
            db=_db(request),
        )
    except Exception as e:  # keep internal detail server-side only
        log.error(f"[copilot] chat failed for user={user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Copilot request failed.")

    latency_ms = (time.time() - t0) * 1000
    tokens = (result.get("token_usage") or {}).get("total_tokens", 0)
    log.info(
        f"[copilot] chat user={user_id} agent={result.get('agent_used')} "
        f"provider={result.get('provider_used')} tools={result.get('tools_called')} "
        f"tokens={tokens} {latency_ms:.0f}ms"
    )

    return ChatResponse(
        answer=result.get("answer", ""),
        agent_used=result.get("agent_used", "none"),
        provider_used=result.get("provider_used") or "none",
        tools_called=result.get("tools_called", []),
        reasoning_summary=result.get("reasoning_summary", ""),
        suggestions=result.get("suggestions", []),
        session_id=session_id,
    )


@router.get("/history/{user_id}")
async def history(
    user_id: str,  # path kept for API-spec compatibility; IGNORED for security
    request: Request,
    session_id: str | None = None,
    auth_user_id: str = Depends(get_current_user),
):
    """List the authenticated user's chat sessions (or one session's messages).

    The path `user_id` is ignored — data is always scoped to the token identity,
    so it is impossible to read another user's history.
    """
    mm = MemoryManager(_db(request))
    if session_id:
        messages = await mm.get_session_messages(auth_user_id, session_id)
        return {"user_id": auth_user_id, "session_id": session_id, "messages": messages}
    sessions = await mm.list_sessions(auth_user_id)
    return {"user_id": auth_user_id, "sessions": sessions}


@router.delete("/session/{session_id}")
async def delete_session(
    session_id: str,
    request: Request,
    user_id: str = Depends(get_current_user),
):
    """Delete a chat session and its messages (only the caller's own)."""
    mm = MemoryManager(_db(request))
    deleted = await mm.delete_session(user_id, session_id)
    return {"success": True, "session_id": session_id, "messages_deleted": deleted}


@router.get("/health")
async def copilot_health(request: Request):
    """Copilot subsystem status — provider, graph, and mongo. No auth / no key needed."""
    status = provider_status()
    graph_ok = True
    try:
        from ai_copilot.graph.workflow import get_graph

        get_graph()
    except Exception as e:  # pragma: no cover - defensive
        graph_ok = False
        log.warning(f"[copilot] graph build failed in health check: {e}")

    return {
        "status": "healthy",
        "service": "finai-edge-copilot",
        "llm_priority": status.get("priority"),
        "llm_providers": status.get("providers"),
        "llm_configured": status.get("configured"),
        "graph_compiled": graph_ok,
        "mongo_connected": getattr(request.app.state, "mongo_connected", False),
    }
