# 🌐 FinAI Edge

**FinAI Edge** is a high-performance, institutional-grade FinTech application providing AI-powered market insights, stock screening, quantitative portfolio analysis, and Modern Portfolio Theory-based optimization. Designed as a premium AI intelligence terminal for serious traders and quantitative analysts.

---

## 🚀 Project Overview

The platform delivers genuine **quantitative finance infrastructure**, featuring:
- **AI-Powered Market Intelligence:** Real-time news sentiment, sector heatmaps, and live indices.
- **Portfolio Optimizer:** MPT-based portfolio optimization using the Efficient Frontier, Sharpe ratio maximization, and VaR analytics.
- **Institutional Aesthetic:** Deep dark trading UI with glassmorphism and neon momentum highlights.
- **Market Breadth & Risk Analytics:** Custom gauges, sector heatmaps, and global indices tracking.
- **Top Movers & Breakout Detection:** Live momentum and volume tracking powered by Finnhub.

---

## 🏗️ Architecture & Tech Stack

This project operates on a **professional hybrid architecture** that mirrors real fintech infrastructure:

### What Node.js Handles
- Authentication (Firebase Auth + JWT verification)
- API Gateway, routing, and request validation
- User management and portfolio saving
- WebSocket / live data updates
- Frontend communication and caching layer
- Finnhub API proxy (keeps API keys server-side only)

### What Python Handles
- Portfolio optimization (Modern Portfolio Theory via SciPy)
- Covariance and correlation matrix computation
- Monte Carlo simulation (Efficient Frontier generation)
- Value at Risk (VaR) and Maximum Drawdown
- yfinance data fetching (no API key needed)
- Risk analytics, stress testing, and statistical analysis
- Reusable quant pipeline for future ML/AI models

> This separation is intentional and professional — all financial math stays in Python and is decoupled from the web layer, enabling future AI ranking and ML allocation models to reuse the same pipeline.

---

### Frontend Stack
- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS, custom glass-card design system
- **Charts:** Recharts (quant analytics), Lightweight Charts (candlesticks/trading)
- **Auth & DB:** Firebase Auth (Google OAuth) + Firestore
- **Infrastructure:** Vercel

### Backend Stack
- **Web Layer:** Node.js + Express.js
- **Quant Engine:** Python 3 (NumPy, Pandas, SciPy, yfinance)
- **Market Data:** Finnhub REST API (Node proxy)
- **Caching:** In-memory 10-minute TTL cache for portfolio computations
- **Infrastructure:** Render

---

## 📂 Project Structure

```text
FinTechAI-AntiGravity/
├── frontend/
│   └── src/
│       ├── app/(app)/
│       │   ├── markets/           # Markets Overview page
│       │   └── quant-lab/
│       │       └── optimizer/     # Portfolio Optimizer page
│       ├── components/
│       │   ├── layout/            # Navbar, sidebar, nav-config
│       │   └── markets/           # Market widgets (strip, movers, heatmap)
│       ├── hooks/                 # useOnlineStatus
│       ├── context/               # Auth context (Firebase)
│       └── firebase.ts            # Firebase init (long-polling fix for Next.js)
│
├── backend/
│   ├── routes/
│   │   ├── markets.js             # /api/markets/* (Finnhub proxy)
│   │   └── portfolio.js           # /api/portfolio/* (quant engine)
│   ├── services/
│   │   ├── marketService.js       # Finnhub data aggregator + cache
│   │   └── portfolioService.js    # Python engine bridge + cache
│   ├── scripts/
│   │   └── portfolio_engine.py    # Core Python quantitative engine
│   ├── requirements.txt           # Python dependencies
│   ├── server.js                  # Express entry point
│   └── .env                       # Secrets (Finnhub key, Firebase Admin)
└── README.md
```

---

## 📊 Portfolio Optimizer — Quant Lab

The Portfolio Optimizer is an institutional-grade quantitative tool built into the Quant Lab module.

### Data Science Concepts Used

| Concept | Implementation |
|---|---|
| **Modern Portfolio Theory** | Mean-variance optimization via SciPy `minimize` |
| **Efficient Frontier** | Monte Carlo simulation (3000+ portfolios) |
| **Sharpe Ratio** | `(return - risk_free) / volatility` |
| **Maximum Drawdown** | Peak-to-trough on cumulative portfolio return |
| **Value at Risk (VaR)** | Historical simulation (non-parametric) at 95% & 99% CI |
| **Correlation Matrix** | Pearson correlation on log daily returns |
| **Diversification Score** | Ratio of weighted avg vol to portfolio vol |
| **Log Returns** | `ln(P_t / P_{t-1})` — time-additive, more suitable for portfolio math |

### Data Source: yfinance
- Historical adjusted close prices for Indian equities (`.NS` suffix for NSE)
- No API key required
- 2-year default lookback period (configurable)
- Fully reusable by future ML/AI allocation models

### Architecture Decision
The Python engine (`portfolio_engine.py`) is designed as a **standalone, decoupled module**:
- Takes plain JSON input from Node.js via `sys.argv`
- Outputs plain JSON to stdout
- Has no dependency on Express, Next.js, or Firebase
- Can be imported directly by future ML training scripts or reinforcement learning reward functions

---

## 🛠️ How to Run Locally

### Prerequisites
- Node.js 18+
- Python 3.9+
- pip

### 1. Install Python Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Backend Setup (Express + Python Engine)
Create `backend/.env`:
```env
FINNHUB_API_KEY=your_actual_finnhub_api_key_here
PORT=8080
NODE_ENV=development
FRONTEND_URL=http://localhost:9002
```
Start the backend:
```bash
cd backend
npm install
npm run dev
```

### 3. Frontend Setup (Next.js 15)
Create `frontend/.env`:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```
Start the frontend:
```bash
cd frontend
npm install
npm run dev
```
App runs at **http://localhost:9002**

> **Note:** Turbopack is disabled (`next dev` without `--turbopack`) to prevent Firebase WebSocket teardowns. Firestore uses HTTP long-polling instead.

---

## 🚨 Known Issues & Fixes

**Firebase "client is offline" Error**
- **Cause:** Next.js Turbopack aggressively tears down WebSockets during HMR, disconnecting Firebase Firestore.
- **Fix:** Turbopack is disabled. `initializeFirestore` forces `experimentalForceLongPolling: true`. The `OfflineBanner` component actively monitors and auto-reconnects.

**Duplicate Firebase Initialization**
- **Cause:** Empty `firebase.js` file shadowing `firebase.ts`.
- **Fix:** Deleted the empty file. `firebase.ts` now uses `!getApps().length ? initializeApp() : getApp()` pattern.

---

## 🔮 Future Roadmap

- [ ] **AI Allocation Model:** Use the Python returns/covariance pipeline to train an ML asset ranking model
- [ ] **Reinforcement Learning:** Portfolio rebalancing agent using the quant engine as environment
- [ ] **Stress Testing:** Market crash, sector selloff, and interest rate spike scenarios
- [ ] **Portfolio Saving:** Store and compare multiple portfolio snapshots in Firestore
- [ ] **Live Rebalancing Alerts:** Notify users when portfolio drifts from optimal weights
- [ ] **Factor Analysis:** Fama-French 3-factor model integration
- [ ] **Options Analytics:** Black-Scholes pricing under Quant Lab
