# FinAI Edge — AI-Powered Portfolio Intelligence Platform

> **Phase 1 — Production-Ready**
> Full-stack FinTech application for Indian retail investors. AI portfolio generation, real-time market data, portfolio risk analytics, MPT optimisation, and sector analysis.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Project Structure](#2-project-structure)
3. [Phase 1 Feature List](#3-phase-1-feature-list)
4. [Environment Variables](#4-environment-variables)
5. [How to Run — Frontend](#5-how-to-run--frontend)
6. [How to Run — Express Backend](#6-how-to-run--express-backend)
7. [How to Run — FastAPI Backend](#7-how-to-run--fastapi-backend)
8. [How to Run — Notebooks](#8-how-to-run--notebooks)
9. [API Reference](#9-api-reference)
10. [API Provider Setup](#10-api-provider-setup)
11. [Groww API Setup](#11-groww-api-setup)
12. [Gemini AI Setup](#12-gemini-ai-setup)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Frontend                         │
│                   localhost:9002                            │
│  Pages: Landing / Dashboard / Analytics / Markets /        │
│         Workspace / AI Insights / Screener / Journal       │
└────────────────┬────────────────────────┬───────────────────┘
                 │                        │
    REST (auth)  │          REST (analytics, AI, market)
                 │                        │
┌────────────────▼───────┐   ┌────────────▼──────────────────┐
│   Express Backend      │   │   FastAPI Backend             │
│   localhost:8080       │   │   localhost:8000              │
│                        │   │                               │
│  - JWT auth (login /   │   │  - Portfolio analytics        │
│    register / logout)  │   │  - MPT optimisation           │
│  - Session cookies     │   │  - Risk engine (VaR, Sharpe,  │
│  - Market proxy        │   │    Sortino, Beta, Drawdown)   │
│  - Rate limiting       │   │  - Sector analysis            │
│  - Helmet security     │   │  - AI portfolio generation    │
│                        │   │    (Gemini / rule-based)      │
└────────────┬───────────┘   └──────┬──────────────┬─────────┘
             │                      │              │
      MongoDB Atlas          yfinance       Groww / Finnhub
      (users, portfolios)    (primary)     (optional APIs)
```

### Data Flow

```
User enters holdings
    → Frontend sends POST /api/v2/portfolio/analyze-holdings
    → FastAPI: compute_all_holdings() → P&L, allocations
    → FastAPI: fetch 2y price history via yfinance (async)
    → FastAPI: compute volatility, Sharpe, VaR, beta vs Nifty
    → FastAPI: compute health score (diversification × risk × concentration × sector)
    → FastAPI: generate rebalance suggestions + insights
    → Frontend renders dashboard with all metrics
```

---

## 2. Project Structure

```
FinTechAI-AntiGravity/
├── README.md
├── render.yaml                    # Render.com deployment config
│
├── frontend/                      # Next.js 15 App (TypeScript)
│   ├── src/
│   │   ├── app/
│   │   │   ├── (app)/             # Authenticated layout group
│   │   │   │   ├── analytics/     # Portfolio analytics page
│   │   │   │   ├── dashboard/     # Main dashboard
│   │   │   │   ├── home/          # Home after login
│   │   │   │   ├── journal/       # Trade journal
│   │   │   │   ├── markets/       # Markets overview
│   │   │   │   ├── quant-lab/     # Quant research tools
│   │   │   │   ├── settings/      # User settings
│   │   │   │   └── workspace/     # Trading workspace
│   │   │   ├── ai-insights/       # AI portfolio insights
│   │   │   ├── analytics/         # Public analytics
│   │   │   ├── auth/              # Auth pages
│   │   │   ├── login/             # Login page
│   │   │   ├── onboarding/        # AI portfolio onboarding
│   │   │   ├── screener/          # Stock screener
│   │   │   ├── api/               # Next.js API routes
│   │   │   │   ├── journal/       # Journal API
│   │   │   │   ├── price/         # Price proxy
│   │   │   │   └── screener/      # Screener API
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx           # Landing page
│   │   ├── components/
│   │   │   ├── auth/              # Login / register forms
│   │   │   ├── common/            # Shared UI components
│   │   │   ├── dashboard/         # Dashboard panels, mini-charts
│   │   │   ├── journal/           # Trade journal components
│   │   │   ├── landing/           # Landing page sections
│   │   │   ├── layout/            # Sidebar, navbar
│   │   │   ├── markets/           # Market data widgets
│   │   │   ├── ui/                # shadcn/ui components
│   │   │   └── workspace/         # Trading workspace panels
│   │   ├── config/
│   │   │   └── env.ts             # Environment config with defaults
│   │   ├── context/               # React context providers
│   │   ├── hooks/                 # Custom React hooks
│   │   ├── lib/
│   │   │   ├── api/
│   │   │   │   ├── client.ts      # Express API client
│   │   │   │   ├── authApi.ts     # Auth API helpers
│   │   │   │   └── fastapi.ts     # FastAPI client (retry + timeout)
│   │   │   ├── auth/              # Auth utilities
│   │   │   ├── journal/           # Journal utilities
│   │   │   ├── market-data.ts     # Market data helpers
│   │   │   └── utils.ts           # Shared utilities
│   │   ├── ai/                    # Genkit AI integration
│   │   └── firebase.ts            # Firebase config
│   ├── .env                       # Local environment (not committed)
│   ├── .env.example               # Template — copy to .env
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   └── package.json
│
└── backend/
    ├── server.js                  # Express entry point (port 8080)
    ├── package.json
    ├── .env                       # Local environment (not committed)
    ├── .env.example               # Template — copy to .env
    ├── config/
    │   └── env.js                 # Express environment loader
    ├── controllers/
    │   └── authController.js      # Register, login, logout, me
    ├── middleware/
    │   ├── authMiddleware.js      # JWT protect middleware
    │   └── errorHandler.js        # 404 + global error handler
    ├── models/                    # Mongoose schemas
    ├── routes/
    │   ├── authRoutes.js          # /api/auth/*
    │   ├── markets.js             # /api/markets/*
    │   └── portfolio.js           # /api/portfolio/*
    ├── services/                  # Express service layer
    ├── utils/                     # Express utilities
    ├── requirements.txt           # Root Python deps (legacy)
    ├── notebooks/
    │   └── portfolio_research.ipynb
    └── fastapi_app/               # Python FastAPI backend (port 8000)
        ├── main.py                # FastAPI app + lifespan + middleware
        ├── config.py              # Pydantic Settings
        ├── validate_phase1.py     # Phase 1 verification script
        ├── requirements.txt       # Python dependencies
        ├── .env.example           # FastAPI env template
        ├── api/
        │   ├── ai.py              # POST /api/v2/ai/*
        │   ├── analytics.py       # POST /api/v2/analytics/*
        │   ├── market.py          # GET  /api/v2/market/*
        │   └── portfolio.py       # POST /api/v2/portfolio/*
        ├── services/
        │   ├── market_service.py  # Provider chain: Groww→yfinance→Finnhub
        │   └── portfolio_service.py # Full analytics orchestrator (90s timeout)
        ├── analytics/
        │   ├── __init__.py        # Public analytics API
        │   ├── risk_engine.py     # Vol, VaR, Sharpe, Sortino, Beta, CAGR
        │   ├── diversification.py # HHI, effective N, concentration score
        │   ├── health_score.py    # Composite 0-100 health score
        │   ├── sector_analysis.py # Sector exposure, concentration, bias
        │   └── rebalancer.py      # Rebalance suggestions engine
        ├── market/
        │   └── providers/
        │       ├── base.py        # Abstract provider + data models
        │       ├── yfinance_provider.py  # Default (no API key)
        │       ├── groww.py       # Groww Trading API (optional)
        │       └── finnhub_provider.py   # Finnhub (optional)
        ├── portfolio/
        │   └── calculator.py      # P&L, allocation, CAGR, insights
        ├── models/
        │   └── portfolio.py       # MongoDB portfolio CRUD (motor)
        ├── schemas/
        │   ├── portfolio.py       # Pydantic request schemas
        │   └── ai.py              # Onboarding / AI schemas
        └── utils/
            ├── cache.py           # Async in-memory TTL cache
            └── helpers.py         # NSE stock DB, sector map, ticker validation
```

---

## 3. Phase 1 Feature List

### Frontend
- [x] Landing page with animated hero, feature cards, pricing
- [x] Login / Register with JWT auth (Express)
- [x] Onboarding flow → AI portfolio generation
- [x] Dashboard with portfolio summary, P&L, sector pie chart
- [x] Analytics page: risk metrics, health score, sector exposure, rebalance suggestions
- [x] Markets page: live quotes, search, candlestick charts
- [x] Workspace: trade insights, trade table, behavior intelligence panel
- [x] Trade Journal
- [x] Stock Screener
- [x] Dark / Light mode toggle
- [x] Responsive layout (sidebar + mobile)
- [x] FastAPI client with AbortController timeout + exponential-backoff retry

### FastAPI Backend
- [x] `POST /api/v2/portfolio/analyze-holdings` — Full holdings analysis (90s timeout)
- [x] `POST /api/v2/portfolio/analyze` — MPT optimisation, efficient frontier
- [x] `POST /api/v2/portfolio/health` — Quick health check
- [x] `POST /api/v2/portfolio/rebalance` — Rebalance suggestions
- [x] `POST /api/v2/portfolio/save` — MongoDB persistence
- [x] `GET  /api/v2/portfolio/saved` — List user portfolios
- [x] `GET  /api/v2/market/quote/{symbol}` — Live quote (Groww→yfinance→Finnhub)
- [x] `GET  /api/v2/market/search` — Instrument search (curated NSE DB)
- [x] `GET  /api/v2/market/candles/{symbol}` — Historical OHLCV
- [x] `GET  /api/v2/market/bulk-quotes` — Multi-symbol quotes (max 30)
- [x] `GET  /api/v2/market/provider-status` — Provider health + cache stats
- [x] `POST /api/v2/analytics/risk` — Fast risk + concentration (no market fetch)
- [x] `POST /api/v2/analytics/sector` — Sector exposure + bias (no market fetch)
- [x] `POST /api/v2/analytics/diversification` — Diversification score
- [x] `POST /api/v2/analytics/concentration` — Concentration + rebalance hints
- [x] `POST /api/v2/ai/generate-portfolio` — AI portfolio (Gemini or rule-based)
- [x] `GET  /health` — Health check

### Analytics Engine
- [x] P&L calculation (invested, current value, gain/loss %)
- [x] Portfolio allocation (% per holding, sums to 100%)
- [x] Sector exposure + concentration + bias (defensive/aggressive tilt)
- [x] Annualized volatility (Ledoit-Wolf covariance, 252-day)
- [x] Sharpe ratio (Indian risk-free rate: 6.5%)
- [x] Sortino ratio (downside deviation only)
- [x] Treynor ratio (systematic risk)
- [x] Historical VaR (95% + 99%, daily + annual)
- [x] Maximum drawdown (peak-to-trough)
- [x] Beta vs Nifty 50
- [x] CAGR (from historical price series)
- [x] HHI-based concentration score
- [x] Composite health score (diversification × risk × concentration × sector)
- [x] Rebalance suggestions (trim/add/introduce/remove)
- [x] MPT efficient frontier (scipy SLSQP)
- [x] Max-Sharpe + Min-Volatility optimal portfolios
- [x] Pearson correlation matrix

### Infrastructure
- [x] Provider fallback chain: Groww → yfinance → Finnhub
- [x] Async TTL cache (quotes: 5 min, candles: 1 hr, search: cached)
- [x] Provider cooldown on repeated failures (60s)
- [x] Per-provider retry with exponential backoff
- [x] 90s timeout on full portfolio analysis (graceful partial response)
- [x] Structured logging at every pipeline step
- [x] MongoDB portfolio persistence (motor async)
- [x] CORS configured for frontend dev + prod URLs
- [x] Request timing header (X-Process-Time)
- [x] Phase 1 validation script

### Express Backend
- [x] JWT authentication (register / login / logout / me)
- [x] bcrypt password hashing
- [x] HttpOnly cookie sessions
- [x] Rate limiting (100 req / 15 min)
- [x] Helmet security headers
- [x] Market proxy routes
- [x] MongoDB (Mongoose) user model

---

## 4. Environment Variables

### Frontend — `frontend/.env`

```env
# Express backend (auth, markets proxy)
NEXT_PUBLIC_API_URL=http://localhost:8080

# FastAPI backend (portfolio analytics, AI)
NEXT_PUBLIC_FASTAPI_URL=http://localhost:8000

# Gemini AI (server-side only — keep secret)
GEMINI_API_KEY=your_gemini_key_here

# Firebase (optional — stub active if not set)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
```

> Copy `frontend/.env.example` to `frontend/.env` and fill in your values.

---

### Express Backend — `backend/.env`

```env
# Server
PORT=8080
NODE_ENV=development
FRONTEND_URL=http://localhost:9002

# MongoDB
MONGODB_URI=mongodb://localhost:27017/finai_edge

# Auth
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRE=30d

# Market data (optional — used by Express markets proxy)
FINNHUB_API_KEY=
```

> Copy `backend/.env.example` to `backend/.env` and fill in your values.

---

### FastAPI Backend — `backend/fastapi_app/.env` (or `backend/.env`)

```env
# Server
FASTAPI_PORT=8000
ENVIRONMENT=development
FRONTEND_URL=http://localhost:9002
LOG_LEVEL=INFO

# MongoDB
MONGODB_URI=mongodb://localhost:27017/finai_edge

# Groww Trading API (optional — yfinance used if not set)
GROWW_API_KEY=
GROWW_TOTP_SECRET=

# Google Gemini AI (optional — rule-based fallback if not set)
GEMINI_API_KEY=

# Finnhub (optional — tertiary fallback)
FINNHUB_API_KEY=
```

> **Note:** FastAPI reads `../  .env` (i.e. `backend/.env`) via pydantic-settings.
> You can place a single `.env` in `backend/` and both Express and FastAPI will use it.

---

## 5. How to Run — Frontend

**Requirements:** Node.js 18+, npm 9+

```bash
# 1. Install dependencies
cd frontend
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env — set NEXT_PUBLIC_API_URL and NEXT_PUBLIC_FASTAPI_URL

# 3. Start dev server (port 9002)
npm run dev
```

Open: http://localhost:9002

**Production build:**

```bash
npm run build
npm start
```

**TypeScript check:**

```bash
npm run typecheck
```

**Lint:**

```bash
npm run lint
```

---

## 6. How to Run — Express Backend

**Requirements:** Node.js 18+, npm 9+, MongoDB running

```bash
# 1. Install dependencies
cd backend
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env — set MONGODB_URI and JWT_SECRET

# 3. Start (port 8080)
npm start

# Dev with auto-reload
npm run dev
```

Express API base: http://localhost:8080/api

**Verify it's running:**

```bash
curl http://localhost:8080/health
# {"status":"healthy","db":"connected"}
```

---

## 7. How to Run — FastAPI Backend

**Requirements:** Python 3.11+, pip

```bash
# 1. Create virtual environment (recommended)
cd backend/fastapi_app
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Set up environment
# Create backend/.env (FastAPI reads ../. env = backend/.env)
cp .env.example ../.env
# Edit ../  .env — add GEMINI_API_KEY, GROWW keys, etc.

# 4. Start FastAPI (port 8000)
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Production (no reload, multiple workers)
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
```

FastAPI docs (Swagger UI): http://localhost:8000/docs
FastAPI ReDoc: http://localhost:8000/redoc

**Verify it's running:**

```bash
curl http://localhost:8000/health
# {"status":"healthy","service":"finai-edge-fastapi",...}
```

**Run Phase 1 validation script:**

```bash
# With server running on port 8000:
cd backend/fastapi_app
python validate_phase1.py

# Without server (still tests imports + calculations):
python validate_phase1.py
```

---

## 8. How to Run — Notebooks

**Requirements:** Python 3.11+, Jupyter

```bash
# 1. Install Jupyter + dependencies
cd backend
pip install jupyter notebook pandas numpy matplotlib seaborn yfinance --break-system-packages
# or inside your venv:
pip install jupyter notebook pandas numpy matplotlib seaborn yfinance

# 2. Start Jupyter
cd backend/notebooks
jupyter notebook

# Or Jupyter Lab:
jupyter lab
```

Open `portfolio_research.ipynb` in the browser.

**Available notebooks:**

| Notebook | Purpose |
|---|---|
| `portfolio_research.ipynb` | Exploratory portfolio analysis, NSE stock research |

---

## 9. API Reference

### FastAPI — Portfolio

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v2/portfolio/analyze-holdings` | Full holdings analysis (P&L, risk, health, insights) |
| POST | `/api/v2/portfolio/analyze` | MPT optimisation + efficient frontier |
| POST | `/api/v2/portfolio/health` | Quick health score check |
| POST | `/api/v2/portfolio/rebalance` | Rebalance suggestions |
| POST | `/api/v2/portfolio/save` | Save portfolio to MongoDB |
| GET  | `/api/v2/portfolio/saved` | List user's saved portfolios |

**Example — analyze-holdings:**

```bash
curl -X POST http://localhost:8000/api/v2/portfolio/analyze-holdings \
  -H "Content-Type: application/json" \
  -d '{
    "holdings": [
      {"ticker": "RELIANCE.NS", "name": "Reliance", "quantity": 10,
       "avg_buy_price": 2800, "current_price": 3000},
      {"ticker": "TCS.NS", "name": "TCS", "quantity": 5,
       "avg_buy_price": 3500, "current_price": 3700}
    ]
  }'
```

---

### FastAPI — Analytics (Fast — No Market Data Fetch)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v2/analytics/risk` | Risk level + concentration |
| POST | `/api/v2/analytics/sector` | Sector exposure + bias |
| POST | `/api/v2/analytics/diversification` | Diversification score + health |
| POST | `/api/v2/analytics/concentration` | Concentration + rebalance hints |

> These endpoints use local computation only (no yfinance calls). They respond in < 500ms.

---

### FastAPI — Market Data

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v2/market/quote/{symbol}` | Live quote (Groww→yfinance→Finnhub) |
| GET | `/api/v2/market/search?q={query}` | Instrument search |
| GET | `/api/v2/market/candles/{symbol}` | OHLCV candles |
| GET | `/api/v2/market/bulk-quotes?symbols=A,B,C` | Multiple quotes |
| GET | `/api/v2/market/provider-status` | Provider health + cache stats |

---

### FastAPI — AI

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v2/ai/generate-portfolio` | Generate portfolio (Gemini / rule-based) |

**Example:**

```bash
curl -X POST http://localhost:8000/api/v2/ai/generate-portfolio \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "wealth_creation",
    "horizon": "7y+",
    "risk": "balanced",
    "monthly_investment": 10000
  }'
```

---

### Express — Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login (sets HttpOnly cookie) |
| POST | `/api/auth/logout` | Logout (clears cookie) |
| GET  | `/api/auth/me` | Get current user (requires auth) |
| PUT  | `/api/auth/username` | Update username |

---

### Express — Markets

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/markets/overview` | Market overview |
| GET | `/api/markets/news` | Market news |
| GET | `/api/markets/quote/:symbol` | Single quote proxy |

---

## 10. API Provider Setup

### yfinance (Default — No Setup Required)

yfinance is always active as the primary/fallback provider. No API key needed. It fetches data from Yahoo Finance.

**Limitations:**
- Rate limits apply (avoid hammering with bulk calls > 30 tickers)
- Intraday data has some delay
- Some Indian MF tickers may not be available

---

### Finnhub (Optional — Tertiary Fallback)

1. Sign up at https://finnhub.io/dashboard (free tier available)
2. Copy your API key
3. Add to `backend/.env`:
   ```env
   FINNHUB_API_KEY=your_key_here
   ```
4. Finnhub is activated automatically as the third provider in the chain

**Free tier limits:** 60 API calls/minute

---

## 11. Groww API Setup

> **Note:** Groww Trading API requires a paid subscription and is intended for Indian residents with an active Groww account. The app works fully without it — yfinance is the default.

1. Apply for Groww API access at https://developer.groww.in
2. After approval, generate your API key and TOTP secret from the developer dashboard
3. Add to `backend/.env`:
   ```env
   GROWW_API_KEY=your_groww_api_key
   GROWW_TOTP_SECRET=your_totp_secret
   ```

**Important:** The env variable is `GROWW_TOTP_SECRET` (not `GROWW_API_SECRET`). This matches the `config.py` setting `groww_totp_secret`.

When Groww is configured, it becomes the **primary** market data provider. The fallback chain becomes: **Groww → yfinance → Finnhub**.

---

## 12. Gemini AI Setup

1. Go to https://aistudio.google.com/app/apikey
2. Create a new API key (free tier available)
3. Add to `backend/.env` (FastAPI reads this):
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

When configured, the AI portfolio generation endpoint uses `gemini-2.5-flash` with structured output (JSON schema enforcement via Pydantic). If not configured, a rule-based template system generates portfolios instead — the frontend still works normally.

**Gemini model used:** `gemini-2.5-flash`
**Timeout:** 30s (with 45s frontend timeout for safety margin)
**Fallback:** Rule-based templates (conservative / balanced / aggressive)

---

## 13. Troubleshooting

### FastAPI won't start

```
ModuleNotFoundError: No module named 'fastapi'
```
**Fix:** Make sure you're in the virtual environment and have installed dependencies:
```bash
cd backend/fastapi_app
.venv\Scripts\activate    # Windows
pip install -r requirements.txt
uvicorn main:app --port 8000 --reload
```

---

### yfinance returns empty data

```
yfinance bulk download returned empty
```
**Fix:** Yahoo Finance rate-limits aggressive requests. Wait 60 seconds and retry. For > 10 tickers, the bulk download may take 5–15 seconds.

Also ensure tickers use the correct format:
- Indian NSE stocks: `RELIANCE.NS`, `TCS.NS`, `HDFCBANK.NS`
- Nifty index: `^NSEI`
- Nifty BeES ETF: `NIFTYBEES.NS`

---

### MongoDB connection fails

```
[MongoDB] Connection failed: connect ECONNREFUSED 127.0.0.1:27017
```
**Fix:** Start MongoDB locally:
```bash
# Windows (run as admin)
net start MongoDB

# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod
```

Or use MongoDB Atlas and set `MONGODB_URI` to your Atlas connection string.

---

### Gemini API timeout

```
Gemini API call timed out after 30s, falling back to templates
```
**This is handled gracefully** — the endpoint returns a rule-based portfolio. If you see this repeatedly:
1. Check your Gemini API key in `.env`
2. Check your internet connection
3. The free Gemini tier can be slow under load — consider upgrading

---

### Frontend can't connect to FastAPI

```
[FastAPI] Network error on attempt 1/3: Failed to fetch
```
**Fix:**
1. Ensure FastAPI is running: `curl http://localhost:8000/health`
2. Check `frontend/.env` has `NEXT_PUBLIC_FASTAPI_URL=http://localhost:8000`
3. Restart the Next.js dev server after editing `.env`
4. Check FastAPI CORS allows `http://localhost:9002`

---

### Analytics routes are slow

Previously, `/api/v2/analytics/risk`, `/sector`, `/diversification`, and `/concentration` each triggered the **full** portfolio pipeline (90s potential). This has been fixed in Phase 1 — they now use a fast local computation path with no market data fetches. Response time should be < 500ms.

---

### Portfolio analysis timeout

```
analyze_holdings timed out after 90.0s — returning partial result
```
**This is a graceful degradation** — the frontend receives basic P&L data. To avoid timeouts:
1. Reduce number of holdings (< 20 recommended)
2. yfinance may be slow — wait a minute and retry
3. Check `GET /api/v2/market/provider-status` to see provider health

---

### GROWW_API_SECRET vs GROWW_TOTP_SECRET

If you previously had `GROWW_API_SECRET` in your `.env`, rename it to `GROWW_TOTP_SECRET`. The `config.py` uses `groww_totp_secret` and the `.env.example` has been updated accordingly.

---

### TypeScript build errors

```bash
cd frontend
npm run typecheck
```
Common causes:
- Missing `NEXT_PUBLIC_FASTAPI_URL` in `.env` (defaults to `http://localhost:8000` — safe to ignore locally)
- Outdated `node_modules` — run `npm install` again

---

### Running the Phase 1 validation script

```bash
cd backend/fastapi_app

# Activate venv first
.venv\Scripts\activate   # Windows
source .venv/bin/activate  # macOS/Linux

# Run checks (imports + calculations work without server)
python validate_phase1.py

# Run full checks including route verification (requires server running)
# Terminal 1:
uvicorn main:app --port 8000

# Terminal 2:
python validate_phase1.py
```

Expected output when all passing:
```
[v] config.get_settings
[v] analytics.risk_engine.compute_portfolio_volatility
[v] compute_portfolio_volatility     | vol=0.1823
[v] compute_sharpe_ratio             | sharpe=0.412
[v] compute_portfolio_health         | score=72 label=Moderate
...
Phase 1 validation PASSED - all critical checks are green.
```
