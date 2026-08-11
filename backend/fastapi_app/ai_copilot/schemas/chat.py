"""
Request/response schemas for the copilot chat API.

Note: `user_id` is intentionally NOT part of ChatRequest — identity is derived
from the verified JWT (Depends(get_current_user)) in the router, consistent with
the Phase 6 security boundary. The client only supplies the message and an
optional session id.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

MAX_MESSAGE_CHARS = 4000


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=MAX_MESSAGE_CHARS)
    session_id: str | None = Field(
        None, description="Conversation id; a new one is generated if omitted."
    )


class ChatResponse(BaseModel):
    answer: str
    agent_used: str
    provider_used: str = (
        "none"  # which LLM answered — gemini | groq | ... (failover is transparent)
    )
    tools_called: list[str] = Field(default_factory=list)
    reasoning_summary: str = ""
    suggestions: list[str] = Field(default_factory=list)
    session_id: str
