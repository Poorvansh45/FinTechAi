"""
AI Copilot tests — run in CI with NO API keys and NO MongoDB.

Strategy:
- Inject a `ScriptedChatModel` (a BaseChatModel that returns preset messages,
  including tool calls) through the provider factory's override, so the whole
  LangGraph flow is deterministic without any LLM key.
- Inject an in-memory `FakeDB` (dict-backed, async API subset) so memory and the
  portfolio tool work without Mongo.

Covers: supervisor routing, tool execution across agents, the full graph
end-to-end, memory save/load + profile learning, provider fallback/placeholders,
and the /copilot HTTP endpoints (auth-overridden).
"""

import asyncio
from typing import List, Optional

import pytest
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.outputs import ChatGeneration, ChatResult

from ai_copilot.models.llm_provider import (
    get_llm_manager,
    set_model_override,
    provider_status,
)
from ai_copilot.memory.memory_manager import MemoryManager


# ── Test doubles ────────────────────────────────────────────────────────────────
class ScriptedChatModel(BaseChatModel):
    """Returns pre-scripted AIMessages in order; tolerates bind_tools()."""

    scripted: List[AIMessage]

    def bind_tools(self, tools, **kwargs):
        return self

    def _generate(self, messages, stop=None, run_manager=None, **kwargs):
        msg = self.scripted.pop(0)
        return ChatResult(generations=[ChatGeneration(message=msg)])

    @property
    def _llm_type(self):
        return "scripted"


def _match(doc: dict, flt: dict) -> bool:
    return all(doc.get(k) == v for k, v in flt.items())


class _Result:
    def __init__(self, deleted_count=0, inserted_id=None):
        self.deleted_count = deleted_count
        self.inserted_id = inserted_id


class _Cursor:
    def __init__(self, docs):
        self._docs = docs

    def sort(self, key, direction=1):
        # Supports both .sort("field", dir) and .sort([("f1", d1), ("f2", d2)]).
        keys = key if isinstance(key, list) else [(key, direction)]
        for k, d in reversed(keys):  # least-significant first (stable)
            self._docs = sorted(self._docs, key=lambda doc: doc.get(k), reverse=(d == -1))
        return self

    def limit(self, n):
        self._docs = self._docs[:n]
        return self

    def __aiter__(self):
        self._it = iter(self._docs)
        return self

    async def __anext__(self):
        try:
            return next(self._it)
        except StopIteration:
            raise StopAsyncIteration


class FakeCollection:
    def __init__(self):
        self.docs: list[dict] = []
        self._seq = 0  # monotonic id, mimics ObjectId ordering for tiebreaks

    def find(self, flt=None, projection=None):
        flt = flt or {}
        return _Cursor([dict(d) for d in self.docs if _match(d, flt)])

    async def insert_one(self, doc):
        self._seq += 1
        d = dict(doc)
        d.setdefault("_id", self._seq)
        self.docs.append(d)
        return _Result(inserted_id=d["_id"])

    async def find_one(self, flt):
        for d in self.docs:
            if _match(d, flt):
                return dict(d)
        return None

    async def update_one(self, flt, update, upsert=False):
        target = next((d for d in self.docs if _match(d, flt)), None)
        if target is None:
            if not upsert:
                return _Result()
            target = dict(flt)
            for k, v in update.get("$setOnInsert", {}).items():
                target[k] = v
            self.docs.append(target)
        for k, v in update.get("$set", {}).items():
            target[k] = v
        for k, v in update.get("$inc", {}).items():
            target[k] = target.get(k, 0) + v
        return _Result()

    async def delete_many(self, flt):
        before = len(self.docs)
        self.docs = [d for d in self.docs if not _match(d, flt)]
        return _Result(deleted_count=before - len(self.docs))

    async def delete_one(self, flt):
        for i, d in enumerate(self.docs):
            if _match(d, flt):
                self.docs.pop(i)
                return _Result(deleted_count=1)
        return _Result()


class FakeDB:
    def __init__(self):
        self.collections: dict[str, FakeCollection] = {}

    def __getitem__(self, name):
        return self.collections.setdefault(name, FakeCollection())


def scripted(*messages: AIMessage) -> ScriptedChatModel:
    return ScriptedChatModel(scripted=list(messages))


def manager_for(model: ScriptedChatModel):
    """Wrap a scripted model as a single-provider LLMManager, exactly how the
    production code obtains one via get_llm_manager() when an override is set."""
    set_model_override(model)
    return get_llm_manager()


def tool_call(name: str, args: Optional[dict] = None, call_id: str = "c1") -> AIMessage:
    return AIMessage(content="", tool_calls=[{"name": name, "args": args or {}, "id": call_id}])


@pytest.fixture(autouse=True)
def _clear_override():
    set_model_override(None)
    yield
    set_model_override(None)


# ── Content extraction (Gemini list-of-content-blocks bug) ──────────────────────
def test_extract_answer_text_handles_plain_string():
    from ai_copilot.agents.base import extract_answer_text

    assert extract_answer_text("Hello **world**") == "Hello **world**"


def test_extract_answer_text_handles_list_of_text_blocks():
    from ai_copilot.agents.base import extract_answer_text

    # This is the exact shape Gemini/langchain-google-genai can return instead
    # of a plain string — the bug this fixes.
    content = [{"type": "text", "text": "## Analysis\n\nYour portfolio is diversified."}]
    result = extract_answer_text(content)
    assert result == "## Analysis\n\nYour portfolio is diversified."
    # Must never leak the raw block structure.
    assert "{" not in result and "'type'" not in result and '"type"' not in result


def test_extract_answer_text_joins_multiple_text_blocks_and_skips_non_text():
    from ai_copilot.agents.base import extract_answer_text

    content = [
        {"type": "text", "text": "Part one. "},
        {"type": "thinking", "text": "internal reasoning — must not leak"},
        {"type": "text", "text": "Part two."},
    ]
    result = extract_answer_text(content)
    assert result == "Part one. Part two."
    assert "internal reasoning" not in result


def test_extract_answer_text_handles_none_and_unexpected_types():
    from ai_copilot.agents.base import extract_answer_text

    assert extract_answer_text(None) == ""
    assert extract_answer_text(42) == ""  # never crashes, never leaks a raw repr


def test_run_agent_with_list_content_response_returns_clean_markdown():
    """End-to-end: a scripted model whose final message uses Gemini's list-content
    shape must still produce a clean Markdown string in the agent's answer."""
    from ai_copilot.agents.base import run_agent

    mgr = manager_for(scripted(
        AIMessage(content=[{"type": "text", "text": "**Reliance** trades at ₹2,500.\n\n- Sector: Energy"}]),
    ))
    result = asyncio.run(
        run_agent(
            agent_name="market",
            llm_manager=mgr,
            tools=[],
            system_prompt="You are a market agent.",
            history=[],
            user_message="price of reliance",
        )
    )
    assert result["answer"] == "**Reliance** trades at ₹2,500.\n\n- Sector: Energy"
    assert "[{" not in result["answer"] and "'type':" not in result["answer"]


def test_supervisor_classify_handles_list_content():
    from ai_copilot.agents import supervisor_agent

    mgr = manager_for(scripted(AIMessage(content=[{"type": "text", "text": "market"}])))
    route = asyncio.run(supervisor_agent.classify(mgr, "price of TCS"))
    assert route == "market"


# ── Supervisor routing ──────────────────────────────────────────────────────────
def test_supervisor_routes_each_intent():
    from ai_copilot.agents import supervisor_agent

    async def classify(word):
        return await supervisor_agent.classify(manager_for(scripted(AIMessage(content=word))), "any message")

    assert asyncio.run(classify("portfolio")) == "portfolio"
    assert asyncio.run(classify("market")) == "market"
    assert asyncio.run(classify("planning")) == "planning"
    assert asyncio.run(classify("education")) == "education"


def test_supervisor_heuristic_fallback_on_bad_llm_output():
    from ai_copilot.agents import supervisor_agent

    # Model returns junk -> falls back to keyword heuristic on the message text.
    mgr = manager_for(scripted(AIMessage(content="???")))
    route = asyncio.run(
        supervisor_agent.classify(mgr, "How much should I invest monthly for retirement?")
    )
    assert route == "planning"


# ── Full graph + tool execution ─────────────────────────────────────────────────
def test_portfolio_agent_executes_tool_end_to_end():
    from ai_copilot.graph.workflow import run_copilot

    db = FakeDB()
    db["portfolios"].docs.append(
        {"user_id": "u1", "holdings": [
            {"ticker": "RELIANCE", "quantity": 10, "avg_buy_price": 2000,
             "current_price": 2500, "sector": "Energy"}
        ]}
    )
    set_model_override(scripted(
        AIMessage(content="portfolio"),
        tool_call("get_user_holdings"),
        AIMessage(content="You hold RELIANCE (Energy). That's concentration risk to watch."),
    ))
    out = asyncio.run(run_copilot(message="analyze my portfolio", user_id="u1", session_id="s1", db=db))
    assert out["agent_used"] == "portfolio"
    assert "get_user_holdings" in out["tools_called"]
    assert "RELIANCE" in out["answer"]
    assert out["reasoning_summary"]
    assert len(out["suggestions"]) >= 1


def test_planning_agent_executes_calculator_tool():
    from ai_copilot.graph.workflow import run_copilot

    set_model_override(scripted(
        AIMessage(content="planning"),
        tool_call("sip_calculator", {"monthly_investment": 5000, "annual_return_pct": 12, "years": 15}),
        AIMessage(content="Here is a projection based on an assumed 12% return."),
    ))
    out = asyncio.run(run_copilot(message="I want to invest 5000 monthly", user_id="u1", session_id="s2", db=None))
    assert out["agent_used"] == "planning"
    assert "sip_calculator" in out["tools_called"]


def test_market_and_education_agents_route_and_answer():
    from ai_copilot.graph.workflow import run_copilot

    set_model_override(scripted(
        AIMessage(content="market"),
        AIMessage(content="Reliance is a diversified energy-to-telecom major."),
    ))
    out = asyncio.run(run_copilot(message="analyze Reliance", user_id="u1", session_id="s3", db=None))
    assert out["agent_used"] == "market"

    set_model_override(scripted(
        AIMessage(content="education"),
        AIMessage(content="The Sharpe ratio measures return per unit of risk."),
    ))
    out = asyncio.run(run_copilot(message="what is the sharpe ratio", user_id="u1", session_id="s4", db=None))
    assert out["agent_used"] == "education"
    assert "Sharpe" in out["answer"]


# ── Memory ───────────────────────────────────────────────────────────────────────
def test_memory_save_and_load_history():
    async def run():
        mm = MemoryManager(FakeDB())
        await mm.append_message("u1", "s1", "user", "hi")
        await mm.append_message("u1", "s1", "assistant", "hello", agent="education")
        history = await mm.load_history("s1")
        return history

    history = asyncio.run(run())
    assert [h["role"] for h in history] == ["user", "assistant"]
    assert history[1]["content"] == "hello"


def test_memory_profile_upsert_and_get():
    async def run():
        mm = MemoryManager(FakeDB())
        await mm.upsert_profile("u1", {"risk_appetite": "aggressive", "bogus": "x"})
        return await mm.get_profile("u1")

    profile = asyncio.run(run())
    assert profile["risk_appetite"] == "aggressive"
    assert "bogus" not in profile  # non-whitelisted field rejected


def test_memory_degrades_without_db():
    async def run():
        mm = MemoryManager(None)
        await mm.append_message("u1", "s1", "user", "hi")  # no-op, must not raise
        return await mm.load_history("s1"), await mm.get_profile("u1")

    history, profile = asyncio.run(run())
    assert history == [] and profile == {}


def test_heuristic_profile_learning_in_graph():
    from ai_copilot.graph.workflow import run_copilot

    db = FakeDB()
    set_model_override(scripted(
        AIMessage(content="education"),
        AIMessage(content="Aggressive investing means a higher equity allocation."),
    ))
    asyncio.run(run_copilot(
        message="I prefer aggressive investing", user_id="u9", session_id="s9", db=db,
    ))
    profile = asyncio.run(MemoryManager(db).get_profile("u9"))
    assert profile.get("risk_appetite") == "aggressive"


# ── Provider abstraction / fallback ──────────────────────────────────────────────
def test_llm_manager_override_wraps_raw_model():
    fake = scripted(AIMessage(content="x"))
    set_model_override(fake)
    mgr = get_llm_manager()
    assert mgr.provider_names == ["test-override"]

    msg, provider = asyncio.run(mgr.ainvoke([HumanMessage(content="hi")]))
    assert provider == "test-override"
    assert msg.content == "x"

    set_model_override(None)
    mgr2 = get_llm_manager()
    assert mgr2.provider_names == ["gemini", "groq"]


def test_provider_status_shape():
    status = provider_status()
    assert "priority" in status and status["priority"] == ["gemini", "groq"]
    assert "providers" in status and "gemini" in status["providers"] and "groq" in status["providers"]
    assert "configured" in status


# ── HTTP endpoints ───────────────────────────────────────────────────────────────
def _client_with_auth():
    from fastapi.testclient import TestClient
    import main
    from utils.auth import get_current_user

    main.app.dependency_overrides[get_current_user] = lambda: "u1"
    main.app.state.db = FakeDB()
    main.app.state.mongo_connected = True
    return TestClient(main.app), main.app


def test_chat_endpoint_full_flow():
    client, app = _client_with_auth()
    try:
        set_model_override(scripted(
            AIMessage(content="education"),
            AIMessage(content="Diversification spreads risk across assets."),
        ))
        r = client.post("/api/v2/copilot/chat", json={"message": "what is diversification"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["agent_used"] == "education"
        assert body["session_id"]
        assert "Diversification" in body["answer"]
    finally:
        app.dependency_overrides.clear()
        set_model_override(None)


def test_chat_endpoint_graceful_without_llm(monkeypatch):
    # Force the "no LLM configured" branch deterministically (a dev .env may have a
    # real key locally; CI has none — patching removes that dependency on the env).
    import api.copilot as copilot_mod

    monkeypatch.setattr(copilot_mod, "_llm_ready", lambda: False)
    client, app = _client_with_auth()
    try:
        set_model_override(None)
        r = client.post("/api/v2/copilot/chat", json={"message": "hi"})
        assert r.status_code == 200
        assert r.json()["agent_used"] == "none"
    finally:
        app.dependency_overrides.clear()


def test_copilot_health_endpoint_no_auth():
    from fastapi.testclient import TestClient
    import main

    r = TestClient(main.app).get("/api/v2/copilot/health")
    assert r.status_code == 200
    body = r.json()
    assert body["service"] == "finai-edge-copilot"
    assert body["graph_compiled"] is True
