# Nivro — Manual Testing Guide

For you to verify the backend cleanup done in this session (ruff lint pass, dead-code
removal) and to have a repeatable checklist for future changes. Everything here uses
your **real** seeded accounts — I don't have those credentials, so I tested with
throwaway synthetic accounts instead (created and deleted automatically). This guide
is what completes the loop with your own login.

Estimated time: 15–20 minutes for the full pass, 5 minutes for the quick pass.

---

## 0. Before you start

```bash
cd backend && npm install          # if you haven't already
cd fastapi_app && pip install -r requirements.txt
```

You'll need:
- MongoDB reachable (local or Atlas) — `backend/.env` and `backend/fastapi_app/.env`
  both point at it via `MONGODB_URI`.
- At least one seeded, password-set account (`backend/scripts/seedUsers.js` +
  `backend/scripts/setPassword.js` — see [`docs/PRIVATE-BETA.md`](PRIVATE-BETA.md) if
  you need a refresher).
- `backend/data/Stock_Data.csv` present, **or** `OHLCV_BACKEND=mongo` and the Mongo
  migration already run — otherwise scanner pages will come back empty (not broken,
  just no data to show).

---

## 1. Quick pass (5 min) — "did I break the build?"

Run these four commands. All four must be clean before you trust anything else.

```bash
cd backend/fastapi_app && python -m ruff check .
```
**Expect:** `All checks passed!`

```bash
cd backend/fastapi_app && python -m pytest tests/ -q
```
**Expect:** all dots, one `s` (skip), zero `F`/`E`. Bottom line should read
`185 passed, 1 skipped` (may be higher if you've added tests since).

```bash
cd backend && node --test
```
**Expect:** `# fail 0` at the bottom (10 tests currently).

```bash
cd frontend && npx tsc --noEmit
```
**Expect:** no output, exit code 0.

If any of these fail, stop here and fix that before moving to manual testing — no
point manually testing a build that doesn't pass its own automated gate.

---

## 2. Start everything

Two terminals (or `start-dev.bat` from the repo root, which does both):

```bash
# Terminal 1 — FastAPI (port 8000) — now serves auth too, see README §8.2
cd backend/fastapi_app && uvicorn main:app --reload --port 8000
```

```bash
# Terminal 2 — Frontend (port 9002)
cd frontend && npm run dev
```

The Express service (`backend/`) is no longer part of the dev workflow — auth,
which was its only job the frontend still used, was migrated into FastAPI. The
code is still in the repo for reference/rollback; you don't need to start it.

**Watch the FastAPI terminal's startup log.** You're looking for:
```
MongoDB:     ✓ connected
Indexes:     ✓ created/verified
Universe:    ✓ cache fresh          (or "✓ N symbols cached")
Scheduler:   ✓ pre-market check at 08:00 IST, daily scan at 15:45 IST
```

⚠️ **One pre-existing warning you'll likely see and can ignore for now:**
```
Indexes: ✗ Index build failed: ... E11000 duplicate key error ... smc_zones ...
```
This means the `smc_zones` collection already has duplicate `(symbol, zone_high,
zone_low)` rows from before the unique index existed, so the index never actually
gets created — the uniqueness rule is silently unenforced. It's non-fatal (app
starts fine) and it's **not something introduced by this session's changes** — I
found it during E2E testing and it predates the ruff/dead-code work. Worth fixing
eventually (dedupe the collection, then let the index build succeed) but it's a data
question, not a code question, so I flagged it rather than touching your live data.

---

## 3. Health checks (30 sec)

```bash
curl http://localhost:8000/health
curl http://localhost:8000/api/v2/status
```
Both should return `200` with `"status":"healthy"`. `/api/v2/status` also reports
`"mongodb":{"connected":true}` — if it says `false`, nothing past this point will work.

---

## 4. Auth boundary — anonymous requests must be refused

```bash
curl -i http://localhost:8000/api/scanner/launchpad
```
**Expect:** `401 Unauthorized`. Try a few more: `/api/scanner/alpha-zone`,
`/api/v2/watchlists`, `/api/scanner/ipo-vintage`. All should be `401` with no
authentication. If any of these return `200` to an anonymous request, that's a real
regression — stop and report it.

---

## 5. Browser walkthrough — log in with your real account

1. Open `http://localhost:9002` → **Sign in** with a real seeded account.
2. **Markets / Dashboard** — should load without a console error (F12 → Console tab,
   look for red text).
3. **Screener → LaunchPad** — should show cards (or an empty state if OHLCV hasn't
   been scanned yet, not an error).
4. **Screener → Alpha Zone**, **Technical**, **FVG**, **Volume**, **SMC**, **Momentum**,
   **IPO Vintage** — same check on each tab. IPO Vintage is the one that landed most
   recently in the scan pipeline; worth an extra look.
5. **Watchlists** — create one, add a stock to it (needs symbol + a price — the UI
   handles this; if you're hitting the API directly the required fields are
   `symbol`, `company_name`, `source_module`, `added_price`), then delete it. All
   three actions should complete without an error toast.
6. **Portfolio** — run an analysis on 2–3 tickers (e.g. RELIANCE, TCS, INFY). Should
   return risk metrics, not an error.
7. **AI Copilot** — send one message. Should get a real response (or a graceful
   "not configured" message if `GEMINI_API_KEY` isn't set locally — not a crash).
8. **Journal** — open it, confirm it loads (this page wasn't touched this session,
   included for completeness).
9. **Logout** — confirm you land back on the sign-in page and a subsequent
   `curl http://localhost:8000/api/scanner/launchpad` with no token is still `401`.

If you have a `demo`-role account, repeat step 5–6 with it and confirm:
- Triggering a scan is refused (403) — the demo role can't spend a 30-40 min scan.
- Creating/editing a watchlist is refused (403); reading one still works.

---

## 6. What I already verified for you (so you don't have to repeat it)

Using a throwaway synthetic account (created and deleted automatically, credentials
never touched anything of yours), I ran a 32-point live check against both servers
covering: health endpoints, the anonymous-401 boundary on 9 protected routes, the
full login → `/me` → `/token` flow, all 7 scanner reads while authenticated, SMC,
scan-status, watchlist create/list/add-stock/delete, portfolio analyze, IPO Vintage
listings, and Copilot health. **32/32 passed** after I fixed one test-script mistake
of mine (a watchlist "add stock" call missing required fields — the API's `422`
rejection was *correct behavior*, not a bug).

I also confirmed, before and after deleting the dead code:
- The app still imports and boots (`import main` succeeds).
- The full pytest suite is unchanged: **185 passed, 1 skipped**, both times.
- Every `.py` file in the tree still parses (no syntax errors introduced).

**Auth migration (Express → FastAPI, see README §8.2).** I ran a 16-point live check
of the new `api/auth.py` directly against the running FastAPI service with Express
**not started**: wrong password (401), correct login (200, correct cookie
attributes), the JWT payload shape and 30-day expiry, `/me` via both cookie and
Bearer token, the `/token` bridge, an anonymous 401, a username update, a
downstream FastAPI-protected scanner read using the self-issued token, logout
clearing the cookie correctly, a deactivated account rejected at login, and the
6th rapid failed attempt hitting `429`. **16/16 passed.** I then repeated login →
dashboard → an authenticated scanner page → logout through the actual browser UI,
also with Express off — same result. 10 new offline pytest tests
(`tests/test_auth_login.py`) cover the same login-endpoint behavior in CI.

---

## 7. If something's broken

| Symptom | Likely cause | Where to look |
|---|---|---|
| Every API call is `401` even when logged in | `JWT_SECRET` unset or changed in `backend/.env` (FastAPI reads it from there) | `backend/.env` — FastAPI now both signs and verifies with this one value |
| Login returns `429` immediately | The in-memory login rate limiter (5 failed attempts/15min per IP) is still cooling down from earlier failed attempts against the same FastAPI process | Restart FastAPI (dev-only fix; the bucket is per-process and clears on restart), or just wait |
| Scanner pages are empty, not erroring | No OHLCV data yet | Check `OHLCV_BACKEND` and whether `Stock_Data.csv` exists / migration has run |
| `db: disconnected` on `/health` | Mongo unreachable | Check `MONGODB_URI`, and that Atlas network access (if used) allows your IP |
| Browser shows a CORS error | `FRONTEND_URL` not set / wrong port | Both `backend/.env` and `backend/fastapi_app/.env` need `FRONTEND_URL=http://localhost:9002` |
| `ruff check .` reports new errors | You added code that trips a rule not in `ruff.toml`'s ignore list | Read the rule's message — most are real; if you believe it's a false positive matching the `BLE001`/`DTZ00x` pattern already documented, extend `ruff.toml` with the same reasoning style, don't just silence it |

---

## 8. Rollback, if needed

Everything from this session is uncommitted working-tree changes (nothing was
force-pushed or committed for you). If you want to discard the ruff/dead-code pass
entirely:

```bash
git status                 # see everything that's changed
git diff -- backend/fastapi_app   # review before discarding anything
```

The dead-code deletions were: `backend/fastapi_app/jobs/scanner_cron.py`, the whole
top-level `backend/fastapi_app/indicators/` directory, `scanners/technical.py`,
`scanners/watchlists.py`, `models/smc.py`. All confirmed to have zero live importers
before deletion — restoring them (`git checkout -- <path>`) is safe if you want them
back for any reason, but nothing else in the app depends on them.

**If you want to discard the auth migration** (README §8.2) and go back to
Express handling login: revert `backend/fastapi_app/api/auth.py` (new file),
the `PUBLIC_PATHS` addition in `middleware/auth_guard.py`, the router wiring in
`main.py`, `tests/test_auth_login.py` (new file), and `frontend/.env`'s
`NEXT_PUBLIC_API_URL` back to `http://localhost:8080` — then start Express
again (`cd backend && npm run dev`). Nothing about this migration is
destructive: Express's code was never touched, only stopped.
