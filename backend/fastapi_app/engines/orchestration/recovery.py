"""
Startup reconciliation — closes the exact "impossible state" bug: a process
dies mid-scan (crash, forced kill, deploy restart) with no chance to run its
own cleanup code. `scan_meta.overall_status` is left durably `RUNNING` in
MongoDB forever, while the in-memory `_ACTIVE_SCANS` registry that would show
it as active dies with the process — so a fresh process boots with an empty
registry (correctly: nothing IS running) while Mongo insists otherwise.

`reconcile_orphaned_scans()` runs once, on every startup, before the app
serves any traffic: if the persisted doc says RUNNING, nothing can possibly be
running yet (this process just started — its own registry is necessarily
empty), so any such doc is provably orphaned and is marked FAILED.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

log = logging.getLogger("finai_edge.orchestration.recovery")


async def reconcile_orphaned_scans(db) -> bool:
    """Returns True if an orphaned RUNNING scan was found and healed."""
    if db is None:
        return False

    meta_col = db.get_collection("scan_meta")
    doc = await meta_col.find_one({"_id": "daily_scan"})
    if not doc:
        return False

    status = doc.get("overall_status") or doc.get("status")
    if status != "RUNNING":
        return False

    scan_id = doc.get("scan_id", "unknown")
    log.warning(
        f"[recovery] Found orphaned scan on startup: scan_id={scan_id} — "
        f"a previous process left scan_meta.overall_status=RUNNING with no "
        f"chance to complete it. Marking FAILED."
    )
    await meta_col.update_one(
        {"_id": "daily_scan"},
        {"$set": {
            "overall_status": "FAILED",
            "status": "FAILED",  # legacy field kept in sync for any old reader
            "error": "orphaned by process restart",
            "completed_at": datetime.now(timezone.utc),
            "last_ran": datetime.now(timezone.utc),
        }},
    )
    return True
