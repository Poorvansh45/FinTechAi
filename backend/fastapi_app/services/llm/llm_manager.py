"""
LLMManager — provider-agnostic LLM layer with automatic failover.

Tries providers in priority order (Gemini -> Groq -> ...future providers). On
any failure from one provider (after its own retry budget is exhausted —
quota exhaustion, timeout, connection error, HTTP 429/5xx, or anything else),
LLMManager immediately moves to the next provider and returns its response
transparently. The caller (an agent) never has to know a fallback occurred —
it just gets back an AIMessage plus the name of whichever provider answered.

Extending to OpenAI / Claude / a local Ollama model later means adding one more
BaseLLMProvider implementation and appending it to the provider list built in
`ai_copilot/models/llm_provider.py` — no changes here, and no changes in any
agent or graph code.
"""

from __future__ import annotations

import logging
import time
from typing import Optional, Sequence

from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.runnables import RunnableConfig

from .base import BaseLLMProvider, LLMProviderError

log = logging.getLogger("finai_edge.copilot.llm.manager")


class AllProvidersFailedError(Exception):
    """Raised when every configured provider failed to answer."""

    def __init__(self, attempts: list[LLMProviderError]):
        self.attempts = attempts
        summary = "; ".join(f"{a.provider}: {a.original}" for a in attempts)
        super().__init__(f"All LLM providers failed — {summary}")


class LLMManager:
    def __init__(self, providers: Sequence[BaseLLMProvider]):
        if not providers:
            raise ValueError("LLMManager requires at least one provider")
        self.providers: list[BaseLLMProvider] = list(providers)

    async def ainvoke(
        self,
        messages: Sequence[BaseMessage],
        *,
        tools: Optional[list] = None,
        config: Optional[RunnableConfig] = None,
    ) -> tuple[AIMessage, str]:
        """
        Try each provider in order. Returns (message, provider_name) from the
        first one that succeeds. Raises AllProvidersFailedError only if every
        provider in the chain failed.
        """
        failures: list[LLMProviderError] = []

        for i, provider in enumerate(self.providers):
            t0 = time.time()
            try:
                msg = await provider.ainvoke(messages, tools=tools, config=config)
                return msg, provider.provider_name
            except LLMProviderError as e:
                failures.append(e)
                is_last = i == len(self.providers) - 1
                dur_ms = (time.time() - t0) * 1000
                if not is_last:
                    next_name = self.providers[i + 1].provider_name.capitalize()
                    log.warning(
                        f"[LLM] {provider.provider_name.capitalize()} unavailable "
                        f"({dur_ms:.0f}ms): {e.original}. Switching to {next_name}..."
                    )
                else:
                    log.error(
                        f"[LLM] {provider.provider_name.capitalize()} unavailable "
                        f"({dur_ms:.0f}ms): {e.original}. No further providers to try."
                    )

        raise AllProvidersFailedError(failures)

    async def health_check(self) -> dict[str, bool]:
        return {p.provider_name: await p.health_check() for p in self.providers}

    @property
    def provider_names(self) -> list[str]:
        return [p.provider_name for p in self.providers]
