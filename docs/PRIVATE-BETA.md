# Nivro — Private Beta Operations

Nivro runs as a **closed, invite-only beta**. There is no public sign-up:
`POST /api/auth/register` does not exist, and the FastAPI analytics API denies
every request by default.

> This document contains **no passwords**. Credentials are never stored in the
> repository, in `.env`, in logs, or here. They exist only as bcrypt hashes in
> the database, set interactively by an operator.

---

## Access model

| Role | Who | Access |
|---|---|---|
| `owner` | Project owners | Everything |
| `beta` | Invited testers | Everything |
| `demo` | **Publicly shared** credential (LinkedIn) | Read-only where practical; see limits below |

`isActive: false` revokes an account without deleting it. Both Express
(`middleware/authMiddleware.js`) and FastAPI (`utils/auth.py`) check it, so
clearing the flag invalidates any outstanding JWT within ~30 seconds rather than
waiting out its 30-day expiry.

### Demo account limits

The demo credential is published deliberately, so it is treated as untrusted:

- **Cannot trigger a full market scan** (`POST /api/v2/scanner/trigger-scan` → 403).
  A scan pins a CPU for 30–40 minutes; one visitor could otherwise stall the beta.
- **Cannot create, edit, delete or duplicate watchlists** (→ 403). Reads are allowed
  so visitors can explore the feature; several strangers share the one account and
  would otherwise overwrite each other.
- **Tightest Copilot budget** — 10 turns per 5 minutes, versus 40 for `beta` and
  80 for `owner`. Limits are per **user**, not per IP, because demo traffic arrives
  from many different addresses on a single account.

---

## Managing accounts

### The roster

`backend/scripts/seedUsers.js` holds the roster — email, username, role only, no
secrets. It is the single source of truth for who may sign in.

### Add or remove a tester

1. Edit `ROSTER` in `backend/scripts/seedUsers.js`.
2. Preview the change:

```bash
node backend/scripts/seedUsers.js --dry-run
```

3. Apply it:

```bash
node backend/scripts/seedUsers.js
```

The seeder is idempotent and safe to re-run. It will:

- **create** roster members that don't exist yet, with an unusable 48-byte random
  password (never printed — the account cannot be used until step 4)
- **update** `role` / `isActive` on members that already exist
- **never touch an existing password hash**, so an account whose password nobody
  remembers keeps working exactly as before
- **deactivate** anyone in the database but absent from the roster
- **delete** the throwaway addresses listed in `PURGE`

4. Give each new account a password:

```bash
node backend/scripts/setPassword.js someone@example.com
```

Prompts twice, hidden. Nothing reaches argv, an environment variable, shell
history, or the terminal — only the bcrypt hash is written.

### Recover an account

Same command. It does not need, and never reveals, the old password:

```bash
node backend/scripts/setPassword.js poorvanshnandwar145@gmail.com
```

### Revoke access immediately

Remove the address from `ROSTER` and re-run the seeder, or set the flag directly:

```bash
node -e "require('dotenv').config();const m=require('mongoose'),e=require('./backend/config/env'),U=require('./backend/models/User');(async()=>{await m.connect(e.mongoUri);await U.updateOne({email:'x@y.com'},{\$set:{isActive:false}});await m.disconnect()})()"
```

---

## API protection

`backend/fastapi_app/middleware/auth_guard.py` denies by default. Only these are
public:

- `/health`
- `/api/v2/status`
- `/api/v2/copilot/health`
- `/docs`, `/redoc`, `/openapi.json` — **development only**; unmounted otherwise

Everything else needs a valid Express-issued JWT belonging to an existing, active
account.

**Adding a new route requires no action** — it is protected automatically. That
is the point of the middleware: `test_no_new_route_is_public_by_default` walks the
live route table and fails if any GET route answers an anonymous caller, so a new
public hole cannot land silently.

### If a scanner page starts returning 401

The frontend attaches the JWT via an axios interceptor in
`frontend/src/services/screenerService.ts`. Any **new** call must go through
`scannerClient` (automatic) or attach `authHeader()` explicitly if it uses raw
`fetch`.

---

## OHLCV data source

Two backends, chosen explicitly by `ohlcv_backend` in `backend/fastapi_app/config.py`
(or the `OHLCV_BACKEND` environment variable). **There is no automatic failover
between them** — a scan must never leave you guessing which source produced it,
and a silently substituted stale CSV would look like a successful scan.

| | `csv` (local default) | `mongo` (deployment) |
|---|---|---|
| Source | `backend/data/Stock_Data.csv` | `ohlcv` collection, one doc per symbol |
| Reads | whole file into RAM | per symbol, 128-entry LRU + 50-wide read-ahead |
| RAM | ~235 MB | ~9 MB |
| Daily download writes | back to the CSV | Mongo only — **CSV untouched** |
| Mongo unreachable | works fully offline | fails loudly |

`backend/data/Stock_Data.csv` (196 MB) is gitignored and does not survive an
ephemeral filesystem, which is why deployment needs `mongo`. The file is never
written or deleted by the Mongo path, so it stays valid as an instant rollback.

### Migrating / re-verifying

```bash
cd backend/fastapi_app && python scripts/migrate_ohlcv_to_mongo.py
```

Streams the CSV in chunks (peak memory is one symbol), then verifies MongoDB
against the file with **exact** equality — OHLC are stored as float64, so the
round-trip is bit-for-bit lossless and anything less than an exact match is a
real defect. `--verify` checks without writing; `--resume` skips symbols already
stored.

Storage measured on Atlas M0 (512 MB free tier): 2,207 symbols / 2,256,535 bars
= **82 MB in use**, whole database **190 MB**, leaving ~322 MB. Growth is about
2,200 bars/day ≈ **35 MB/year**.

> **Why float64 and int64, not float32.** float32 would save 36 MB but quantises
> prices to ~7 significant digits, which was measured to shift LaunchPad's
> historical FVG win-rate by 1.1% and average loss by 4.8% on NATIONALUM — a
> threshold-crossing effect in the backtest, so upcasting on read does not fix
> it. Volume peaks at 1,807,991,128 across the full file: float32 would silently
> corrupt anything above 16.7M, and int32 leaves only 1.19x headroom.
> `tests/test_ohlcv_store.py` pins both choices.

### Rolling back

Set `ohlcv_backend` back to `csv`. Nothing else changes — the CSV is a frozen
snapshot covering 2021-07-11 → 2026-08-06. Note that in `mongo` mode nothing
writes to it, so it ages; re-run the migration in reverse (or a manual CSV-mode
download) if you want the fallback current.

---

## Before deploying anywhere public

- [ ] Set a strong `JWT_SECRET`. Express refuses to start in production without one;
      FastAPI does not — set it in both `.env` files.
- [ ] `NODE_ENV=production` and `ENVIRONMENT=production` so docs unmount and cookies
      become `secure` + `sameSite=strict`.
- [ ] Uvicorn currently binds `127.0.0.1`, so nothing is reachable off-machine today.
      Binding `0.0.0.0` is what makes the above real.
- [ ] Put TLS in front of both services — the JWT travels in a cookie and a header.
- [ ] Rotate the demo password whenever the LinkedIn post changes.
- [ ] Review `docs/COMPLIANCE-BLUEPRINT.md` **before** any public launch. It is
      parked, not cancelled.

---

## Tests

```bash
cd backend/fastapi_app && python -m pytest tests/ -q
```

`tests/test_auth_guard.py` covers the boundary: anonymous rejection on every
scanner, bad/expired/wrong-secret tokens, deleted and inactive accounts, CORS
preflight and CORS-on-rejection, demo restrictions, and per-user rate limits.
