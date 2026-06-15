# FinAI Edge — AI-Powered Trading Intelligence Platform

> **Phase 1 + V3 Scanner Upgrade — Production Ready**
> Institutional-grade portfolio analytics and trading intelligence for Indian retail investors and active traders. AI portfolio generation, real-time market data, risk analytics, MPT optimisation, Trading Journal with AI coaching, and a full five-scanner engine (Technical · SMC · Volume Surge · FVG · Momentum) with Smart Watchlist analytics — all in one platform.

---

## V3 Upgrade Summary (Latest)

### Scanner Engine (completely rewritten)

Pre-computed MongoDB cache pipeline with a daily APScheduler job and five independent scanner modules:

| Scanner | What's New |
|---|---|
| **Technical** | EMA % distance replaces absolute EMA values — cross-stock comparable at any price level |
| **SMC** | Full LuxAlgo-faithful BOS/CHoCH, demand/supply Order Blocks, EQH/EQL, Premium/Discount zones, SMC Score 0–100 |
| **Volume Surge** | Per-surge history — 1D/2D/3D/5D/10D/20D forward returns, win rates, max gain/drawdown per historical event |
| **FVG** | True ICT-style gaps (C1.High < C3.Low), ATR threshold, displacement strength, mitigation %, FVG Score 0–100 |
| **Momentum** | New — Momentum Score 0–100 (RSI + EMA alignment + volume expansion + 52W proximity + RS vs Nifty50) |

### Smart Watchlists (redesigned)

- Delete confirmation modal — no accidental deletes
- **Benchmark Analytics** tab — alpha vs Nifty50, performance heatmap, best/worst performers, return bars
- **Portfolio equity curve** from comparison_returns (1D/5D/10D/30D/90D/Now)
- **Scanner Distribution** bar chart — see which scanners you use most
- **Source Analytics** — rank which scanner produces the best average return
- **Comparison Engine** tab — avg return, win rate, max gain, max drawdown, alpha per scanner
- WatchlistTable now shows 12 columns: Max↑, Max↓, Drawdown from peak, Annualised Volatility, Alpha vs Nifty50
- Source badges colour-coded by scanner (purple=SMC, blue=FVG, orange=Volume, green=Momentum, yellow=Technical)

### Frontend Architecture

- Shared `screener/layout.tsx` — scan-status banner (last ran, symbols processed, elapsed) + manual Refresh trigger
- Scanner tab strip across all 6 screener pages — persistent navigation
- `ScannerTable` handles all 5 modes with expandable per-surge (volume) and per-FVG rows
- Momentum Scanner page at `/screener/momentum`
- Nav config updated with Momentum Scanner entry

### Backend Architecture

- `daily_refresh.py` — APScheduler cron at 15:45 IST, startup check. Triggers local incremental sync to `Stock_Data.csv` first, then computes scans in-memory.
- Local Database: Reads EOD historical daily data from `backend/data/Stock_Data.csv` for all screeners, eliminating dynamic API rate limits.
- Five MongoDB caches: `screener_cache`, `fvg_cache`, `volume_surge_cache`, `momentum_cache`, `smc_scanner_results`
- `GET /api/v2/scanner/scan-status` — last ran, symbols processed, elapsed seconds
- `POST /api/v2/scanner/trigger-scan` — manually trigger full scan in background
- `apscheduler==3.10.4` added to `requirements.txt`
- `main.py` fully rewritten — cleaner lifespan, dual router registration, asyncio import

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Tech Stack](#2-tech-stack)
3. [Scanner Pipeline](#3-scanner-pipeline)
4. [Project Structure](#4-project-structure)
5. [Module Overview](#5-module-overview)
6. [Phase 1 + V3 Feature List](#6-phase-1--v3-feature-list)
7. [Environment Variables](#7-environment-variables)
8. [How to Run — Frontend](#8-how-to-run--frontend)
9. [How to Run — Express Backend](#9-how-to-run--express-backend)
10. [How to Run — FastAPI Backend](#10-how-to-run--fastapi-backend)
11. [API Reference](#11-api-reference)
12. [MongoDB Collections](#12-mongodb-collections)
13. [Daily Scheduler](#13-daily-scheduler)
14. [API Provider Setup](#14-api-provider-setup)
15. [Groww API Setup](#15-groww-api-setup)
16. [Gemini AI Setup](#16-gemini-ai-setup)
17. [MongoDB Setup](#17-mongodb-setup)
18. [Trading Journal](#18-trading-journal)
19. [Quant Lab Module](#19-quant-lab-module)
20. [SMC Scanner Deep Dive](#20-smc-scanner-deep-dive)
21. [FVG Scanner Deep Dive](#21-fvg-scanner-deep-dive)
22. [Troubleshooting](#22-troubleshooting)
23. [Future Roadmap](#23-future-roadmap)

---

## 1. Architecture Overview

```
+----------------------------------------------+
|            Next.js 15 Frontend               |
|            localhost:9002                    |
|                                              |
|  screener/layout.tsx ← scan-status banner   |
|  Technical · SMC · Volume · FVG · Momentum  |
|  Watchlists (Holdings/Comparison/Source/    |
|              Benchmark)                      |
+----------+--------------------+--------------+
           |                    |
  REST (auth, markets)    REST (scanners, analytics, AI)
           |                    |
+----------v----------+ +-------v--------------------------+
|  Express Backend    | |   FastAPI Backend               |
|  localhost:8080     | |   localhost:8000                |
|                     | |                                 |
|  - JWT auth         | |  - Portfolio analytics          |
|  - HttpOnly cookies | |  - Scanner cache pipeline       |
|  - Sessions         | |  - SMC / FVG / Momentum         |
|  - Market proxy     | |  - Volume surge analysis        |
|  - Rate limiting    | |  - Watchlist CRUD + analytics   |
|  - Helmet security  | |  - AI portfolio generation      |
|  - bcrypt           | |  - Daily APScheduler (15:45 IST)|
|  - Mongoose ODM     | |  - Universe cache               |
+----------+----------+ +------+-------------------+------+
           |                   |                   |
     MongoDB Atlas          yfinance        Groww / Finnhub
    (users, caches)         (default)       (optional)
```

### Scanner Cache Pipeline

```
APScheduler (15:45 IST daily) or manual trigger
  → download_incremental_ohlc()     [incremental Groww/yfinance sync to Stock_Data.csv]
  → Load backend/data/Stock_Data.csv [Pandas DataFrame load]
  → fetch Nifty50 1M return         [baseline for RS]
  → For each Symbol (in-memory):
      → slice last 2y daily candles from DataFrame
      → compute EMA9/50/200         [pandas EWM]
      → compute RSI14               [delta method]
      → compute MACD(12,26,9)       [pandas EWM]
      → compute volume ratio        [rolling 20d avg]
      → compute 52W high/low
      → run detect_volume_surges()  [per-surge history]
      → run get_latest_fvgs()       [ICT FVG scoring]
      → run compute_momentum_score()
  → bulk upsert MongoDB caches (screener_cache, fvg_cache, volume_surge_cache, momentum_cache, smc_scanner_results)
  → write scan_meta (timestamp, count, elapsed)
```

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 18, TypeScript, Tailwind CSS |
| UI Components | shadcn/ui, Lucide Icons, Recharts, Lightweight Charts |
| AI (Frontend) | Firebase Genkit + Google AI (`@genkit-ai/googleai`) |
| Express Backend | Node.js 18+, Express 4, JWT, Mongoose, bcryptjs |
| FastAPI Backend | Python 3.11+, FastAPI, Pydantic v2, Uvicorn |
| Scanner Analytics | NumPy, Pandas (EMA, RSI, MACD, ATR, FVG, SMC) |
| Portfolio Analytics | SciPy (SLSQP), Scikit-learn (Ledoit-Wolf) |
| Market Data | yfinance (default), Groww API (optional), Finnhub (optional) |
| AI (Backend) | Google Gemini 2.5 Flash (optional, rule-based fallback) |
| Scheduler | APScheduler 3.10.4 (AsyncIOScheduler, 15:45 IST cron) |
| Database | MongoDB Atlas (Motor async driver, Mongoose ODM) |
| Auth | JWT (HttpOnly cookies), bcrypt, Firebase (optional) |
| Deployment | Vercel (frontend), Render.com (Express backend) |

---

## 3. Scanner Pipeline

### How the daily scan works

On FastAPI startup, `maybe_run_on_startup()` checks `scan_meta` in MongoDB. If the last scan was more than 6 hours ago (or never ran), it fires `run_daily_scan()` as a background asyncio task.

APScheduler also fires `run_daily_scan()` every day at 15:45 IST (10:15 UTC) — just after NSE market close.

The daily scan first triggers an incremental sync using `ohlc_downloader.py`. This reads your stock list, pulls new daily EOD candles via the Groww API (or yfinance fallback), and appends them to `backend/data/Stock_Data.csv`. Once the local CSV database is updated, the scan executes in-memory using Pandas and computes all Technical, SMC, FVG, Momentum, and Volume Surge screeners locally.

### MongoDB caches populated

| Collection | Contents | Used by |
|---|---|---|
| `screener_cache` | EMA%, RSI, MACD, volume per symbol | Technical screener |
| `fvg_cache` | Top 3 bullish FVGs, FVG score, strength, mitigation | FVG scanner |
| `volume_surge_cache` | Full surge history, aggregate stats | Volume surge scanner |
| `momentum_cache` | Momentum score 0–100, category, RS vs Nifty | Momentum scanner |
| `smc_zones` | Individual SMC demand/supply zones | SMC scanner |
| `smc_scanner_results` | Full SMC analysis per symbol | SMC scanner |
| `scan_meta` | Last ran timestamp, symbols processed, elapsed | Scan status API |

### Triggering a scan manually

```bash
# Via API
curl -X POST http://localhost:8000/api/v2/scanner/trigger-scan

# Check status
curl http://localhost:8000/api/v2/scanner/scan-status
```

Or click **Refresh Data** in the screener toolbar in the UI.

---

## 4. Project Structure

```
FinTechAi/
├── README.md
├── render.yaml
├── docs/
│   ├── blueprint.md
│   └── architecture-refactor-plan.md
│
├── frontend/
│   └── src/
│       ├── app/
│       │   └── screener/
│       │       ├── layout.tsx          ← scan-status banner + tab strip
│       │       ├── page.tsx            ← Technical screener
│       │       ├── smc/page.tsx        ← SMC scanner
│       │       ├── volume/page.tsx     ← Volume surge scanner
│       │       ├── fvg/page.tsx        ← FVG scanner
│       │       ├── momentum/page.tsx   ← Momentum scanner (NEW)
│       │       └── watchlists/page.tsx ← Smart watchlists (redesigned)
│       ├── components/
│       │   ├── screener/
│       │   │   ├── ScannerTable.tsx   ← 5-mode table with expandable rows
│       │   │   ├── FVGScanner.tsx     ← ICT FVG UI (NEW)
│       │   │   ├── VolumeScanner.tsx  ← Per-surge history UI (NEW)
│       │   │   └── MomentumScanner.tsx ← Momentum UI (NEW)
│       │   └── watchlists/
│       │       ├── WatchlistTable.tsx  ← 12-column table
│       │       ├── WatchlistSummaryCards.tsx ← 8 KPI cards
│       │       ├── WatchlistComparison.tsx   ← Comparison engine
│       │       ├── SourceAnalytics.tsx       ← Scanner ranking
│       │       └── AddToWatchlistModal.tsx
│       ├── services/
│       │   ├── screenerService.ts     ← All scanner API calls + trigger
│       │   └── watchlistService.ts    ← Full watchlist CRUD + typed
│       └── types/
│           └── screener.ts            ← Universal StockData type
│
└── backend/
    └── fastapi_app/
        ├── main.py                    ← Rewritten with dual routers + scheduler
        ├── requirements.txt           ← Added apscheduler
        ├── api/
        │   ├── screener.py            ← All 5 scanner endpoints + scan control
        │   └── smc.py                 ← SMC endpoints with full filter support
        ├── scanners/
        │   ├── smc_scanner.py         ← Full LuxAlgo-faithful SMC pipeline
        │   ├── fvg.py                 ← ICT FVG detection + scoring
        │   ├── volume.py              ← Per-surge history + aggregate stats
        │   └── momentum.py            ← Momentum score engine
        ├── services/
        │   ├── scanner_service.py     ← All 5 scanner DB queries
        │   └── smc_service.py         ← SMC pipeline orchestrator
        └── schedulers/
            └── daily_refresh.py       ← APScheduler + full cache pipeline
```

---

## 5. Module Overview

### Technical Screener

Filter NSE stocks using percentage-based EMA distance (works at any price level), RSI, MACD histogram, and volume. Supports 2,500+ stock universe with instant in-memory pagination and search.

### SMC Scanner

Faithful reproduction of LuxAlgo Smart Money Concepts:
- Swing detection (configurable length)
- BOS (Break of Structure) and CHoCH (Change of Character) for both bullish and bearish directions
- Demand and Supply Order Block extraction with ATR-based volatility filtering
- Equal Highs / Equal Lows with ATR threshold
- Liquidity sweep detection (EQH/EQL sweeps)
- Premium / Equilibrium / Discount zone calculation
- SMC Score (0–100) weighting: active OB (25), BOS/CHoCH (20), zone quality (15), EQL sweep (15), distance (15), volume (5), RSI (5)
- Filters: Inside Zone, Near Zone 2%/5%, Fresh Zones, BOS/CHoCH, Premium/Discount, Unmitigated

### Volume Surge Scanner

For every historical volume surge event (volume > 2.5x 20d average), stores: surge_date, surge_price, volume_ratio, day_return, return_1d through return_20d, max_gain_after_surge, max_drawdown_after_surge.

Aggregates per stock: avg_1d through avg_20d, win_rate_1d through win_rate_20d, max_gain_ever, max_drawdown_ever.

Rows are expandable in the UI to show every historical surge event in a detailed table.

### FVG Scanner

True ICT-style Fair Value Gaps:
- Candle 1 High < Candle 3 Low (strict ICT rule)
- ATR threshold filter (gap must exceed 0.3x ATR)
- Displacement score (C2 body ratio)
- Mitigation tracking (how much of the gap price has revisited)
- Touch count (how many times price touched the zone)
- Deep failure filter (price 5%+ through zone removes it entirely)
- FVG Score (0–100): gap size (20), displacement (20), mitigation (20), touches (15), distance (15), EMA200 alignment (5), RSI health (5)
- Strength classification: Strong ≥70, Medium 45–69, Weak <45
- Status: Untouched, Touched, PartiallyFilled, MostlyFilled

### Momentum Scanner

Composite Momentum Score (0–100):
- RSI 14 strength (25 pts)
- Price above EMA50 + EMA200 with distance bonus (25 pts)
- Volume ratio vs 20d average (15 pts)
- 52-week high proximity (15 pts)
- Relative strength vs Nifty50 1M return (10 pts)
- MACD histogram direction (10 pts)

Categories: Strong Momentum (≥80), Emerging Momentum (≥65), Breakout Candidate (≥50), Watch (≥35), Weak (<35).

### Smart Watchlists

Track every stock added from any scanner. Enriched with:
- Current return vs added price
- Max gain and max drawdown since added
- Drawdown from peak (current_price vs max_price_since_added)
- Annualised volatility (stdev × √252)
- Alpha vs Nifty50 (stock return minus Nifty50 return over same period)
- Comparison returns: 1D, 5D, 10D, 30D, 90D since added

Tabs: Holdings, Comparison Engine (per-scanner metrics), Source Analytics (scanner ranking), Benchmark (heatmap + alpha + best/worst performers).

### Trading Journal

9-step trade ticket wizard, equity curve, performance calendar, AI Performance Center, Trader Score, AI Journal Analyzer (Gemini batch review).

### Portfolio Dashboard

6 KPI cards, animated health gauge, sector donut + bar chart, risk analytics panel (8 metrics), rebalance suggestions, AI insight cards, privacy toggle.

### Quant Lab / Optimizer

MPT efficient frontier (SciPy SLSQP), Max-Sharpe + Min-Vol portfolios, Pearson correlation heatmap, AI portfolio builder (Gemini 2.5 Flash or rule-based), SIP projection.

---

## 6. Phase 1 + V3 Feature List

### Scanners (V3)
- [x] Technical screener — EMA50/200 % distance, RSI, MACD, Volume
- [x] SMC scanner — BOS, CHoCH, demand/supply OBs, EQH/EQL, liquidity sweeps, P/D zones, SMC Score
- [x] Volume surge — per-surge history with 1D–20D forward returns + aggregate win rates
- [x] FVG scanner — ICT-style, ATR threshold, mitigation tracking, FVG Score 0–100
- [x] Momentum scanner — Momentum Score 0–100 with RS vs Nifty
- [x] Shared screener layout — scan-status banner + tab strip + manual refresh trigger
- [x] ScannerTable — 5 display modes, expandable rows for surge history and FVG detail
- [x] All scanners: Add to Watchlist button

### Watchlists (V3)
- [x] Smart Watchlist page — full redesign with 4 tabs
- [x] Delete confirmation modal
- [x] Holdings tab — 12-column table with max↑, max↓, drawdown, volatility, alpha
- [x] Comparison Engine — per-scanner avg return, win rate, max gain, max drawdown, alpha
- [x] Source Analytics — scanner ranking by avg return with insight callout
- [x] Benchmark tab — Nifty50 alpha, heatmap, best/worst performers, return bars
- [x] Portfolio equity curve (SVG, from comparison_returns)
- [x] Scanner distribution bar chart
- [x] WatchlistSummaryCards — 8 KPIs including alpha, volatility, drawdown
- [x] watchlistService.ts — full TypeScript types, env-aware URL, error handling

### Backend (V3)
- [x] `daily_refresh.py` — APScheduler 15:45 IST, startup stale-check, batch processing
- [x] `scanners/smc_scanner.py` — full pipeline: swing detect, BOS/CHoCH, OB, EQH/EQL, sweeps, P/D, SMC Score
- [x] `scanners/fvg.py` — ICT FVG, ATR threshold, displacement, mitigation, scoring
- [x] `scanners/volume.py` — per-surge history, forward returns, aggregate stats
- [x] `scanners/momentum.py` — Momentum Score, categories, build_momentum_record()
- [x] `services/scanner_service.py` — all 5 scanner MongoDB query methods
- [x] `services/smc_service.py` — full SMC pipeline orchestrator
- [x] `api/screener.py` — 5 scanner endpoints + scan-status + trigger-scan
- [x] `api/smc.py` — SMC endpoints with category/score/event/direction filters
- [x] `main.py` — dual router registration, scheduler startup, asyncio import
- [x] `requirements.txt` — apscheduler added
- [x] `types/screener.ts` — universal StockData type covering all 5 scanner modes

### Phase 1 (existing)
- [x] Portfolio dashboard — health gauge, sector donut, risk panel, rebalance, AI insights
- [x] Trading Journal — 9-step ticket, equity curve, calendar, AI coach, Trader Score
- [x] Quant Lab — MPT optimizer, AI portfolio builder, SIP projection
- [x] Markets page, AI Insights, Landing page, Auth (JWT + Firebase)
- [x] Express backend — JWT, bcrypt, rate limiting, Helmet, Mongoose

---

## 7. Environment Variables

### Frontend — `frontend/.env`

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_FASTAPI_URL=http://localhost:8000
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

### FastAPI Backend — `backend/.env` (shared)

```env
FASTAPI_PORT=8000
ENVIRONMENT=development
FRONTEND_URL=http://localhost:9002
LOG_LEVEL=INFO
MONGODB_URI=mongodb://localhost:27017/finai_edge

GROWW_API_KEY=
GROWW_TOTP_SECRET=
GEMINI_API_KEY=
FINNHUB_API_KEY=
```

---

## 8. How to Run — Frontend

```bash
cd frontend
npm install
npm run dev         # http://localhost:9002
```

---

## 9. How to Run — Express Backend

```bash
cd backend
npm install
npm run dev         # http://localhost:8080
```

---

## 10. How to Run — FastAPI Backend

```bash
cd backend/fastapi_app
python -m venv .venv
source .venv/bin/activate    # macOS/Linux
# .venv\Scripts\activate     # Windows

pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Swagger UI: **http://localhost:8000/docs**

On startup, FastAPI will:
1. Connect to MongoDB
2. Warm the NSE universe cache
3. Check if the scanner cache is stale — if so, trigger a background scan
4. Start the APScheduler for 15:45 IST daily

---

## 11. API Reference

### System

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/v2/status` | Full system status |
| GET | `/api/v2/scanner/scan-status` | Last scan timestamp, symbols, elapsed |
| POST | `/api/v2/scanner/trigger-scan` | Manually trigger background scan |

### Scanner Endpoints

| Method | Endpoint | Key Parameters |
|---|---|---|
| GET | `/api/scanner/technical` | rsi_min/max, ema50_dist_min/max, ema200_dist_min/max, macd_min/max, volume_min/max |
| GET | `/api/scanner/volume` | limit |
| GET | `/api/scanner/volume-surge` | volume_ratio_min, price_min/max, avg_1d_min, win_rate_min, current_surge_only |
| GET | `/api/scanner/fvg` | score_min, fvg_status, fvg_strength, rsi_min/max, price_min/max |
| GET | `/api/scanner/momentum` | score_min, category, above_ema50, above_ema200, week52_dist_max, volume_ratio_min |
| GET | `/api/v2/scanner/smc` | category, min_score, event, direction |
| GET | `/api/v2/scanner/smc/stats` | Dashboard stats |
| GET | `/api/v2/scanner/smc/{symbol}/details` | Full SMC data for one symbol |

### Portfolio

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v2/portfolio/analyze-holdings` | Full pipeline — P&L, risk, health, insights |
| POST | `/api/v2/portfolio/analyze` | MPT optimization |
| POST | `/api/v2/portfolio/health` | Quick health check |
| POST | `/api/v2/portfolio/rebalance` | Rebalance suggestions |
| POST | `/api/v2/portfolio/save` | Save to MongoDB |
| GET  | `/api/v2/portfolio/saved` | List saved portfolios |

### Analytics

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v2/analytics/risk` | Risk level + concentration |
| POST | `/api/v2/analytics/sector` | Sector exposure |
| POST | `/api/v2/analytics/diversification` | Diversification score |
| POST | `/api/v2/analytics/concentration` | HHI + effective N |

### Market

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v2/market/quote/{symbol}` | Live quote (cached 5m) |
| GET | `/api/v2/market/search` | Instrument search |
| GET | `/api/v2/market/candles/{symbol}` | Historical OHLCV (cached 1h) |
| GET | `/api/v2/market/bulk-quotes` | Multi-symbol quotes (max 30) |
| GET | `/api/v2/market/provider-status` | Provider health + cache stats |

### AI

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v2/ai/generate-portfolio` | Gemini 2.5 Flash or rule-based portfolio |

### Watchlists

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v2/watchlists` | List all watchlists |
| POST | `/api/v2/watchlists` | Create watchlist |
| GET | `/api/v2/watchlists/{id}` | Full details with enriched stocks |
| PATCH | `/api/v2/watchlists/{id}` | Rename |
| DELETE | `/api/v2/watchlists/{id}` | Delete (preserves history) |
| POST | `/api/v2/watchlists/{id}/duplicate` | Duplicate |
| POST | `/api/v2/watchlists/{id}/stocks` | Add stock |
| DELETE | `/api/v2/watchlists/{id}/stocks/{symbol}` | Remove stock |
| GET | `/api/v2/watchlists/leaderboard` | All watchlists ranked by return |
| GET | `/api/v2/watchlists/source-performance` | Scanner performance ranking |

---

## 12. MongoDB Collections

| Collection | Description |
|---|---|
| `users` | User accounts (Express/Mongoose) |
| `portfolios` | Saved portfolio holdings |
| `screener_cache` | Technical indicators per symbol |
| `fvg_cache` | FVG zones per symbol |
| `volume_surge_cache` | Volume surge history per symbol |
| `momentum_cache` | Momentum scores per symbol |
| `smc_zones` | Individual SMC demand/supply zones |
| `smc_scanner_results` | Full SMC analysis per symbol |
| `scan_meta` | Scan run timestamps and stats |
| `watchlists` | Watchlist metadata |
| `watchlist_stocks` | Holdings per watchlist |
| `watchlist_history` | Removed stocks (preserved for analytics) |

---

## 13. Daily Scheduler

The scheduler runs in `backend/fastapi_app/schedulers/daily_refresh.py`. On invocation, it:
1. Runs the incremental downloader to pull missing candles into `/Users/akarshbhandari/FinTechAi/backend/data/Stock_Data.csv`.
2. Reads the database CSV file into memory.
3. Computes and upserts all screener caches (Technical, SMC, FVG, Volume Surge, Momentum) to MongoDB.

**Trigger times:**
- **On startup:** if last scan > 6h ago or never ran
- **Daily cron:** 15:45 IST (10:15 UTC) via APScheduler

**Manual trigger:**
```bash
curl -X POST http://localhost:8000/api/v2/scanner/trigger-scan
```

**Check status:**
```bash
curl http://localhost:8000/api/v2/scanner/scan-status
```

**Install APScheduler if missing:**
```bash
pip install apscheduler==3.10.4
```

The scheduler gracefully degrades if APScheduler is not installed (manual trigger only).

---

## 14. API Provider Setup

### yfinance (Default — no setup)

Always active. Use `.NS` suffix for NSE stocks (`RELIANCE.NS`). Use `^NSEI` for Nifty 50.

### Finnhub (Optional)

Sign up at https://finnhub.io. Add `FINNHUB_API_KEY` to `.env`. Becomes tertiary fallback.

---

## 15. Groww API Setup

> Requires paid Groww Trading API subscription (India only). App works fully without it.

1. Apply at https://developer.groww.in
2. Add to `.env`:
   ```env
   GROWW_API_KEY=your_api_key
   GROWW_TOTP_SECRET=your_totp_secret
   ```
Note: use `GROWW_TOTP_SECRET`, not `GROWW_API_SECRET`.

---

## 16. Gemini AI Setup

1. Get key at https://aistudio.google.com/app/apikey
2. Add `GEMINI_API_KEY=your_key` to `.env`
3. FastAPI uses `gemini-2.5-flash` with 30s timeout + rule-based fallback

---

## 17. MongoDB Setup

### Local

```bash
# macOS
brew services start mongodb-community

# Windows
net start MongoDB

# Linux
sudo systemctl start mongod
```

### Atlas

Set `MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/finai_edge`. MongoDB failure is non-fatal — analytics still work.

---

## 18. Trading Journal

Local, privacy-first. All data in browser localStorage.

- 9-step trade ticket: instrument, direction, entry, exit, setup, risk, execution, psychology, review
- Dashboard KPIs: P&L, win rate, profit factor, expectancy, avg R:R
- AI Journal Analyzer (Gemini batch review)
- Trader Score (execution, risk management, consistency, discipline)

---

## 19. Quant Lab Module

**Option A — Analyze Existing Portfolio:** MPT efficient frontier, Max-Sharpe, Min-Vol, Pearson correlation heatmap.

**Option B — AI Portfolio Builder:** Onboarding → Gemini 2.5 Flash allocation (or rule-based templates) → SIP FV projection.

---

## 20. SMC Scanner Deep Dive

The SMC scanner faithfully replicates LuxAlgo Pine Script logic in Python:

```
Input: 2-year daily OHLCV for one symbol

Step 1: detect_swing_highs_lows()
  → Rolling max/min with centre=True window (swing_len * 2 + 1)
  → SwingHigh / SwingLow boolean columns

Step 2: detect_structure_events()
  → Track last swing high / low prices
  → Close > last swing high → Bullish BOS (if trend=bullish) or CHoCH
  → Close < last swing low  → Bearish BOS (if trend=bearish) or CHoCH
  → Returns list of events with bar_idx, direction, event type

Step 3: extract_order_blocks()
  → For each BOS/CHoCH event, find the OB candle in the preceding leg
  → Bullish: candle with lowest Low (ATR-filtered)
  → Bearish: candle with highest High (ATR-filtered)
  → Post-event checks: invalidated if close 2% through zone
  → Deep failure check: 5% through zone → discard entirely
  → Track touch count since zone creation

Step 4: detect_equal_highs_lows()
  → Compare consecutive swing highs/lows
  → EQH if |high1 - high2| < 0.1 * ATR

Step 5: detect_liquidity_sweeps()
  → Bar wick through EQH/EQL level but closes back inside → sweep

Step 6: compute_premium_discount()
  → 1-year rolling swing range
  → Premium: top 25%, Discount: bottom 25%, Equilibrium: middle 50%

Step 7: compute_smc_score()
  → Active bullish OB: +25
  → BOS: +20, CHoCH: +15
  → Zone quality (touch_count ≤ 1): +15
  → EQL sweep: +15
  → Distance ≤ 2%: +15, ≤ 5%: +8
  → Volume ratio ≥ 2: +5
  → RSI 40–65: +5
```

---

## 21. FVG Scanner Deep Dive

```
Input: 2-year daily OHLCV for one symbol

For each triplet (C1, C2, C3):
  Bullish FVG:
    → C3.Low > C1.High  (strict ICT rule)
    → gap_size >= 0.3 * ATR(14)
    → Displacement: C2 body ratio (strong close in direction)
    → Post-formation: check if price ever closes 5% below gap_low → discard
    → Mitigation: how much of gap has price revisited
    → Touch count: bars where Low enters [gap_low, gap_high]

FVG Score (0–100):
  → gap_size_pct ≥ 1%:       +20
  → displacement ≥ 0.7:      +20
  → mitigation == 0%:        +20
  → touch_count == 0:        +15
  → distance ≤ 2%:           +15
  → above EMA200:            +5
  → RSI 40–65:               +5

Status:
  → Untouched: 0% mitigated, 0 touches
  → Touched: 0% mitigated, touched
  → PartiallyFilled: < 50% mitigated
  → MostlyFilled: ≥ 50% mitigated
```

---

## 22. Troubleshooting

### Scanner cache empty / no results

The cache needs to be populated first. Run: `curl -X POST http://localhost:8000/api/v2/scanner/trigger-scan` and wait. Check progress at `curl http://localhost:8000/api/v2/scanner/scan-status`. Full scan of 2,000+ symbols takes 10–30 minutes depending on yfinance rate limits.

### APScheduler not installed

```bash
pip install apscheduler==3.10.4
```

Without it, the daily cron won't run but manual trigger still works.

### FastAPI won't start

```bash
cd backend/fastapi_app
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --port 8000 --reload
```

### yfinance empty data

Yahoo Finance rate-limits. Wait 60s and retry. Use `.NS` suffix for NSE. Use `^NSEI` for Nifty50.

### MongoDB connection failed

Non-fatal — all analytics work without it. Only scan cache, portfolio save/load, and watchlist persistence fail.

### Screener shows "Database not connected"

MongoDB is not running or URI is wrong. Analytics endpoints still work — only screener/watchlist features need DB.

### TypeScript build errors in screener components

```bash
cd frontend
npm run typecheck
```

Most common: `StockData` type mismatch. Check `src/types/screener.ts`.

### Watchlist details slow

The enrichment pipeline calls yfinance for 1-year prices per symbol in the watchlist. For large watchlists (20+ stocks) this can take 10–20s. This is a known limitation. Caching watchlist details is on the roadmap.

---

## 23. Future Roadmap

### Phase 2
- MT5 integration — auto-fetch executed trades from MetaTrader 5
- Smart auto-journaling — AI detects and tags trades from broker feeds
- Real-time WebSocket price streaming
- CSV trade import for journals
- Advanced options analytics (Greeks, IV surface)
- Portfolio backtesting engine
- Alert system (price, P&L, rebalance triggers)
- Multi-currency support
- Export to CSV / Excel from screener

### Phase 3
- LangGraph-powered AI research agent
- RAG over company filings (SEBI EDGAR)
- Multi-agent portfolio committee simulation
- Vector DB for semantic stock search
- Automated tax-loss harvesting suggestions
- Demat account integration (Zerodha Kite API)
- AI Trade Assistant (real-time coaching)
- Custom Strategy Builder
