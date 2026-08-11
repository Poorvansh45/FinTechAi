"""
GeminiProvider — primary LLM provider (Gemini Flash via langchain-google-genai).

Hard timeout + bounded retries so a Gemini outage (quota exhaustion, timeout,
connection error, 429/5xx) fails fast instead of hanging the request — this is
what previously caused ~75s waits before LLMManager could fail over to Groq.

Two safeguards make the timeout real regardless of what the underlying SDK does
internally:
  1. `max_retries=0` on the LangChain client itself, so it never silently
     retries-with-backoff before our code even sees the exception.
  2. `asyncio.wait_for(..., timeout=...)` wraps every attempt — even if the SDK
     were to sleep internally (e.g. honoring a 429 `retry_delay` hint), the
     awaiting task is force-cancelled at the timeout regardless.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Sequence

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.runnables import RunnableConfig

from .base import BaseLLMProvider, LLMProviderError, classify_error

log = logging.getLogger("finai_edge.copilot.llm.gemini")

DEFAULT_TIMEOUT_S = 15.0
MAX_RETRIES = 1  # 1 retry after the first attempt = 2 attempts max


class GeminiProvider(BaseLLMProvider):
    provider_name = "gemini"

    def __init__(
        self,
        api_key: str | None,
        model: str,
        *,
        timeout_s: float = DEFAULT_TIMEOUT_S,
        max_retries: int = MAX_RETRIES,
        temperature: float = 0.3,
    ):
        self._api_key = api_key
        self._model_name = model
        self._timeout_s = timeout_s
        self._max_retries = max_retries
        self._temperature = temperature
        self._model: BaseChatModel | None = None

    @property
    def available(self) -> bool:
        return bool(self._api_key)

    def _get_model(self) -> BaseChatModel:
        if self._model is None:
            from langchain_google_genai import ChatGoogleGenerativeAI

            self._model = ChatGoogleGenerativeAI(
                model=self._model_name,
                google_api_key=self._api_key,
                temperature=self._temperature,
                max_retries=0,  # we own retry/timeout policy — see module docstring
            )
        return self._model

    async def ainvoke(
        self,
        messages: Sequence[BaseMessage],
        *,
        tools: list | None = None,
        config: RunnableConfig | None = None,
    ) -> AIMessage:
        if not self.available:
            raise LLMProviderError(
                self.provider_name, RuntimeError("GEMINI_API_KEY not configured")
            )

        last_exc: Exception | None = None
        attempts = self._max_retries + 1
        for attempt in range(1, attempts + 1):
            t0 = time.time()
            try:
                model = self._get_model()
                bound = model.bind_tools(tools) if tools else model
                msg = await asyncio.wait_for(
                    bound.ainvoke(messages, config=config), timeout=self._timeout_s
                )
                log.info(f"[LLM] Provider: Gemini ({(time.time() - t0) * 1000:.0f}ms)")
                return msg
            except asyncio.TimeoutError as e:
                last_exc = e
                log.warning(
                    f"[LLM] Gemini timed out after {self._timeout_s:.0f}s "
                    f"(attempt {attempt}/{attempts})"
                )
            except Exception as e:
                last_exc = e
                log.warning(
                    f"[LLM] Gemini {classify_error(e)} (attempt {attempt}/{attempts}): {e}"
                )

        raise LLMProviderError(
            self.provider_name, last_exc or RuntimeError("unknown Gemini failure")
        )

    def invoke(
        self,
        messages: Sequence[BaseMessage],
        *,
        tools: list | None = None,
        config: RunnableConfig | None = None,
    ) -> AIMessage:
        # Sync path: no hard timeout enforcement (Python has no reliable
        # cross-platform sync timeout for a blocking network call). The async
        # path above is what the graph/agents actually use; this exists to
        # satisfy the provider interface for any future sync caller.
        if not self.available:
            raise LLMProviderError(
                self.provider_name, RuntimeError("GEMINI_API_KEY not configured")
            )

        last_exc: Exception | None = None
        attempts = self._max_retries + 1
        for attempt in range(1, attempts + 1):
            t0 = time.time()
            try:
                model = self._get_model()
                bound = model.bind_tools(tools) if tools else model
                msg = bound.invoke(messages, config=config)
                log.info(f"[LLM] Provider: Gemini ({(time.time() - t0) * 1000:.0f}ms)")
                return msg
            except Exception as e:
                last_exc = e
                log.warning(
                    f"[LLM] Gemini {classify_error(e)} (attempt {attempt}/{attempts}): {e}"
                )
        raise LLMProviderError(
            self.provider_name, last_exc or RuntimeError("unknown Gemini failure")
        )

    async def health_check(self) -> bool:
        return self.available
