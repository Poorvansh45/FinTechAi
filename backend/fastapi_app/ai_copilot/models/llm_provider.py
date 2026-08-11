"""
LLM Manager Wiring
==================
Builds the production `LLMManager` — Gemini (primary) with automatic failover
to Groq (fallback) — from settings, and exposes the test-override hook that
lets the test suite inject a deterministic fake model without any agent code
knowing the difference.

Adding a new provider (OpenAI, Claude, DeepSeek, a local Ollama model, ...)
means writing one class in `services/llm/` and appending it to the provider
list in `get_llm_manager()` below — no agent, tool, or graph code changes.

Design rules:
- No API key is required at import time (keys are read lazily, per call), so
  the app and its test suite import cleanly without any provider configured.
- The active model can be overridden per call (tests inject a fake model),
  keeping every downstream component provider-agnostic and unit-testable.
"""

from __future__ import annotations

import logging
from collections.abc import Sequence

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.runnables import RunnableConfig

from config import get_settings
from services.llm.base import BaseLLMProvider
from services.llm.gemini_provider import GeminiProvider
from services.llm.groq_provider import GroqProvider
from services.llm.llm_manager import LLMManager

log = logging.getLogger("finai_edge.copilot.llm")

# Process-wide override, primarily for tests: when set, get_llm_manager()
# returns a single-provider manager wrapping this raw LangChain model instead
# of building the real Gemini -> Groq chain. Keeps the whole graph deterministic
# in CI with zero API keys.
_override_model: BaseChatModel | None = None


def set_model_override(model: BaseChatModel | None) -> None:
    """Force get_llm_manager() to use `model` directly (or clear with None)."""
    global _override_model
    _override_model = model


class _RawModelProvider(BaseLLMProvider):
    """
    Wraps an already-constructed LangChain chat model as a single provider.
    Used only for `set_model_override()` (tests / manual injection) — never
    part of the production Gemini -> Groq chain.
    """

    provider_name = "test-override"

    def __init__(self, model: BaseChatModel):
        self._model = model

    async def ainvoke(
        self,
        messages: Sequence[BaseMessage],
        *,
        tools: list | None = None,
        config: RunnableConfig | None = None,
    ) -> AIMessage:
        bound = self._model.bind_tools(tools) if tools else self._model
        return await bound.ainvoke(messages, config=config)

    def invoke(
        self,
        messages: Sequence[BaseMessage],
        *,
        tools: list | None = None,
        config: RunnableConfig | None = None,
    ) -> AIMessage:
        bound = self._model.bind_tools(tools) if tools else self._model
        return bound.invoke(messages, config=config)

    async def health_check(self) -> bool:
        return True


def get_llm_manager() -> LLMManager:
    """
    Build the provider-agnostic LLM layer used by every agent and the
    supervisor: Gemini (primary) -> Groq (fallback). Both providers are always
    registered (each is a no-op/fails-fast if its key is unset) so the chain
    degrades gracefully rather than needing an env var to pick "the" provider.
    """
    if _override_model is not None:
        return LLMManager([_RawModelProvider(_override_model)])

    settings = get_settings()
    providers: list[BaseLLMProvider] = [
        GeminiProvider(api_key=settings.gemini_api_key, model=settings.gemini_model),
        GroqProvider(api_key=settings.groq_api_key, model=settings.groq_model),
        # Future: OpenAIProvider(...), ClaudeProvider(...), OllamaProvider(...)
    ]
    return LLMManager(providers)


def provider_status() -> dict:
    """Status for the /copilot/health endpoint (no key required)."""
    settings = get_settings()
    return {
        "priority": ["gemini", "groq"],
        "providers": {
            "gemini": {
                "configured": settings.gemini_available,
                "model": settings.gemini_model,
            },
            "groq": {
                "configured": settings.groq_available,
                "model": settings.groq_model,
            },
        },
        "configured": settings.copilot_llm_available,
        "override_active": _override_model is not None,
    }
