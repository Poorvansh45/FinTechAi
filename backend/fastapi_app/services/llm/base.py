"""
BaseLLMProvider — abstract interface every LLM provider implements.

The interface is deliberately narrow (invoke / ainvoke / health_check /
provider_name) so LLMManager can fail over between providers without any agent
code knowing which one actually answered. Each concrete provider wraps its own
LangChain chat model internally and owns its own retry/timeout policy.

Adding a new provider (OpenAI, Claude, DeepSeek, a local Ollama model, ...)
means writing one more class here — no agent, tool, or graph code changes.
"""

from __future__ import annotations

import abc
from collections.abc import Sequence

from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.runnables import RunnableConfig


class LLMProviderError(Exception):
    """
    Raised by a provider when it has exhausted its own retries and cannot
    produce a response. Carries the provider name + original exception so
    LLMManager can log a clear reason before failing over.
    """

    def __init__(self, provider: str, original: Exception):
        self.provider = provider
        self.original = original
        super().__init__(f"[{provider}] {original}")


def classify_error(exc: Exception) -> str:
    """
    Best-effort classification of a provider failure, used only for clear log
    messages (never for control flow — providers/manager treat any exception
    the same way: retry within budget, then fail over).
    """
    if isinstance(exc, TimeoutError):
        return "timeout"
    msg = str(exc).lower()
    if "resource_exhausted" in msg or "quota" in msg or "429" in msg:
        return "quota exceeded"
    if "timeout" in msg or "timed out" in msg:
        return "timeout"
    if "connection" in msg or "connect" in msg or "network" in msg:
        return "connection error"
    for code in ("500", "502", "503", "504"):
        if code in msg:
            return f"HTTP {code}"
    return "error"


class BaseLLMProvider(abc.ABC):
    """Uniform surface every LLM provider must implement."""

    provider_name: str

    @abc.abstractmethod
    async def ainvoke(
        self,
        messages: Sequence[BaseMessage],
        *,
        tools: list | None = None,
        config: RunnableConfig | None = None,
    ) -> AIMessage:
        """Invoke the model asynchronously. Must raise LLMProviderError on
        unrecoverable failure (after this provider's own retry budget)."""
        ...

    @abc.abstractmethod
    def invoke(
        self,
        messages: Sequence[BaseMessage],
        *,
        tools: list | None = None,
        config: RunnableConfig | None = None,
    ) -> AIMessage:
        """Synchronous variant of ainvoke."""
        ...

    @abc.abstractmethod
    async def health_check(self) -> bool:
        """Cheap, non-network check of whether this provider is configured."""
        ...
