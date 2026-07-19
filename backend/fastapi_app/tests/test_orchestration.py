"""
Scan Coordinator tests — pure logic, no real MongoDB / no network.

Covers the stage-document model, the atomic staging+rename publish helpers,
and startup crash-recovery reconciliation. Uses small hand-rolled fake Mongo
collection/db objects that implement only the subset of the motor async API
these modules actually call (find_one, update_one, replace_one,
count_documents, delete_many, insert_many, rename, list_collection_names) —
no new test dependency, consistent with test_engines.py's zero-Mongo style.
Async calls are wrapped with asyncio.run(), matching this suite's existing
convention in test_copilot.py / test_llm_manager.py.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from engines.orchestration.coordinator import _new_scan_doc, _new_stage, _StageWriter, STAGE_KEYS
from engines.orchestration.publish import write_staged, publish_staged, publish_all, staging_name
from engines.orchestration.recovery import reconcile_orphaned_scans


# ── Fake Mongo primitives ────────────────────────────────────────────────────

class FakeCollection:
    def __init__(self, name: str, store: dict):
        self.name = name
        self.store = store  # shared dict: collection_name -> list[dict]
        self.calls: list[tuple] = []
        self.store.setdefault(name, [])

    async def count_documents(self, query: dict) -> int:
        return len(self.store.get(self.name, []))

    async def delete_many(self, query: dict) -> None:
        self.calls.append(("delete_many", query))
        self.store[self.name] = []

    async def insert_many(self, docs: list[dict]) -> None:
        self.calls.append(("insert_many", len(docs)))
        self.store[self.name].extend(docs)

    async def insert_one(self, doc: dict) -> None:
        self.store[self.name].append(doc)

    async def delete_one(self, query: dict) -> None:
        self.store[self.name] = [d for d in self.store[self.name] if not all(d.get(k) == v for k, v in query.items())]

    async def rename(self, new_name: str, dropTarget: bool = False) -> None:
        self.calls.append(("rename", new_name, dropTarget))
        docs = self.store.pop(self.name, [])
        self.store[new_name] = docs

    # scan_meta-style single-document helpers
    async def find_one(self, query: dict):
        docs = self.store.get(self.name, [])
        return docs[0] if docs else None

    async def update_one(self, query: dict, update: dict, upsert: bool = False) -> None:
        self.calls.append(("update_one", update))
        docs = self.store.setdefault(self.name, [])
        if not docs:
            if upsert:
                docs.append({"_id": query.get("_id")})
            else:
                return
        doc = docs[0]
        _apply_set(doc, update.get("$set", {}))

    async def replace_one(self, query: dict, doc: dict, upsert: bool = False) -> None:
        self.calls.append(("replace_one", doc))
        self.store[self.name] = [dict(doc)]


def _apply_set(doc: dict, flat_set: dict) -> None:
    """Apply a MongoDB-style {"a.b.c": v} $set onto a nested dict in place."""
    for dotted_key, value in flat_set.items():
        parts = dotted_key.split(".")
        cursor = doc
        for p in parts[:-1]:
            cursor = cursor.setdefault(p, {})
        cursor[parts[-1]] = value


class FakeDB:
    def __init__(self):
        self.store: dict = {}

    def get_collection(self, name: str) -> FakeCollection:
        return FakeCollection(name, self.store)

    async def list_collection_names(self):
        return list(self.store.keys())


# ── Stage document model ─────────────────────────────────────────────────────

def test_new_stage_starts_pending_with_zeroed_counters():
    s = _new_stage()
    assert s["status"] == "PENDING"
    assert s["processed"] == 0 and s["total"] == 0
    assert s["failed_symbols"] == []
    assert s["started_at"] is None and s["completed_at"] is None


def test_new_scan_doc_has_all_five_stages_and_no_leftover_fields():
    doc = _new_scan_doc("SCAN-TEST-1", "manual", datetime.now(timezone.utc))
    assert doc["scan_id"] == "SCAN-TEST-1"
    assert doc["overall_status"] == "RUNNING"
    assert set(doc["stages"].keys()) == set(STAGE_KEYS)
    # No stray flat fields like the old symbols_processed/total_symbols living
    # at the top level of a freshly-created doc — this is what prevents a new
    # scan from ever displaying a previous run's leftover progress numbers.
    assert "symbols_processed" not in doc
    assert "total_symbols" not in doc


def test_stage_writer_start_progress_finish_transitions():
    async def run():
        db = FakeDB()
        meta_col = db.get_collection("scan_meta")
        await meta_col.replace_one({"_id": "daily_scan"}, _new_scan_doc("S1", "manual", datetime.now(timezone.utc)))
        sw = _StageWriter(meta_col, {}, "S1")

        await sw.start("download", total=100)
        doc = await meta_col.find_one({})
        assert doc["stages"]["download"]["status"] == "RUNNING"
        assert doc["stages"]["download"]["total"] == 100

        await sw.progress("download", 50, errors=1)
        doc = await meta_col.find_one({})
        assert doc["stages"]["download"]["processed"] == 50
        assert doc["stages"]["download"]["errors"] == 1

        await sw.finish("download", 100, 100, 1, ["BADSTOCK"], datetime.now(timezone.utc))
        doc = await meta_col.find_one({})
        assert doc["stages"]["download"]["status"] == "COMPLETED"
        assert doc["stages"]["download"]["failed_symbols"] == ["BADSTOCK"]
        assert doc["stages"]["download"]["duration_s"] is not None

    asyncio.run(run())


# ── Atomic publish (staging + rename) ────────────────────────────────────────

def test_write_staged_writes_into_staging_not_live():
    async def run():
        db = FakeDB()
        n = await write_staged(db, "launchpad_cache", [{"symbol": "TCS"}, {"symbol": "INFY"}])
        assert n == 2
        assert db.store.get("launchpad_cache", []) == []  # live untouched
        assert len(db.store.get(staging_name("launchpad_cache"))) == 2

    asyncio.run(run())


def test_publish_staged_renames_staging_into_live():
    async def run():
        db = FakeDB()
        await write_staged(db, "launchpad_cache", [{"symbol": "TCS"}])
        # Simulate stale old live data still present pre-publish.
        db.store["launchpad_cache"] = [{"symbol": "OLD"}]

        await publish_staged(db, "launchpad_cache")

        assert [d["symbol"] for d in db.store["launchpad_cache"]] == ["TCS"]
        assert staging_name("launchpad_cache") not in db.store or db.store[staging_name("launchpad_cache")] == []

    asyncio.run(run())


def test_publish_staged_with_zero_results_still_empties_live():
    """A stage that legitimately finds zero matches must still publish an
    empty result — not silently leave the previous scan's stale docs live."""
    async def run():
        db = FakeDB()
        db.store["launchpad_cache"] = [{"symbol": "OLD"}]
        await write_staged(db, "launchpad_cache", [])

        await publish_staged(db, "launchpad_cache")

        assert db.store["launchpad_cache"] == []

    asyncio.run(run())


def test_publish_all_publishes_every_named_collection():
    async def run():
        db = FakeDB()
        names = ["launchpad_cache", "alpha_zone_cache"]
        for n in names:
            await write_staged(db, n, [{"symbol": "X"}])
        await publish_all(db, names)
        for n in names:
            assert len(db.store[n]) == 1

    asyncio.run(run())


# ── Startup crash-recovery reconciliation ───────────────────────────────────

def test_reconcile_heals_orphaned_running_scan():
    async def run():
        db = FakeDB()
        db.store["scan_meta"] = [{"_id": "daily_scan", "scan_id": "SCAN-DEAD-1", "overall_status": "RUNNING"}]

        healed = await reconcile_orphaned_scans(db)

        assert healed is True
        doc = db.store["scan_meta"][0]
        assert doc["overall_status"] == "FAILED"
        assert doc["status"] == "FAILED"
        assert "orphaned" in doc["error"]

    asyncio.run(run())


def test_reconcile_is_noop_when_not_running():
    async def run():
        db = FakeDB()
        db.store["scan_meta"] = [{"_id": "daily_scan", "overall_status": "COMPLETED"}]
        healed = await reconcile_orphaned_scans(db)
        assert healed is False
        assert db.store["scan_meta"][0]["overall_status"] == "COMPLETED"

    asyncio.run(run())


def test_reconcile_is_noop_when_no_doc_exists():
    async def run():
        db = FakeDB()
        healed = await reconcile_orphaned_scans(db)
        assert healed is False

    asyncio.run(run())


def test_reconcile_is_noop_when_db_is_none():
    healed = asyncio.run(reconcile_orphaned_scans(None))
    assert healed is False
