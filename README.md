# FinAI Edge — AI-Powered Portfolio Intelligence Platform

> **Phase 1 — Production Ready**  
> Institutional-grade portfolio analytics for Indian retail investors. AI portfolio generation, real-time market data, risk analytics, MPT optimisation, and sector analysis — all in one platform.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Phase 1 Feature List](#4-phase-1-feature-list)
5. [Environment Variables](#5-environment-variables)
6. [How to Run — Frontend](#6-how-to-run--frontend)
7. [How to Run — Express Backend](#7-how-to-run--express-backend)
8. [How to Run — FastAPI Backend](#8-how-to-run--fastapi-backend)
9. [How to Run — Notebooks](#9-how-to-run--notebooks)
10. [API Reference](#10-api-reference)
11. [API Provider Setup](#11-api-provider-setup)
12. [Groww API Setup](#12-groww-api-setup)
13. [Gemini AI Setup](#13-gemini-ai-setup)
14. [MongoDB Setup](#14-mongodb-setup)
15. [Quant Lab Module](#15-quant-lab-module)
16. [Portfolio Optimizer Workflow](#16-portfolio-optimizer-workflow)
17. [Troubleshooting](#17-troubleshooting)
18. [Screenshots](#18-screenshots)
19. [Future Roadmap](#19-future-roadmap)

---

## 1. Architecture Overview

```
+------------------------------------------+
|           Next.js 15 Frontend            |
|           localhost:9002                 |
|                                          |
|  Landing / Dashboard / Analytics /       |
|  Markets / Workspace / AI Insights /     |
|  Screener / Journal / Quant Lab          |
+----------+-------------------+-----------+
           |                   |
  REST (auth, markets)    REST (analytics, AI)
           |                   |
+----------v--------+  +-------v-----------------+
|  Express Backend  |  |   FastAPI Backend       |
|  localhost:8080   |  |   localhost:8000        |
|                   |  |                         |
|  - JWT auth       |  |  - Portfolio analytics  |
|  - Sessions       |  |  - MPT optimisation     |
|  - Market proxy   |  |  - Risk engine          |
|  - Rate limiting  |  |  - AI portfolio gen     |
|  - Helmet         |  |  - Sector analysis      |
+----------+--------+  +------+----------+-------+
           |                  |          |
     MongoDB Atlas        yfinance   Groww / Finnhub
    (users, ports)        (default)  (optional APIs)
```

### Request Flow for Portfolio Analysis

```
User submits holdings
  -> POST /api/v2/portfolio/analyze-holdings (FastAPI, port 8000)
     -> compute_all_holdings()         [Step 1: P&L, allocation]
     -> compute_sector_exposure()      [Step 2: Sector analysis]
     -> compute_concentration_score()  [Step 3: HHI, effective N]
     -> get_bulk_prices() via yfinance [Step 4: 2yr price history]
        -> compute_portfolio_volatility()
        -> compute_sharpe_ratio()
        -> compute_sortino_ratio()
        -> compute_var() (95% + 99%)
        -> compute_max_drawdown()
        -> compute_beta() vs Nifty 50
        -> compute_cagr_from_prices()
        -> compute_diversification_score()
     -> compute_portfolio_health()     [Step 5: Composite 0-100]
     -> generate_rebalance_suggestions() [Step 6: Action items]
     -> generate_insights()            [Step 7: AI insights]
  <- Returns full analysis JSON
     -> Frontend renders: KPIs + Donut + Risk table + Holdings + Rebalance + Insights
```

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 18, TypeScript, Tailwind CSS |
| UI Components | shadcn/ui, Framer Motion, Recharts |
| Express Backend | Node.js 18+, Express 4, JWT, Mongoose |
| FastAPI Backend | Python 3.11+, FastAPI, Pydantic v2, Uvicorn |
| Analytics | NumPy, Pandas, SciPy (SLSQP), Scikit-learn (Ledoit-Wolf) |
| Market Data | yfinance (default), Groww API (optional), Finnhub (optional) |
| AI | Google Gemini 2.5 Flash (optional, rule-based fallback) |
| Database | MongoDB (Motor async driver) |
| Auth | JWT (HttpOnly cookies), bcrypt |

---

## 3. Project Structure

```
FinTechAI-AntiGravity/
├── README.md
├── start-dev.bat              # One-click Windows dev starter
├── render.yaml                # Render.com deployment config
│
├── frontend/                  # Next.js 15 App (TypeScript)
│   ├── src/
│   │   ├── app/
│   │   │   ├── (app)/         # Authenticated route group
│   │   │   │   ├── analytics/
│   │   │   │   ├── dashboard/
│   │   │   │   │   └── portfolio/   # Main portfolio dashboard
│   │   │   │   ├── home/
│   │   │   │   ├── journal/
│   │   │   │   ├── markets/
│   │   │   │   ├── quant-lab/
│   │   │   │   │   └── optimizer/   # Portfolio optimizer + AI builder
│   │   │   │   ├── settings/
│   │   │   │   └── workspace/
│   │   │   ├── ai-insights/
│   │   │   ├── auth/
│   │   │   ├── login/
│   │   │   ├── onboarding/
│   │   │   ├── screener/
│   │   │   └── api/           # Next.js API routes (journal, price, screener)
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   ├── dashboard/     # KPI cards, mini-charts
│   │   │   ├── layout/        # Sidebar, navbar
│   │   │   ├── markets/       # Market widgets
│   │   │   ├── ui/            # shadcn/ui base components
│   │   │   └── workspace/     # Trade table, insight panel
│   │   ├── config/env.ts      # Env config with safe defaults
│   │   ├── hooks/
│   │   └── lib/
│   │       ├── api/
│   │       │   ├── fastapi.ts # FastAPI client (retry + timeout)
│   │       │   └── client.ts  # Express API client
│   │       └── auth/
│   ├── .env                   # Local env (not committed)
│   ├── .env.example           # Template
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   └── package.json
│
└── backend/
    ├── server.js              # Express entry point (port 8080)
    ├── package.json
    ├── .env                   # Local env (not committed)
    ├── .env.example
    ├── config/env.js
    ├── controllers/authController.js
    ├── middleware/
    ├── models/                # Mongoose schemas
    ├── routes/
    │   ├── authRoutes.js      # /api/auth/*
    │   ├── markets.js         # /api/markets/*
    │   └── portfolio.js       # /api/portfolio/*
    ├── notebooks/
    │   └── portfolio_research.ipynb
    └── fastapi_app/           # Python FastAPI (port 8000)
        ├── main.py            # App factory, middleware, routing
        ├── config.py          # Pydantic Settings
        ├── validate_phase1.py # Full stack verification script
        ├── requirements.txt
        ├── .env.example
        ├── api/
        │   ├── ai.py          # POST /api/v2/ai/*
        │   ├── analytics.py   # POST /api/v2/analytics/*
        │   ├── market.py      # GET  /api/v2/market/*
        │   └── portfolio.py   # POST /api/v2/portfolio/*
        ├── services/
        │   ├── market_service.py    # Provider chain orchestrator
        │   └── portfolio_service.py # Analysis pipeline (90s timeout)
        ├── analytics/
        │   ├── __init__.py
        │   ├── risk_engine.py       # Vol, Sharpe, Sortino, VaR, Beta, CAGR
        │   ├── diversification.py   # HHI, effective N, concentration
        │   ├── health_score.py      # Composite 0-100 health
        │   ├── sector_analysis.py   # Sector exposure, concentration, bias
        │   └── rebalancer.py        # Rebalance suggestions engine
        ├── market/providers/
        │   ├── base.py
        │   ├── yfinance_provider.py  # Default (no key, async wrapped)
        │   ├── groww.py              # Groww Trading API
        │   └── finnhub_provider.py   # Finnhub
        ├── portfolio/
        │   └── calculator.py         # P&L, allocation, insights
        ├── models/portfolio.py        # MongoDB CRUD (motor)
        ├── schemas/                   # Pydantic request schemas
        ├── utils/
        │   ├── cache.py               # Async TTL cache
        │   └── helpers.py             # NSE DB, sector map, validators
        └── tests/
            └── validate_analytics.py  # Analytics unit test suite
```

---

## 4. Phase 1 Feature List

### Frontend
- [x] Landing page (hero, features, pricing)
- [x] JWT auth (login / register / logout)
- [x] Onboarding flow + AI portfolio generation
- [x] Portfolio dashboard (INDmoney-grade UI)
  - [x] 6 KPI cards with P&L, CAGR, Sharpe, Volatility
  - [x] Animated health gauge (SVG, 0-100)
  - [x] Sector allocation donut + bar chart (interactive)
  - [x] Risk analytics panel (8 metrics)
  - [x] Holdings table (sortable, filterable, delete)
  - [x] Add Holding form (live P&L preview)
  - [x] Rebalance suggestions with priority badges
  - [x] AI insight cards (4 tones: warn/good/info/strong)
  - [x] Concentration panel with HHI
  - [x] Privacy toggle (hide/show values)
  - [x] Demo data + empty states
  - [x] API error state with FastAPI start instructions
- [x] Markets page
- [x] Trade Journal
- [x] Stock Screener
- [x] Dark / Light mode
- [x] Mobile responsive layout
- [x] FastAPI client: AbortController timeout + exponential-backoff retry

### FastAPI Backend (19 endpoints)
- [x] `GET  /health`
- [x] `GET  /api/v2/status` — Full system status
- [x] `POST /api/v2/portfolio/analyze-holdings` — Full 90s pipeline
- [x] `POST /api/v2/portfolio/analyze` — MPT efficient frontier
- [x] `POST /api/v2/portfolio/health` — Quick health check
- [x] `POST /api/v2/portfolio/rebalance` — Rebalance suggestions
- [x] `POST /api/v2/portfolio/save` — MongoDB persistence
- [x] `GET  /api/v2/portfolio/saved` — List user portfolios
- [x] `GET  /api/v2/market/quote/{symbol}`
- [x] `GET  /api/v2/market/search`
- [x] `GET  /api/v2/market/candles/{symbol}`
- [x] `GET  /api/v2/market/bulk-quotes`
- [x] `GET  /api/v2/market/provider-status`
- [x] `POST /api/v2/analytics/risk` — Fast (< 500ms, no market fetch)
- [x] `POST /api/v2/analytics/sector`
- [x] `POST /api/v2/analytics/diversification`
- [x] `POST /api/v2/analytics/concentration`
- [x] `POST /api/v2/ai/generate-portfolio` — Gemini or rule-based

### Analytics Engine (verified via validate_analytics.py)
- [x] P&L calculation (invested, value, gain/loss %)
- [x] Portfolio allocation (sums to exactly 100%)
- [x] Sector exposure + concentration + bias detection
- [x] Annualized volatility (Ledoit-Wolf covariance, 252-day)
- [x] Sharpe ratio (risk-free = 6.5% Indian T-bill)
- [x] Sortino ratio (downside deviation only)
- [x] Treynor ratio (systematic risk measure)
- [x] Historical VaR (95% + 99%, daily + annual)
- [x] Maximum drawdown (peak-to-trough)
- [x] Beta vs Nifty 50
- [x] CAGR (from price series or P&L estimate)
- [x] HHI concentration index
- [x] Effective number of stocks
- [x] Composite health score (0-100, 4 components)
- [x] MPT efficient frontier (scipy SLSQP)
- [x] Max-Sharpe + Min-Volatility optimal portfolios
- [x] Pearson correlation matrix

### Infrastructure
- [x] Provider chain: Groww → yfinance → Finnhub
- [x] All yfinance calls wrapped in asyncio.to_thread() (non-blocking)
- [x] Async TTL cache (quotes: 5m, candles: 1h, search: 30m)
- [x] Per-provider retry with exponential backoff (2 retries)
- [x] Provider cooldown on failure (60s)
- [x] 90s timeout on full portfolio analysis (graceful partial)
- [x] Structured step logging (timing per pipeline stage)
- [x] Graceful MongoDB failure (analytics work without DB)
- [x] CORS configured for frontend dev + prod URLs
- [x] Request timing header (X-Process-Time)
- [x] Analytics validation test suite (60+ assertions)

### Express Backend
- [x] JWT auth (register / login / logout / me)
- [x] bcrypt password hashing
- [x] HttpOnly cookie sessions
- [x] Rate limiting (100 req / 15 min)
- [x] Helmet security headers
- [x] Market proxy routes
- [x] MongoDB Mongoose user model

---

## 5. Environment Variables

### Frontend — `frontend/.env`

```env
# Express backend (auth, markets)
NEXT_PUBLIC_API_URL=http://localhost:8080

# FastAPI backend (portfolio analytics, AI)
NEXT_PUBLIC_FASTAPI_URL=http://localhost:8000

# Gemini AI (server-side Next.js only)
GEMINI_API_KEY=your_gemini_key_here

# Firebase (optional)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
```

### Express Backend — `backend/.env`

```env
PORT=8080
NODE_ENV=development
FRONTEND_URL=http://localhost:9002
MONGODB_URI=mongodb://localhost:27017/finai_edge
JWT_SECRET=your_super_secret_jwt_key_minimum_32_chars
JWT_EXPIRE=30d
FINNHUB_API_KEY=
```

### FastAPI Backend — `backend/fastapi_app/.env` (or `backend/.env`)

```env
FASTAPI_PORT=8000
ENVIRONMENT=development
FRONTEND_URL=http://localhost:9002
LOG_LEVEL=INFO

MONGODB_URI=mongodb://localhost:27017/finai_edge

# Market Data (all optional — yfinance is the default)
GROWW_API_KEY=
GROWW_TOTP_SECRET=

# AI (optional — rule-based fallback if not set)
GEMINI_API_KEY=

# Finnhub (optional tertiary fallback)
FINNHUB_API_KEY=
```

> **Note:** FastAPI reads `backend/.env` via `env_file="../.env"`. You can use a single `.env` in `backend/` for both Express and FastAPI.

---

## 6. How to Run — Frontend

```bash
cd frontend

# Install
npm install

# Configure
cp .env.example .env
# Edit .env: set NEXT_PUBLIC_API_URL and NEXT_PUBLIC_FASTAPI_URL

# Dev server (port 9002)
npm run dev
```

Open: **http://localhost:9002**

```bash
# Type check
npm run typecheck

# Lint
npm run lint

# Production build
npm run build && npm start
```

---

## 7. How to Run — Express Backend

```bash
cd backend

# Install
npm install

# Configure
cp .env.example .env
# Edit .env: set MONGODB_URI and JWT_SECRET

# Dev (auto-reload)
npm run dev

# Production
npm start
```

API base: **http://localhost:8080/api**

Verify: `curl http://localhost:8080/health`

---

## 8. How to Run — FastAPI Backend

```bash
cd backend/fastapi_app

# Create virtual environment (recommended)
python -m venv .venv

# Activate
.venv\Scripts\activate      # Windows
source .venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure — create backend/.env with your keys
# (FastAPI reads ../.env relative to fastapi_app/)

# Dev server (port 8000, hot reload)
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Production (2 workers, no reload)
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
```

Swagger UI: **http://localhost:8000/docs**  
ReDoc: **http://localhost:8000/redoc**

Verify: `curl http://localhost:8000/health`

### Run Analytics Validation Suite

```bash
cd backend/fastapi_app
python tests/validate_analytics.py
```

Expected: `All analytics calculations verified. Phase 1 backend PASSED.`

### Run Full Stack Verification

```bash
# Start FastAPI first, then:
python validate_phase1.py
```

---

## 9. How to Run — Notebooks

```bash
cd backend
pip install jupyter pandas numpy matplotlib seaborn yfinance

cd notebooks
jupyter notebook
# or: jupyter lab
```

Open `portfolio_research.ipynb` for NSE stock research and portfolio analysis.

---

## 10. API Reference

### FastAPI — System

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Basic health check |
| GET | `/api/v2/status` | Full system status (providers, cache, MongoDB) |

### FastAPI — Portfolio

| Method | Endpoint | Body | Description |
|---|---|---|---|
| POST | `/api/v2/portfolio/analyze-holdings` | `{ holdings: [...] }` | Full analysis (P&L, risk, health, insights) |
| POST | `/api/v2/portfolio/analyze` | `{ tickers, weights, risk_profile }` | MPT optimization |
| POST | `/api/v2/portfolio/health` | `{ holdings }` | Quick health check |
| POST | `/api/v2/portfolio/rebalance` | `{ holdings }` | Rebalance suggestions |
| POST | `/api/v2/portfolio/save` | `{ user_id, name, holdings }` | Save to MongoDB |
| GET  | `/api/v2/portfolio/saved` | `?user_id=` | List saved portfolios |

**Holdings input schema:**
```json
{
  "holdings": [
    {
      "ticker": "RELIANCE.NS",
      "name": "Reliance Industries",
      "quantity": 10,
      "avg_buy_price": 2800,
      "current_price": 3000,
      "sector": "Energy"
    }
  ]
}
```

### FastAPI — Analytics (Fast, < 500ms)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v2/analytics/risk` | Risk level + concentration |
| POST | `/api/v2/analytics/sector` | Sector exposure + bias |
| POST | `/api/v2/analytics/diversification` | Diversification score |
| POST | `/api/v2/analytics/concentration` | Concentration + rebalance hints |

### FastAPI — Market Data

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v2/market/quote/{symbol}` | Live quote (cached 5m) |
| GET | `/api/v2/market/search?q={query}` | Instrument search |
| GET | `/api/v2/market/candles/{symbol}` | Historical OHLCV (cached 1h) |
| GET | `/api/v2/market/bulk-quotes?symbols=A,B,C` | Multi-symbol (max 30) |
| GET | `/api/v2/market/provider-status` | Provider health + cache stats |

### FastAPI — AI

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v2/ai/generate-portfolio` | Generate portfolio (Gemini / rule-based) |

```json
{
  "goal": "wealth_creation",
  "horizon": "7y+",
  "risk": "balanced",
  "monthly_investment": 10000
}
```

### Express — Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Login (sets HttpOnly cookie) |
| POST | `/api/auth/logout` | Logout |
| GET  | `/api/auth/me` | Current user (requires auth) |
| PUT  | `/api/auth/username` | Update username |

---

## 11. API Provider Setup

### yfinance (Default — No Setup)

Always active, no API key needed. Wraps Yahoo Finance. All calls run in `asyncio.to_thread()` to prevent event loop blocking.

Tickers use `.NS` suffix for NSE: `RELIANCE.NS`, `TCS.NS`, `^NSEI` (Nifty).

### Finnhub (Optional)

1. Sign up: https://finnhub.io/dashboard (free tier: 60 calls/min)
2. Add to `backend/.env`: `FINNHUB_API_KEY=your_key`
3. Automatically becomes tertiary provider

---

## 12. Groww API Setup

> Requires paid Groww Trading API subscription (India only). App works fully without it.

1. Apply: https://developer.groww.in
2. After approval, get API key + TOTP secret
3. Add to `backend/.env`:
   ```env
   GROWW_API_KEY=your_api_key
   GROWW_TOTP_SECRET=your_totp_secret   # NOTE: TOTP_SECRET, not API_SECRET
   ```
4. Groww becomes primary provider automatically

---

## 13. Gemini AI Setup

1. Get key: https://aistudio.google.com/app/apikey (free tier)
2. Add to `backend/.env`: `GEMINI_API_KEY=your_key`
3. FastAPI uses `gemini-2.5-flash` with 30s timeout + rule-based fallback

---

## 14. MongoDB Setup

### Local

```bash
# Windows
net start MongoDB

# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod
```

URI: `mongodb://localhost:27017/finai_edge`

### Atlas (Cloud)

1. Create free cluster at https://mongodb.com/atlas
2. Get connection string
3. Set `MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/finai_edge`

> If MongoDB is unavailable, all analytics still work — only portfolio save/load is disabled.

---

## 15. Quant Lab Module

The Quant Lab (Optimizer) module has two flows:

**Option A — Analyze Existing Portfolio**
- Enter stock tickers + weights manually
- Runs MPT analysis via `/api/v2/portfolio/analyze`
- Shows: efficient frontier, optimal portfolios, correlation matrix, VaR

**Option B — AI Portfolio Builder**
- Answer onboarding questions (goal, horizon, risk, monthly SIP)
- Calls `/api/v2/ai/generate-portfolio` (Gemini or rule-based)
- Shows: AI-generated allocation, SIP projection, beginner explanation

---

## 16. Portfolio Optimizer Workflow

```
User Input
  |
  +--[Option A]--> Manual tickers/weights
  |                    |
  |               POST /api/v2/portfolio/analyze
  |                    |
  |               Efficient frontier (SLSQP)
  |               Max-Sharpe portfolio
  |               Min-Vol portfolio
  |               Correlation heatmap
  |
  +--[Option B]--> Onboarding answers
                       |
                  POST /api/v2/ai/generate-portfolio
                       |
                  Gemini 2.5 Flash (if key set)
                       |-- success --> AI-tailored portfolio
                       |-- timeout/fail --> Rule-based template
                       |
                  SIP projection (FV formula)
                  Goal alignment text
                  Beginner explanation
```

---

## 17. Troubleshooting

### FastAPI won't start: `ModuleNotFoundError`

```bash
cd backend/fastapi_app
.venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn main:app --port 8000 --reload
```

### yfinance returns empty data

Yahoo Finance rate-limits heavy usage. Wait 60 seconds and retry. Use `.NS` suffix for all NSE stocks.

### MongoDB connection failed

```
[MongoDB] connection failed - ...
```

Analytics still work. Only portfolio save/load fails. Start MongoDB or set Atlas URI. The warning is non-fatal.

### Gemini timeout (30s)

```
Gemini API call timed out after 30s, falling back to templates
```

Non-fatal — rule-based portfolio returned. Check `GEMINI_API_KEY` in `.env`. Gemini free tier can be slow under load.

### Frontend can't reach FastAPI

```
[FastAPI] Network error on attempt 1/3: Failed to fetch
```

1. Verify FastAPI is running: `curl http://localhost:8000/health`
2. Check `frontend/.env` has `NEXT_PUBLIC_FASTAPI_URL=http://localhost:8000`
3. Restart Next.js after `.env` changes
4. Check CORS allows `http://localhost:9002`

### Analytics endpoints slow (was: > 30s)

Fixed in Phase 1. `/api/v2/analytics/risk|sector|diversification|concentration` now use local computation (no market data fetch). Response time < 500ms.

### Portfolio analysis timeout (90s)

Graceful partial result returned (basic P&L). Reduce holdings count or wait for yfinance to recover.

### GROWW_API_SECRET vs GROWW_TOTP_SECRET

Must be `GROWW_TOTP_SECRET` (matches `config.py`). `GROWW_API_SECRET` is incorrect and will be ignored.

### TypeScript errors on build

```bash
cd frontend
npm run typecheck
```

Most common: missing `NEXT_PUBLIC_FASTAPI_URL` in `.env` (safe to ignore locally — defaults to `http://localhost:8000`).

### Run analytics validation

```bash
cd backend/fastapi_app
python tests/validate_analytics.py
```

All 60+ assertions should pass with `Phase 1 backend PASSED.`

---

## 18. Screenshots

> _Screenshots will be added post-deployment._

- [ ] Landing page
- [ ] Portfolio dashboard (dark mode)
- [ ] Portfolio dashboard (light mode)
- [ ] Sector allocation donut chart
- [ ] Risk analytics panel
- [ ] Holdings table
- [ ] AI portfolio builder (onboarding flow)
- [ ] Quant lab optimizer (efficient frontier)
- [ ] Markets page
- [ ] Mobile view

---

## 19. Future Roadmap

### Phase 2 (Planned)
- Real-time WebSocket price streaming
- Advanced options analytics (Greeks, IV surface)
- Multi-currency support (USD, EUR alongside INR)
- Portfolio backtesting engine
- Alert system (price, P&L, rebalance triggers)
- Social portfolio comparison

### Phase 3 (Planned)
- LangGraph-powered AI research agent
- RAG over company filings (SEBI EDGAR)
- Multi-agent portfolio committee simulation
- Vector DB for semantic stock search
- Automated tax-loss harvesting suggestions
- Demat account integration (Zerodha Kite API)
