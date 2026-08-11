"""
One-off: verify the LaunchPad pipeline and regenerate launchpad_cache with the
NEW strategy, then diff old vs new. Read-only except for the intentional
delete+rebuild of launchpad_cache (which run_launchpad_from_cache already does).
"""

import asyncio
import os
import sys

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)  # fastapi_app on path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()
uri = os.getenv("MONGODB_URI") or "mongodb://localhost:27017/finai_edge"


async def snapshot(col):
    docs = await col.find({}, {"_id": 0}).to_list(length=5000)
    return {d["symbol"]: d for d in docs if d.get("symbol")}


async def run():
    client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=8000)
    db = client.get_database("finai_edge")
    print(
        f"Mongo host: {client.address if hasattr(client, 'address') else uri.split('@')[-1][:40]}"
    )
    print("Database  : finai_edge\n")

    col = db.get_collection("launchpad_cache")

    # ── OLD snapshot ────────────────────────────────────────────────
    old = await snapshot(col)
    print(f"OLD launchpad_cache count: {len(old)}")
    if old:
        s = next(iter(old.values()))
        print("  Sample OLD doc keys:", sorted(s.keys()))
        print("  Has 'rsi_14' field (old strategy marker):", "rsi_14" in s)
        setups = {}
        for d in old.values():
            setups[d.get("setup")] = setups.get(d.get("setup"), 0) + 1
        print("  OLD 'setup' distribution:", setups)
        # any sub-100 prices? (old strategy allowed them)
        sub100 = [k for k, d in old.items() if (d.get("cmp") or 0) < 100]
        print(f"  OLD docs with CMP < 100: {len(sub100)}")
        # any RSI in confidence breakdown?
        print(
            "  OLD breakdown keys:",
            sorted((s.get("confidence_breakdown") or {}).keys()),
        )
    print()

    # ── REBUILD with NEW direct-OHLCV scan ──────────────────────────
    import time

    from engines.strategies.runner import run_launchpad_scan

    t0 = time.time()
    n = await run_launchpad_scan(db)  # scans OHLCV directly; delete+insert internally
    dt = time.time() - t0
    print(f"Rebuild complete -> {n} matches inserted  ({dt:.1f}s full-universe scan)\n")

    # ── NEW snapshot ────────────────────────────────────────────────
    new = await snapshot(col)
    print(f"NEW launchpad_cache count: {len(new)}")
    if new:
        s = next(iter(new.values()))
        print("  Has 'rsi_14' field (should be False now):", "rsi_14" in s)
        setups = {}
        for d in new.values():
            setups[d.get("setup")] = setups.get(d.get("setup"), 0) + 1
        print("  NEW 'setup' distribution:", setups)
        sub100 = [k for k, d in new.items() if (d.get("cmp") or 0) < 100]
        print(f"  NEW docs with CMP < 100 (should be 0): {len(sub100)}")
        print(
            "  NEW breakdown keys (should have no 'rsi'):",
            sorted((s.get("confidence_breakdown") or {}).keys()),
        )
    print()

    # ── DIFF ────────────────────────────────────────────────────────
    old_syms, new_syms = set(old), set(new)
    added = sorted(new_syms - old_syms)
    removed = sorted(old_syms - new_syms)
    common = old_syms & new_syms

    print("=" * 64)
    print(f"OLD candidates: {len(old)}   →   NEW candidates: {len(new)}")
    print("=" * 64)

    print(f"\nADDED ({len(added)}):")
    for sym in added[:60]:
        d = new[sym]
        print(
            f"  + {sym:14} cmp={d.get('cmp'):>8}  conf={d.get('confidence'):>5}  setup={d.get('setup')}"
        )
    if len(added) > 60:
        print(f"  … +{len(added) - 60} more")

    print(f"\nREMOVED ({len(removed)}):")
    for sym in removed[:60]:
        d = old[sym]
        reason = "CMP<100" if (d.get("cmp") or 0) < 100 else "no-longer-qualifies"
        print(
            f"  - {sym:14} cmp={d.get('cmp'):>8}  oldconf={d.get('confidence'):>5}  [{reason}]"
        )
    if len(removed) > 60:
        print(f"  … -{len(removed) - 60} more")

    changed = []
    for sym in common:
        oc = old[sym].get("confidence")
        nc = new[sym].get("confidence")
        if oc != nc:
            changed.append((sym, oc, nc, round((nc or 0) - (oc or 0), 1)))
    changed.sort(key=lambda x: abs(x[3]), reverse=True)
    print(f"\nCONFIDENCE CHANGED ({len(changed)} of {len(common)} retained):")
    for sym, oc, nc, delta in changed[:60]:
        print(f"  ~ {sym:14} {oc:>5} → {nc:>5}  (Δ {delta:+})")
    if len(changed) > 60:
        print(f"  … {len(changed) - 60} more")

    unchanged = len(common) - len(changed)
    print(f"\nRetained & unchanged confidence: {unchanged}")

    client.close()


asyncio.run(run())
