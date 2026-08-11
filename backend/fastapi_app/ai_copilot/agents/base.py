"""
Shared ReAct executor for the specialist agents.

Rather than depend on a specific `create_react_agent` signature (which shifts
between LangGraph versions), each agent uses this small, explicit tool-calling
loop. It is intentionally transparent so we can hook observability (per-tool
logs, latency, token usage) and keep it fully deterministic under a scripted
fake model in tests.

Flow: invoke the LLMManager (which itself fails over Gemini -> Groq internally)
→ if the model returns tool_calls, execute them (async), append ToolMessages,
loop; otherwise return the final answer plus which provider produced it.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_core.runnables import RunnableConfig

log = logging.getLogger("finai_edge.copilot.agent")

MAX_TOOL_ITERS = 5


def build_messages(
    system_prompt: str, history: list[dict], user_message: str
) -> list[BaseMessage]:
    """Assemble the LLM message list: system + prior turns + current message."""
    msgs: list[BaseMessage] = [SystemMessage(content=system_prompt)]
    for h in history or []:
        role = (h.get("role") or "").lower()
        content = h.get("content") or ""
        if not content:
            continue
        if role in ("assistant", "ai"):
            msgs.append(AIMessage(content=content))
        else:
            msgs.append(HumanMessage(content=content))
    msgs.append(HumanMessage(content=user_message))
    return msgs


def _accumulate_tokens(usage: dict, message: Any) -> None:
    meta = getattr(message, "usage_metadata", None)
    if isinstance(meta, dict):
        usage["input_tokens"] += meta.get("input_tokens", 0) or 0
        usage["output_tokens"] += meta.get("output_tokens", 0) or 0
        usage["total_tokens"] += meta.get("total_tokens", 0) or 0


def extract_answer_text(content: Any) -> str:
    """
    Robustly extract plain Markdown text from a LangChain message's `.content`.

    Most providers return a plain string. Some (notably Gemini via
    langchain-google-genai) can return a list of content blocks instead, e.g.
    `[{"type": "text", "text": "..."}]` when the response has structured parts.
    Blindly `str()`-ing that list leaks the raw block structure to the client
    (the bug this fixes) — extract only the actual text and join it.
    """
    if isinstance(content, str):
        return content

    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                block_type = block.get("type")
                if block_type in (None, "text") and "text" in block:
                    parts.append(str(block["text"]))
                # Non-text blocks (tool_use, image, thinking, etc.) are
                # intentionally skipped — never leak their raw structure.
            else:
                text_attr = getattr(block, "text", None)
                if text_attr:
                    parts.append(str(text_attr))
        return "".join(parts)

    if content is None:
        return ""

    # Unexpected shape (shouldn't happen with str/list) — log so we notice,
    # but still avoid returning a Python repr to the client.
    log.warning(f"[copilot] unexpected message content type: {type(content)!r}")
    return ""


async def run_agent(
    *,
    agent_name: str,
    llm_manager: Any,
    tools: list,
    system_prompt: str,
    history: list[dict],
    user_message: str,
    config: RunnableConfig | None = None,
    extra_context: str = "",
) -> dict:
    """
    Run one specialist agent to completion.

    `llm_manager` is a `services.llm.llm_manager.LLMManager` — every call goes
    through it so Gemini -> Groq failover is transparent to this loop.

    Returns dict: {answer, provider_used, tools_called, token_usage, iterations, error}.
    Observability: logs agent entry, every tool call (name + args) and its
    latency, and accumulates token usage when the provider exposes it.
    """
    tool_map = {t.name: t for t in tools}
    tools_called: list[str] = []
    usage = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
    provider_used: str | None = None
    t0 = time.time()
    log.info(f"[copilot] agent='{agent_name}' start tools={list(tool_map)}")

    try:
        prompt = system_prompt + (f"\n\n{extra_context}" if extra_context else "")
        messages = build_messages(prompt, history, user_message)

        for iteration in range(MAX_TOOL_ITERS):
            ai_msg, provider_used = await llm_manager.ainvoke(
                messages, tools=tools, config=config
            )
            _accumulate_tokens(usage, ai_msg)
            messages.append(ai_msg)

            tool_calls = getattr(ai_msg, "tool_calls", None) or []
            if not tool_calls:
                answer = extract_answer_text(ai_msg.content)
                dur = time.time() - t0
                log.info(
                    f"[copilot] agent='{agent_name}' done iters={iteration + 1} "
                    f"provider={provider_used} tools={tools_called} "
                    f"tokens={usage['total_tokens']} {dur:.2f}s"
                )
                return {
                    "answer": answer.strip(),
                    "provider_used": provider_used,
                    "tools_called": tools_called,
                    "token_usage": usage,
                    "iterations": iteration + 1,
                    "error": None,
                }

            # Execute each requested tool
            for call in tool_calls:
                name = call.get("name")
                args = call.get("args", {}) or {}
                tools_called.append(name)
                tool = tool_map.get(name)
                ts = time.time()
                if tool is None:
                    result = f"Tool '{name}' is not available."
                    log.warning(f"[copilot] agent='{agent_name}' unknown tool '{name}'")
                else:
                    try:
                        result = await tool.ainvoke(args, config=config)
                    except (
                        Exception
                    ) as e:  # tool-level failure shouldn't crash the turn
                        result = f"Tool '{name}' failed: {e}"
                        log.warning(f"[copilot] tool '{name}' error: {e}")
                log.info(
                    f"[copilot] agent='{agent_name}' tool='{name}' args={args} "
                    f"{(time.time() - ts) * 1000:.0f}ms"
                )
                messages.append(
                    ToolMessage(content=str(result), tool_call_id=call.get("id", name))
                )

        # Hit iteration cap — return best-effort note.
        log.warning(f"[copilot] agent='{agent_name}' hit tool-iteration cap")
        return {
            "answer": "I gathered some data but couldn't fully complete the analysis in time. "
            "Could you narrow the question?",
            "provider_used": provider_used,
            "tools_called": tools_called,
            "token_usage": usage,
            "iterations": MAX_TOOL_ITERS,
            "error": "max_iterations",
        }

    except Exception as e:
        log.exception(f"[copilot] agent='{agent_name}' failed")
        return {
            "answer": "",
            "provider_used": provider_used,
            "tools_called": tools_called,
            "token_usage": usage,
            "iterations": 0,
            "error": str(e),
        }
