# FinAI Edge

**AI-Powered Financial Intelligence Platform**

A full-stack investment analytics platform for Indian equity markets — portfolio analysis, technical/smart-money screeners, watchlists, a trading journal, and an AI copilot — built across three coordinated services with a JWT trust boundary between them.

---

## 1. Overview

FinAI Edge helps retail investors and active traders analyze portfolios, screen the market, and journal trades, with AI-assisted insights layered on top of quantitative analytics.

- **Portfolio analytics** — holdings P&L, sector exposure, risk metrics (Sharpe, Sortino, VaR, drawdown), health scoring, and rebalance suggestions computed with Modern Portfolio Theory.
- **Market screeners** — Technical, Smart Money Concepts, Volume Surge, Fair Value Gap/LaunchPad, IPO Vintage, and the proprietary Alpha Zone, over the full ~2,200-symbol NSE universe, computed by a staged scan pipeline and refreshed on a daily schedule. See [§3](#3-the-screener-pipeline--deep-dive) for the architecture.
- **AI copilot & journal coaching** — a Gemini-backed chat assistant and a trading-journal analyzer that summarizes patterns in a user's trade history.
- **Watchlists** — per-user, persisted, with performance tracking against a benchmark.

This is a personal/portfolio engineering project, not a live trading or brokerage system. Bulk historical OHLCV for the scanner pipeline comes from Upstox's public historical API; live quotes use Groww/Finnhub/yfinance — there is no order execution or custody of funds.

> **Access model — closed private beta.** There is no public sign-up: `POST /api/auth/register` does not exist, accounts are seeded by an operator, and the FastAPI analytics API denies every request by default. Roles are `owner` / `beta` / `demo`, where the publicly shared demo credential is treated as untrusted (no market scans, read-only watchlists, tightest Copilot budget). Operational detail: [`docs/PRIVATE-BETA.md`](docs/PRIVATE-BETA.md).

---

## 2. Architecture

Three independently deployable services, each with a distinct responsibility:

```
                    ┌─────────────────────────┐
                    │   Next.js Frontend       │
                    │   (React 18, App Router) │
                    └────────────┬─────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 │                                │
                 ▼                                ▼
   ┌───────────────────────────┐     ┌───────────────────────────┐
   │   Express (Node)          │     │   FastAPI (Python)         │
   │   Auth · JWT · Sessions   │     │   Portfolio · Screeners    │
   │   MongoDB (Mongoose)      │     │   AI · Watchlists           │
   │                            │     │   MongoDB (Motor)           │
   └────────────┬───────────────┘     └────────────┬───────────────┘
                │                                    │
                └───────────────┬────────────────────┘
                                 ▼
                        MongoDB Atlas (shared)
```

### JWT trust boundary

Only Express issues tokens. FastAPI never signs a token — it **verifies** the one Express created, using the same shared secret:

1. On login, Express signs a JWT (`{ id: userId }`, HS256) and sets it as an HTTP-only cookie.
2. Because Express, FastAPI, and the frontend are deployed as separate origins in production, that cookie is not automatically visible to FastAPI. The frontend fetches the token once via an authenticated `GET /api/auth/token` on Express and attaches it as `Authorization: Bearer <token>` on calls to FastAPI.
3. FastAPI verifies the token against the shared `JWT_SECRET` with `PyJWT`, then confirms the account **still exists and is active** in Mongo (cached ~30s) before the request reaches a handler — so deactivating a user invalidates outstanding tokens promptly rather than leaving them valid for the rest of their 30-day life.
4. Every user-owned endpoint (saved portfolios, watchlists — create, read, update, delete) is scoped to that verified id, closing an IDOR class of bug where one user could read or modify another user's data.

Because production genuinely spans two registrable domains (Vercel ↔ Render), that cookie is issued `SameSite=None; Secure` — `Strict` would stop the browser sending it on step 2, which silently breaks every downstream FastAPI call, not just login. Local development stays on `SameSite=Lax` over plain HTTP. Both paths are covered by `backend/utils/generateToken.js`, whose options object logout reuses so the clearing cookie can't drift out of sync.

**Deny by default.** `backend/fastapi_app/middleware/auth_guard.py` rejects anything not explicitly listed as public (`/health`, `/api/v2/status`, `/api/v2/copilot/health`, plus the docs in development). A newly added route is therefore protected automatically, and a test walks the live route table to fail the build if any GET route ever answers an anonymous caller.

Express and FastAPI never share code or a process — the only thing they share is the secret used to sign/verify.

---

## 3. The Screener Pipeline — Deep Dive

This is the most architecturally interesting part of the system, so it gets its own section. Five scanners (Technical, Smart Money Concepts, Volume Surge, Fair Value Gap, and two proprietary strategies — LaunchPad and Alpha Zone) run over the full NSE equity universe (~2,150 symbols) and are queried by the frontend as pre-computed, cached reads — nobody waits on a live computation.

### 3.1 Data ingestion — Upstox-only, with a provider-fallback pattern for the one series that needs it

`services/ohlc_downloader.py` incrementally syncs daily OHLCV from Upstox. Where that data then *lives* is a deployment choice — see [§3.1.1](#311-ohlcv-storage--two-backends-one-switch).

- **Source of truth: Upstox's public V3 historical-candle API.** It's unauthenticated and returns 5 years of daily history in a *single* call per symbol — no pagination/chunking loop needed, unlike the chunked-fetch pattern a rate-limited provider would require.
- **No per-symbol fallback for equities.** An earlier version of this pipeline chained Upstox → Groww → yfinance per symbol; Groww was removed entirely after its candle data was found to be inaccurate for this use case, so equities now have exactly one source.
- **The one exception is the `^NSEI` benchmark index**, which keeps a yfinance fallback behind the Upstox index key — a deliberate "infrastructure series must never be empty" decision, since every strategy's regime detection reads off it.
- **Timezone discipline is a first-class concern, not an afterthought.** Every provider path funnels through `_to_naive_datetime()`, which strips tz-awareness *without* a UTC conversion — a naive `utc=True` coercion would silently roll an IST midnight timestamp back to the previous calendar day. This exists because of a real incident: a tz-aware/tz-naive column mix during a merge used to raise a pandas exception that the orchestrator caught and swallowed, silently re-running every subsequent scan against a multi-day-old snapshot with identical results. The fix closes that failure mode at the type level rather than patching the one call site that triggered it.
- Every incoming row still passes through `validate_and_clean_data()` — future dates, non-positive OHLC, and negative volume are rejected before they ever reach the cache.

### 3.1.1 OHLCV storage — two backends, one switch

`ohlcv_backend` (env: `OHLCV_BACKEND`) selects where the ~2.26M daily bars live. Switching is configuration only — no code change, no file move.

| | `csv` — local default | `mongo` — deployment |
|---|---|---|
| Source | `backend/data/Stock_Data.csv` | `ohlcv` collection, one document per symbol |
| Read pattern | whole file parsed into a `{symbol: DataFrame}` dict | per symbol, 128-entry LRU + 50-wide read-ahead |
| Resident memory | ~235 MB | ~9 MB |
| Daily download writes | back to the CSV | Mongo only — the CSV is never written |
| Mongo unreachable | works fully offline | fails loudly |

The CSV is 196 MB and gitignored, so it does not exist on an ephemeral filesystem — hence `mongo` in production. It remains on disk locally as a frozen rollback snapshot.

**Why one document per symbol, with columnar binary blobs.** A row per bar would be 2.26M documents; BSON *arrays* would pay a string key (`"0"`, `"1"`, …) for every element. Binary blobs pay neither — measured at 44 B/bar, essentially the raw numpy size. Every consumer reads one symbol at a time, so the access pattern matches exactly, and `load_stock_dataframe(symbol)` keeps its signature — all ~15 call sites are untouched by the switch.

**Dtypes are load-bearing, not incidental.** OHLC are stored `float64` rather than `float32`. float32 would save 36 MB but quantises prices to ~7 significant digits, which measurably shifted LaunchPad's historical FVG win-rate by 1.1% and average loss by 4.8% on one symbol — a threshold-crossing effect inside the backtest, so it does *not* go away by upcasting on read. float64 makes the round-trip bit-for-bit lossless. Volume is `int64`: the full-file maximum is 1,807,991,128, where float32 would silently corrupt anything above 16.7M and int32 leaves only 1.19× headroom. `tests/test_ohlcv_store.py` pins both.

Migration and verification (`scripts/migrate_ohlcv_to_mongo.py`) streams the CSV in chunks — peak memory is one symbol — then compares MongoDB against the file with **exact** equality rather than a tolerance, because a lossless round-trip means anything less is a real defect. Measured on the Atlas free tier: 2,207 symbols / 2,256,535 bars, ~82 MB in use of 512 MB, growing ~35 MB/year. Daily rewrites were verified not to accumulate — WiredTiger reuses freed blocks.

### 3.2 The Scan Coordinator — a staged pipeline with atomic, all-or-nothing publish

`engines/orchestration/coordinator.py::run_full_scan` is the single orchestrator for "Run Full Scan," structured as an explicit state machine:

```
Download → Indicators → Technical → LaunchPad → Alpha Zone → IPO Vintage → Publish → Completed
```

Three design decisions here are worth calling out because they solve real distributed-systems problems, not just "make it work":

- **Indicators are computed exactly once per symbol and shared.** Before this refactor, the Technical scanner and each of LaunchPad/Alpha Zone independently recomputed EMA/RSI/MACD/ATR for every symbol — 3x redundant work. Now `IndicatorEngine.compute()` runs once per symbol in a dedicated stage, the results are kept in memory (`indicator_map: Dict[str, IndicatorSet]`) for every later stage in the *same run* to consume directly, and are also persisted to a cache for other endpoints.
- **Blue-green publish, not delete-then-insert.** Every stage writes its output into a `{collection}_staging` twin (`write_staged()`), and *nothing* is exposed until every stage in the pipeline has succeeded — at which point `publish_all()` atomically `renameCollection`s each staging collection into place. This closes a specific class of bug: the previous pattern (`delete_many({}) + insert_many(docs)`) has a real time window where a concurrent reader sees zero rows. Because a Mongo rename is a metadata-only operation, readers always see either the complete old dataset or the complete new one — never an empty or half-written collection, even mid-scan.
- **Scan state can't leak between runs.** `scan_meta` is written as a full document *replacement* at the start of every scan, never an incremental `$set` onto whatever a previous run left behind. This closes a bug where a killed process could leave a stale `symbols_processed`/`total_symbols` pair frozen under a `RUNNING` status forever, making the UI believe a scan was permanently stuck.

The coordinator is triggered three ways: an **APScheduler** cron job at 09:00 IST daily (`schedulers/daily_refresh.py`), a manual `POST /api/v2/scanner/trigger-scan`, or an automatic staleness check on process startup. Progress is polled by the frontend via `GET /api/v2/scanner/scan-status`, which reports per-stage status/processed/total so a "Run Full Scan" button can show real progress instead of a spinner.

### 3.3 Strategy engines — a shared contract, proprietary logic per strategy

`engines/strategies/base.py` defines the contract every scanner implements:

- `SymbolContext` — one symbol's DataFrame + precomputed `IndicatorSet` + market regime, built once and passed to every strategy (no strategy touches raw price data directly).
- `TradePlan.from_support()` — entry/stop/target are *derived*, not hardcoded ratios: the stop is placed `ATR`-buffered below a real support level (e.g. an FVG floor), and if that produces an implausibly tight risk, the stop widens to a sane ATR-based distance instead of emitting a broken 1:50 risk:reward.
- `StrategyResult.confidence_breakdown` — every confidence score ships with its component sub-scores, so the frontend can render a "why this setup" panel instead of an opaque number.

**LaunchPad** (`engines/strategies/launchpad.py`) — momentum-swing continuation, 5-7 day hold. Detects a bullish Fair Value Gap (a 3-candle imbalance where `C1.High < C3.Low`) sitting near 200-EMA support, and now also runs `fvg_backtest()` (`engines/patterns/fvg.py`) — a walk-forward backtest over the symbol's *own* price history that answers "how often has a bullish FVG actually worked on this stock?" For every historical qualifying gap with a full forward window (never the live, still-open setup — that would be look-ahead bias), it simulates the same entry/stop/target rule the live signal uses and classifies win/loss, surfacing `fvg_win_rate` / `fvg_avg_win` / `fvg_avg_loss` per symbol directly on the card.

**Alpha Zone** (`engines/strategies/alpha_zone.py`) — institutional swing strategy, 30-60 day hold, built around unmitigated demand order-block detection.

### 3.4 Query layer — range-based filtering, not single-bound thresholds

`api/screener.py`'s LaunchPad and Alpha Zone endpoints accept **band filters** (`min_x`/`max_x` pairs) for confidence, expected return, average volume (liquidity), and FVG gap size — not just a lower bound. Each active band is translated into a Mongo `$gte`/`$lte` range query, composed only from the bounds the caller actually supplied (an unset bound is simply omitted, never sent as `0` or `∞`), so adding a filter never changes behavior for callers that don't use it.

On the frontend, `src/components/screener/filters/` is a shared component library (`RangeFilter`, `DualRangeSlider`, `FilterPanel`, per-metric presets) used identically across all four filterable screener pages. The value model is deliberately simple: `{ min: number | null, max: number | null }`, where `null` means "unset" — mapping 1:1 onto the backend's "omit the bound" semantics, so swapping in a shared component never silently changes what gets filtered.

---

## 4. Features

**Frontend**
- Markets dashboard (mission control, sector rotation, macro intelligence, top movers)
- Screener suite (Technical, SMC, Volume Surge, LaunchPad, Alpha Zone, IPO Vintage) with saved filters and CSV export
- Portfolio optimizer (holdings analysis, risk metrics, rebalancing)
- Persisted, per-user watchlists with benchmark-relative performance
- Trading journal with setup tracking and trade history
- AI copilot chat and AI journal analysis

**Backend (Express)**
- Login with bcrypt password hashing — no public registration; accounts are seeded via `scripts/seedUsers.js` and given passwords through an interactive, never-logged prompt (`scripts/setPassword.js`)
- HTTP-only JWT cookies (no tokens in `localStorage`), `SameSite=None; Secure` in production, `Lax` locally
- Role (`owner`/`beta`/`demo`) and `isActive` on every user; clearing `isActive` revokes outstanding tokens
- Rate-limited, Helmet-hardened REST API
- Issues the shared identity token consumed by FastAPI

**AI / Analytics (FastAPI)**
- Portfolio analytics: CAGR, Sharpe/Sortino/Treynor, VaR, max drawdown, Monte Carlo–based MPT optimization
- Scanner pipelines pre-computed on a daily APScheduler job against a cached instrument universe
- Gemini-backed AI portfolio generation with a deterministic rule-based fallback when no API key is configured

---

## 5. AI Copilot — Agentic Backend

The copilot is a **multi-agent LangGraph system**, not a single-prompt chatbot. A
supervisor classifies each message and routes it to a specialist agent, which calls
LangChain tools that wrap the **existing Phase 1 analytics engines** — so the AI reasons
over the user's real portfolio and live market data, not generic knowledge.

### LangGraph flow

```
User message
   │
   ▼
load_memory ──► supervisor (intent classification)
                   │
     ┌─────────────┼─────────────┬───────────────┐
     ▼             ▼             ▼               ▼
 Portfolio      Market        Planning        Education
   Agent         Agent          Agent           Agent
     └─────────────┴─────────────┴───────────────┘
                   │
                   ▼
                finalize ──► answer + reasoning_summary + suggestions
              (persists turn, learns profile)
```

### Agents & tools

| Agent | Handles | Tools (wrap Phase 1) |
|---|---|---|
| **Portfolio** | "analyze my portfolio", health score, risk, rebalancing | `analyze_portfolio`, `get_user_holdings`, `get_health_score`, `rebalance_portfolio`, `calculate_risk/cagr/volatility` → `PortfolioService` + analytics engines |
| **Market** | stock analysis, "TCS vs INFY", sectors | `get_quote`, `get_stock_info`, `compare_stocks`, `sector_analysis` → `MarketDataService` |
| **Planning** | SIP, goals, retirement, "₹1 crore in 15 years" | `sip_calculator`, `future_value`, `compound_interest`, `risk_profile_mapper` |
| **Education** | concept explanations (Sharpe, ETF, diversification) | reads/writes the user's saved profile for personalisation |

### Model providers (swappable)

Provider is chosen by env — no model logic is hardcoded. Default is the cheapest reliable
model (Gemini Flash); switching is a one-line change:

```bash
AI_MODEL_PROVIDER=gemini   # default — gemini-2.5-flash   (GEMINI_API_KEY)
AI_MODEL_PROVIDER=groq     # open-source Llama models      (GROQ_API_KEY)
# openai / claude are recognised placeholders for future wiring
```

### Memory

- **Short-term**: conversation history per session (`ai_sessions`, `ai_messages`).
- **Long-term**: a per-user `financial_profiles` document — the copilot remembers stated
  preferences (risk appetite, horizon, goals) via an explicit tool plus a keyword heuristic,
  and personalises later answers. Degrades gracefully to stateless when Mongo is unavailable.

### Response guardrails

Prompts forbid guaranteed returns and bare buy/sell calls, and require the copilot to
explain reasoning, surface risk, and use the user's own data — e.g. *"Adding Reliance raises
your energy exposure; you're already ~35% energy, so this increases concentration risk."*

### API (`/api/v2/copilot`, JWT-authenticated)

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/chat` | Run a turn → `{ answer, agent_used, tools_called, reasoning_summary, suggestions, session_id }` |
| `GET` | `/history/{user_id}` | List the caller's sessions (identity from the token, path id ignored) |
| `DELETE` | `/session/{id}` | Delete one of the caller's sessions |
| `GET` | `/health` | Provider, graph, and Mongo status (no auth) |

```bash
curl -X POST https://<fastapi-host>/api/v2/copilot/chat \
  -H "Authorization: Bearer <jwt>" -H "Content-Type: application/json" \
  -d '{"message": "Analyze my portfolio and tell me the risks"}'
```

Identity is always taken from the verified JWT (Phase 6 boundary) — the request body carries
no `user_id`, so a user can only ever act on their own data.

### Frontend integration (`/ai-copilot`)

The copilot page is wired to the live agentic backend (replacing the earlier single-shot
route), styled to match the existing dark premium theme:

- **Chat** — real `POST /api/v2/copilot/chat`; each assistant reply renders an **agent badge**
  (Portfolio / Market / Planning / Education Analyst), **tool badges** (Risk Engine, Health
  Score, Market Service…), a collapsible **reasoning** panel, **sources**, and clickable
  **follow-up** suggestions, with copy + regenerate.
- **Session sidebar** — ChatGPT-style, grouped Today / Yesterday / Previous 7 Days / Older
  from `GET /history`; New Chat, delete (`DELETE /session/{id}`), plus rename & search
  (frontend-only: local title overrides + client-side filter, since the backend has no rename
  endpoint). Collapses to a drawer on mobile.
- **Input** — Enter to send, Shift+Enter for newline, live character counter, Stop-generation
  (aborts in-flight or halts the type-out), voice button (UI only), attachment (disabled).
- **Progress** — a simulated staged loader ("Thinking… → Consulting the analyst… → Running
  analytics… → Composing…") then a typing animation; real SSE token streaming lands in Phase 2C.
- Unauthenticated users get a "Sign in to use the Copilot" prompt (the copilot is per-user).

Frontend files live under `src/components/copilot/*`, `src/lib/api/copilot.ts`, and
`src/lib/copilot/*`; identity uses the shared `authHeader()` bearer token.

---

## 6. Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15 (App Router), React 18, TypeScript, Tailwind CSS, Radix UI, Recharts, Lightweight Charts |
| **Backend (Auth)** | Node.js, Express, Mongoose, JSON Web Tokens, bcrypt, Helmet |
| **AI / Analytics** | FastAPI, Python 3.11, LangGraph + LangChain (agentic copilot), pandas, NumPy, SciPy, scikit-learn, PyJWT, Gemini / Groq |
| **Data** | Upstox public V3 historical API (sole bulk OHLCV source for the scanner pipeline), yfinance (`^NSEI` benchmark fallback), Groww + Finnhub (live LTP quotes only — a separate, unaffected path) |
| **Database** | MongoDB Atlas — accessed via Mongoose (Express) and Motor (FastAPI) |
| **DevOps** | GitHub Actions CI, Render (Express + FastAPI), Vercel (frontend) |

---

## 7. Security

- **Authentication**: HTTP-only JWT cookies (not readable by client JS), bcrypt-hashed passwords. Production uses `SameSite=None; Secure` because the frontend and API are genuinely cross-domain (Vercel ↔ Render); local development uses `SameSite=Lax` over HTTP. Logout clears the cookie with the *same* attributes — a mismatch is rejected cross-site, which would leave the session alive after a "successful" logout.
- **No public registration**: the register route does not exist. Accounts are seeded from a roster that contains no secrets, and passwords are set through an interactive TTY-only prompt — never via argv, an environment variable, shell history, or a log line.
- **Deny-by-default API**: FastAPI rejects unauthenticated requests to everything except a short, explicit public list, enforced by middleware rather than per-route decoration. A test walks the live route table so a new public hole cannot land silently.
- **Production secret validation**: both Express (`backend/config/env.js`) and FastAPI (`backend/fastapi_app/config.py`) refuse to start in production if `JWT_SECRET` is unset — they fail closed instead of silently falling back to an insecure default.
- **Cross-service JWT verification**: FastAPI independently verifies every Express-issued token (HS256, shared secret) *and* re-checks that the account still exists and is active, rather than trusting any client-supplied identity.
- **IDOR protection**: portfolio and watchlist endpoints derive the owner from the verified token, and watchlist reads/writes are checked against the resource's actual owner before returning or mutating data.
- **Untrusted demo role**: the publicly shared demo credential cannot trigger a market scan or mutate watchlists, and carries the tightest Copilot budget. Limits are keyed per **user**, not per IP, because that one account is used by many people from many addresses.
- **Correct client attribution behind a proxy**: `trust proxy` is set to `1` — not `true` — so the rate limiter reads the real caller from the hop Render itself inserted. Left unset, every user shares one global bucket; set to `true`, a forged `X-Forwarded-For` would mint a fresh bucket per request.
- **Environment isolation**: no secrets are committed to the repository; every service reads configuration from environment variables with documented `.env.example` files.

**Honest limitations** — this is a portfolio project's security posture, not an audited, compliance-grade one. Rate limiting is in-memory and per-process, so it does not hold across multiple instances; there is no WAF/DDoS layer; and outside the Copilot, FastAPI's compute-heavy analytics endpoints are still unlimited. Both services' `/health` endpoints return 200 even when MongoDB is unreachable, so a dead database currently looks healthy to the platform's health check. ESLint is not yet enforced in CI (no config is committed). No claim of "bank-level" or compliance-certified security is made.

---

## 8. Testing & CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every push/PR across all three services. The goal is a boot-safety net — proving each service still starts and its core contract holds — not exhaustive coverage:

| Service | Checks |
|---|---|
| **Frontend** | `tsc --noEmit`, `next lint`, production `next build` |
| **Backend (Express)** | Syntax check, smoke tests via Node's built-in test runner (`node --test`) — boots the app on an ephemeral port and exercises `/health` and the JWT production-guard, without needing MongoDB or real secrets |
| **FastAPI** | `pytest` — 176 tests over the pinned `requirements.txt`, all offline (no MongoDB, no secrets, no network) |

The Next.js build no longer sets `typescript.ignoreBuildErrors` or `eslint.ignoreDuringBuilds`; with those in place the deploy build happily shipped real type errors. Note that ESLint enforcement still needs a committed config — the flag was the blocker, not the whole story.

Two suites are worth calling out because they guard properties that are easy to regress silently:

- **`tests/test_auth_guard.py`** — the deny-by-default boundary. It walks the *live* route table rather than a hardcoded list, so a router added later fails the suite unless someone deliberately marks it public.
- **`tests/test_ohlcv_store.py`** — storage fidelity. Asserts the encode/decode round-trip is **bit-exact** (not within a tolerance) and that the daily-refresh access pattern doesn't degrade into one full collection scan per symbol.

This catches broken builds, missing dependencies, and startup regressions before merge. It does not yet cover full end-to-end auth-flow integration tests — see [Roadmap](#10-roadmap).

---

## 9. Deployment

Three services deployed independently:

| Service | Platform | Notes |
|---|---|---|
| Frontend | Vercel | `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_FASTAPI_URL` / `NEXT_PUBLIC_APP_URL` are **build-time** env vars — inlined into the bundle, so changing one needs a redeploy, not a restart |
| Express backend | Render | Defined in `render.yaml`, health check at `/health` |
| FastAPI backend | Render | Separate service in `render.yaml`, `uvicorn main:app` bound to Render's `$PORT`, health check at `/health` |
| Database | MongoDB Atlas | Shared connection string across both backends. Render free has no static egress IP, so network access needs `0.0.0.0/0` plus a strong password |

Three settings are easy to miss and each breaks something specific:

- **`OHLCV_BACKEND=mongo`** on the FastAPI service. Left at the `csv` default, the 196 MB gitignored CSV isn't there, the scanners find an empty universe, and a scan that evaluates zero symbols publishes zero results — blanking every live scanner cache. **Run `scripts/migrate_ohlcv_to_mongo.py` before the first boot**, and never let Render perform a first-time download: with an empty collection every symbol would be fetched for 5 years at once and exhaust memory.
- **Identical `JWT_SECRET`** on both backends — it's the only thing that lets FastAPI verify what Express signed.
- **`NODE_ENV=production` / `ENVIRONMENT=production`** — these are what unmount the API docs and switch the cookie to `SameSite=None; Secure`.

Full environment-variable reference and deploy steps: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). Private-beta account operations: [`docs/PRIVATE-BETA.md`](docs/PRIVATE-BETA.md).

---

## 10. Roadmap

Realistic next steps, not yet implemented:

- **Deeper AI agents** — multi-step tool-calling (portfolio actions, not just chat) instead of a single-shot Gemini prompt.
- **RAG over market data/news** — ground AI responses in retrieved, sourced context instead of the model's own knowledge.
- **Observability** — structured logging and error tracking (e.g. Sentry) across all three services; currently only console/log output.
- **Deeper test coverage** — the auth boundary and OHLCV storage are now well covered; the analytics engine's business logic and an automated end-to-end login → JWT → cross-service test are not.
- **Distributed rate limiting** — replace the in-memory limiter with a shared store so limits hold across multiple instances/regions.
- **Database-aware health checks** — `/health` should fail when MongoDB is unreachable so the platform restarts a broken instance. Deliberately deferred: a 503 on a transient Atlas blip would make Render restart-loop and kill any in-flight scan, so this needs a grace period rather than a naive flip.
- **ESLint config** — the build no longer suppresses lint, but there are no rules committed for it to run.
- **Louder download-failure signaling** — the scan coordinator currently logs and continues on a failed OHLCV download rather than failing the scan outright; a future regression there would again run on stale data without an obvious error surfaced to the UI.
- **Public-launch compliance** — [`docs/COMPLIANCE-BLUEPRINT.md`](docs/COMPLIANCE-BLUEPRINT.md) is a parked, deliberately unimplemented plan for what would have to change before this could be offered publicly in India. It is a prerequisite for any public launch, not a backlog item.

---

## 11. Local Setup

**Prerequisites**: Node.js 20+, Python 3.11+, a MongoDB connection string (local or Atlas).

```bash
git clone <repo-url>
cd FinTechAI-AntiGravity
```

**1. Express backend**
```bash
cd backend
npm install
cp .env.example .env   # fill in MONGODB_URI and JWT_SECRET at minimum
npm run dev             # http://localhost:8080
```

**2. FastAPI backend**
```bash
cd backend/fastapi_app
python -m venv .venv && .venv/Scripts/activate   # or source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
cp .env.example .env    # use the SAME JWT_SECRET and MONGODB_URI as the Express .env
uvicorn main:app --reload --port 8000
```

**3. Frontend**
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev              # http://localhost:9002
```

`JWT_SECRET` **must be identical** across the Express and FastAPI `.env` files — it's what lets FastAPI verify tokens Express issued. FastAPI reads `backend/.env` (`env_file: "../.env"`), so a single value there serves both.

> Both `scripts/seedUsers.js` and `scripts/setPassword.js` call `require('dotenv').config()` with no path, which resolves `.env` relative to **the directory you run node from**, not the script's own location. Run them from `backend/`:
> ```bash
> cd backend && node scripts/setPassword.js someone@example.com
> ```

**4. Accounts** — there is no sign-up form. Seed the roster, then give each account a password (prompted twice, hidden, never logged):

```bash
cd backend
node scripts/seedUsers.js --dry-run   # preview
node scripts/seedUsers.js             # apply
node scripts/setPassword.js you@example.com
```

The seeder is idempotent and **never overwrites an existing password hash**, so re-running it is safe for accounts already in use.

**5. OHLCV data** — local development defaults to `ohlcv_backend="csv"` and reads `backend/data/Stock_Data.csv`. If you don't have that file, either let the downloader build it (first run fetches 5 years and takes a while) or point at MongoDB instead:

```bash
OHLCV_BACKEND=mongo uvicorn main:app --reload --port 8000
```

There is deliberately **no automatic fallback** between the two — a scan must never leave you guessing which source produced it, and a silently substituted stale CSV would look like a successful run.
