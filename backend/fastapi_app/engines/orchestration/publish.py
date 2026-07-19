"""
Atomic cache publication for the Scan Coordinator.

Every pipeline output (indicator_cache, screener_cache, fvg_cache, ..., launchpad_cache,
alpha_zone_cache) follows the same two-step "blue-green" pattern:

    1. write_staged()   — bulk-write the freshly computed docs into `{name}_staging`,
                           replacing any leftover staging docs from a prior failed run.
    2. publish_staged()  — MongoDB `renameCollection` swaps `{name}_staging` into `{name}`
                           in one metadata-only operation. Readers of `{name}` never see
                           zero documents or a partially-inserted set: they see the OLD
                           collection right up until the rename lands, then the FULL new
                           one — there is no in-between state visible to a query.

This replaces the previous `delete_many({}) + insert_many(docs)` pattern (two separate
operations with a real gap between them) used by `engines/strategies/runner.py` and
`schedulers/daily_refresh.py::_bulk_write_results`.
"""

from __future__ import annotations

import logging

log = logging.getLogger("finai_edge.orchestration.publish")

STAGING_SUFFIX = "_staging"

# Every pipeline output collection this coordinator publishes atomically.
PIPELINE_COLLECTIONS = (
    "indicator_cache",
    "screener_cache",
    "fvg_cache",
    "fvg_scan_results",
    "volume_surge_cache",
    "momentum_cache",
    "smc_scanner_results",
    "smc_zones",
    "launchpad_cache",
    "alpha_zone_cache",
)


def staging_name(name: str) -> str:
    return f"{name}{STAGING_SUFFIX}"


async def write_staged(db, name: str, docs: list[dict]) -> int:
    """Replace the staging collection for `name` with `docs`. Not atomic with
    respect to concurrent readers — that's fine, nothing reads `{name}_staging`
    directly; only `publish_staged()` ever touches it besides this call."""
    staging = db.get_collection(staging_name(name))
    await staging.delete_many({})
    if docs:
        await staging.insert_many(docs)
    log.info(f"[publish] staged {len(docs)} docs -> {staging_name(name)}")
    return len(docs)


async def publish_staged(db, name: str) -> None:
    """Atomically swap `{name}_staging` into `{name}` via renameCollection. A
    single metadata operation — no window where `name` is empty or partial. If
    the staging collection was never written this scan (e.g. a stage produced
    zero results), `{name}_staging` may not exist; in that case we still want
    `name` to end up empty (a real zero-result outcome), so we create an empty
    staging collection first rather than skipping the publish."""
    staging = db.get_collection(staging_name(name))
    if await staging.count_documents({}) == 0 and staging_name(name) not in await db.list_collection_names():
        await staging.insert_one({"__empty__": True})
        await staging.delete_one({"__empty__": True})
    await staging.rename(name, dropTarget=True)
    log.info(f"[publish] published {staging_name(name)} -> {name}")


async def publish_all(db, names: list[str]) -> None:
    """Publish every named collection in sequence. Each individual rename is
    atomic; the set as a whole is not a single transaction (MongoDB has no
    cross-collection atomic rename), so a crash between two renames could
    leave some collections published and others not — acceptable here since
    each collection independently goes from "old, consistent" to "new,
    consistent" and is never visible as empty/partial either way."""
    for name in names:
        await publish_staged(db, name)
