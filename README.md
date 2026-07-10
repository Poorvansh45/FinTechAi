# FinAI Edge

**AI-Powered Financial Intelligence Platform**

A full-stack investment analytics platform for Indian equity markets — portfolio analysis, technical/smart-money screeners, watchlists, a trading journal, and an AI copilot — built across three coordinated services with a JWT trust boundary between them.

---

## 1. Overview

FinAI Edge helps retail investors and active traders analyze portfolios, screen the market, and journal trades, with AI-assisted insights layered on top of quantitative analytics.

- **Portfolio analytics** — holdings P&L, sector exposure, risk metrics (Sharpe, Sortino, VaR, drawdown), health scoring, and rebalance suggestions computed with Modern Portfolio Theory.
- **Market screeners** — five independent scanners (Technical, Smart Money Concepts, Volume Surge, Fair Value Gap, Momentum) over a cached NSE universe, refreshed on a daily schedule.
- **AI copilot & journal coaching** — a Gemini-backed chat assistant and a trading-journal analyzer that summarizes patterns in a user's trade history.
- **Watchlists** — per-user, persisted, with performance tracking against a benchmark.

This is a personal/portfolio engineering project, not a live trading or brokerage system. Market data comes from `yfinance` with optional Groww/Finnhub fallbacks — there is no order execution or custody of funds.

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

1. On login/register, Express signs a JWT (`{ id: userId }`, HS256) and sets it as an HTTP-only cookie.
2. Because Express, FastAPI, and the frontend are deployed as separate origins in production, that cookie is not automatically visible to FastAPI. The frontend fetches the token once via an authenticated `GET /api/auth/token` on Express and attaches it as `Authorization: Bearer <token>` on calls to FastAPI.
3. FastAPI's `get_current_user` dependency (`backend/fastapi_app/utils/auth.py`) verifies the token against the shared `JWT_SECRET` with `PyJWT` and derives the caller's identity from the token — never from a client-supplied field in the request body.
4. Every user-owned endpoint (saved portfolios, watchlists — create, read, update, delete) is scoped to that verified id, closing an IDOR class of bug where one user could read or modify another user's data.

Express and FastAPI never share code or a process — the only thing they share is the secret used to sign/verify.

---

## 3. Features

**Frontend**
- Markets dashboard (mission control, sector rotation, macro intelligence, top movers)
- Five-scanner screener suite with saved filters and CSV export
- Portfolio optimizer (holdings analysis, risk metrics, rebalancing)
- Persisted, per-user watchlists with benchmark-relative performance
- Trading journal with setup tracking and trade history
- AI copilot chat and AI journal analysis

**Backend (Express)**
- Registration/login with bcrypt password hashing
- HTTP-only, `SameSite`-configured JWT cookies (no tokens in `localStorage`)
- Rate-limited, Helmet-hardened REST API
- Issues the shared identity token consumed by FastAPI

**AI / Analytics (FastAPI)**
- Portfolio analytics: CAGR, Sharpe/Sortino/Treynor, VaR, max drawdown, Monte Carlo–based MPT optimization
- Scanner pipelines pre-computed on a daily APScheduler job against a cached instrument universe
- Gemini-backed AI portfolio generation with a deterministic rule-based fallback when no API key is configured

---

## AI Copilot — Agentic Backend (Phase 2)

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

## 4. Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15 (App Router), React 18, TypeScript, Tailwind CSS, Radix UI, Recharts, Lightweight Charts |
| **Backend (Auth)** | Node.js, Express, Mongoose, JSON Web Tokens, bcrypt, Helmet |
| **AI / Analytics** | FastAPI, Python 3.11, LangGraph + LangChain (agentic copilot), pandas, NumPy, SciPy, scikit-learn, PyJWT, Gemini / Groq |
| **Data** | yfinance (primary market data), Groww API and Finnhub (optional fallbacks) |
| **Database** | MongoDB Atlas — accessed via Mongoose (Express) and Motor (FastAPI) |
| **DevOps** | GitHub Actions CI, Render (Express + FastAPI), Vercel (frontend) |

---

## 5. Security

- **Authentication**: HTTP-only JWT cookies (not readable by client JS), bcrypt-hashed passwords, `SameSite=strict` cookies in production.
- **Production secret validation**: both Express (`backend/config/env.js`) and FastAPI (`backend/fastapi_app/config.py`) refuse to start in production if `JWT_SECRET` is unset — they fail closed instead of silently falling back to an insecure default.
- **Cross-service JWT verification**: FastAPI independently verifies every Express-issued token (HS256, shared secret) rather than trusting any client-supplied identity.
- **IDOR protection**: portfolio and watchlist endpoints derive the owner from the verified token, and watchlist reads/writes are checked against the resource's actual owner before returning or mutating data.
- **Protected AI routes**: the copilot and journal-analysis endpoints require a valid session before calling Gemini, and apply input-length limits and a basic per-IP/user rate limit to reduce quota abuse.
- **Environment isolation**: no secrets are committed to the repository; every service reads configuration from environment variables with documented `.env.example` files.

**Honest limitations** — this is a portfolio project's security posture, not an audited, compliance-grade one. The AI-route rate limiter is in-memory and per-instance (not effective across multiple serverless instances), there is no WAF/DDoS layer, and FastAPI's compute-heavy analytics endpoints are not yet rate-limited. No claim of "bank-level" or compliance-certified security is made.

---

## 6. Testing & CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every push/PR across all three services. The goal is a boot-safety net — proving each service still starts and its core contract holds — not exhaustive coverage:

| Service | Checks |
|---|---|
| **Frontend** | `tsc --noEmit`, `next lint` (non-blocking), production `next build` |
| **Backend (Express)** | Syntax check, smoke tests via Node's built-in test runner (`node --test`) — boots the app on an ephemeral port and exercises `/health` and the JWT production-guard, without needing MongoDB or real secrets |
| **FastAPI** | `pytest` — app-import and `/health` smoke tests, run against the pinned `requirements.txt` |

This catches broken builds, missing dependencies, and startup regressions before merge. It does not yet cover full auth-flow integration tests or business-logic unit tests — see [Roadmap](#8-roadmap).

---

## 7. Deployment

Three services deployed independently:

| Service | Platform | Notes |
|---|---|---|
| Frontend | Vercel | `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_FASTAPI_URL` are build-time env vars — set before building |
| Express backend | Render | Defined in `render.yaml`, health check at `/health` |
| FastAPI backend | Render | Separate service in `render.yaml`, `uvicorn main:app` bound to Render's `$PORT`, health check at `/health` |
| Database | MongoDB Atlas | Shared connection string across both backends |

Full environment-variable reference and deploy steps: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## 8. Roadmap

Realistic next steps, not yet implemented:

- **Deeper AI agents** — multi-step tool-calling (portfolio actions, not just chat) instead of a single-shot Gemini prompt.
- **RAG over market data/news** — ground AI responses in retrieved, sourced context instead of the model's own knowledge.
- **Observability** — structured logging and error tracking (e.g. Sentry) across all three services; currently only console/log output.
- **Deeper test coverage** — integration tests for the full login → JWT → cross-service request flow, and unit tests for the analytics engine.
- **Distributed rate limiting** — replace the in-memory limiter with a shared store so limits hold across multiple instances/regions.

---

## 9. Local Setup

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

`JWT_SECRET` **must be identical** across the Express and FastAPI `.env` files — it's what lets FastAPI verify tokens Express issued.
