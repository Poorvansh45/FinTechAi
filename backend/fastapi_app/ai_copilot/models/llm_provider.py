"""
LLM Provider Abstraction
========================
A single factory, `get_chat_model()`, returns a LangChain `BaseChatModel`
selected by the `AI_MODEL_PROVIDER` environment variable. Model choice is never
hardcoded in the agents — switching providers is a one-line env change:

    AI_MODEL_PROVIDER=gemini   # default (cheapest reliable — Gemini 2.5 Flash)
    AI_MODEL_PROVIDER=groq     # open-source models (Llama / Mixtral) via Groq

Adding OpenAI / Claude later means implementing one more branch here — no agent,
tool, or graph code changes.

Design rules:
- No API key is required at import time (keys are read lazily, per call), so the
  app and its test suite import cleanly without any provider configured.
- The active model can be overridden per call (e.g. tests inject a fake model),
  keeping every downstream component provider-agnostic and unit-testable.
"""

from __future__ import annotations

import logging
from typing import Optional

from langchain_core.language_models import BaseChatModel

from config import get_settings

log = logging.getLogger("finai_edge.copilot.llm")

# Supported providers. "openai"/"claude" are recognised but not yet wired.
SUPPORTED = {"gemini", "groq"}
PLACEHOLDER = {"openai", "claude"}

# Process-wide override, primarily for tests: when set, get_chat_model() returns
# it regardless of provider/env. Keeps the whole graph deterministic in CI.
_override_model: Optional[BaseChatModel] = None


def set_model_override(model: Optional[BaseChatModel]) -> None:
    """Force get_chat_model() to return `model` (or clear with None). Test hook."""
    global _override_model
    _override_model = model


def _build_gemini(model_name: str, temperature: float) -> BaseChatModel:
    from langchain_google_genai import ChatGoogleGenerativeAI

    settings = get_settings()
    return ChatGoogleGenerativeAI(
        model=model_name,
        google_api_key=settings.gemini_api_key,
        temperature=temperature,
    )


def _build_groq(model_name: str, temperature: float) -> BaseChatModel:
    from langchain_groq import ChatGroq

    settings = get_settings()
    return ChatGroq(
        model=model_name,
        api_key=settings.groq_api_key,
        temperature=temperature,
    )


def get_chat_model(
    provider: Optional[str] = None,
    *,
    model: Optional[str] = None,
    temperature: float = 0.3,
) -> BaseChatModel:
    """
    Return a LangChain chat model for the requested (or configured) provider.

    Args:
        provider: override AI_MODEL_PROVIDER for this call (e.g. "groq").
        model:    override the provider's default model name.
        temperature: sampling temperature (low default — this is an analyst, not
                     a creative writer).

    Raises:
        NotImplementedError: for recognised-but-unwired providers (openai/claude).
        ValueError: for unknown providers.
    """
    if _override_model is not None:
        return _override_model

    settings = get_settings()
    provider = (provider or settings.ai_model_provider or "gemini").lower()

    if provider == "gemini":
        return _build_gemini(model or settings.gemini_model, temperature)
    if provider == "groq":
        return _build_groq(model or settings.groq_model, temperature)
    if provider in PLACEHOLDER:
        raise NotImplementedError(
            f"Provider '{provider}' is a placeholder — install the matching "
            f"langchain integration (e.g. langchain-openai) and add a branch in "
            f"llm_provider.py to enable it."
        )
    raise ValueError(
        f"Unknown AI_MODEL_PROVIDER '{provider}'. Supported: {sorted(SUPPORTED)}; "
        f"placeholders: {sorted(PLACEHOLDER)}."
    )


def provider_status() -> dict:
    """Lightweight status for the /copilot/health endpoint (no key required)."""
    settings = get_settings()
    provider = (settings.ai_model_provider or "gemini").lower()
    return {
        "provider": provider,
        "model": settings.gemini_model if provider == "gemini" else settings.groq_model,
        "configured": settings.copilot_llm_available,
        "override_active": _override_model is not None,
    }
