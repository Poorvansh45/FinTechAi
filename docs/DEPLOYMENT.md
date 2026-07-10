# Deployment Guide

FinAI Edge is deployed as **three independent services**:

| Service | Runtime | Host | Port | Responsibility |
|---------|---------|------|------|----------------|
| `frontend` | Next.js 15 | Vercel (recommended) | build-time | UI + Next API routes (`/api/copilot`, `/api/journal`, `/api/markets`) |
| `finai-edge-backend` | Node/Express | Render | `$PORT` (8080) | Auth, JWT, sessions, MongoDB/Mongoose |
| `finai-edge-fastapi` | Python/FastAPI | Render | `$PORT` (injected) | AI, analytics, scanners, SMC/FVG, watchlists (`/api/v2/*`, `/api/scanner/*`) |

The Node and FastAPI services are **independent** (Node does not proxy to FastAPI). The frontend
talks to both directly via `NEXT_PUBLIC_API_URL` (Node) and `NEXT_PUBLIC_FASTAPI_URL` (FastAPI).

Both backend services are defined in [`render.yaml`](../render.yaml) as a Render Blueprint.

---

## Environment variables

### Frontend (Vercel)

> ⚠️ `NEXT_PUBLIC_*` variables are inlined at **build time** by Next.js. They must be set on the
> frontend host **before the build runs** — setting them only at runtime has no effect.

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `NEXT_PUBLIC_API_URL` | ✅ | `https://finai-edge-backend.onrender.com` | Express backend base URL |
| `NEXT_PUBLIC_FASTAPI_URL` | ✅ | `https://finai-edge-fastapi.onrender.com` | FastAPI backend base URL |
| `GOOGLE_API_KEY` / `GEMINI_API_KEY` | ⬜ | — | Server-side Gemini key for Next API routes (`/api/copilot`, `/api/journal`) |
| `NEXT_PUBLIC_FIREBASE_*` | ⬜ | — | Firebase client config (currently unused by live auth; retained) |

### Node / Express backend (`finai-edge-backend`)

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `NODE_ENV` | ✅ | `production` | Set in `render.yaml` |
| `PORT` | ✅ | `8080` | Set in `render.yaml` |
| `FRONTEND_URL` | ✅ | `https://finai-edge.vercel.app` | CORS allow-list origin (`sync:false`) |
| `MONGODB_URI` | ✅ | `mongodb+srv://…/finai_edge` | MongoDB Atlas. Code also accepts `MONGO_URI` alias |
| `JWT_SECRET` | ✅ | 32+ char random string | **Required in production** — do not use the dev default |
| `JWT_EXPIRE` | ⬜ | `30d` | Token lifetime (defaults to `30d`) |
| `FINNHUB_API_KEY` | ⬜ | — | Optional market data |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | ⬜ | — | Retained; unused by current JWT auth |

### FastAPI backend (`finai-edge-fastapi`)

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `PYTHON_VERSION` | ✅ | `3.11.9` | Pinned in `render.yaml`; numpy/pandas need 3.11–3.12 |
| `ENVIRONMENT` | ✅ | `production` | Set in `render.yaml` |
| `LOG_LEVEL` | ⬜ | `INFO` | Set in `render.yaml` |
| `FRONTEND_URL` | ✅ | `https://finai-edge.vercel.app` | Added to FastAPI CORS allow-list (`sync:false`) |
| `MONGODB_URI` | ✅ | `mongodb+srv://…/finai_edge` | Same Atlas cluster as the Node service |
| `GEMINI_API_KEY` | ⬜ | — | AI portfolio generation (rule-based fallback if absent) |
| `GROWW_API_KEY` + `GROWW_TOTP_SECRET` | ⬜ | — | Primary India market data (falls back to yfinance) |
| `FINNHUB_API_KEY` | ⬜ | — | Tertiary market-data fallback |

> On Render the `../.env` file referenced by `config.py` does not exist; pydantic-settings reads the
> injected environment variables directly, so no code change is needed.

---

## Deploy steps

1. **Backends (Render Blueprint):** connect the repo to Render → it reads `render.yaml` and creates
   both `finai-edge-backend` and `finai-edge-fastapi`. Fill in every `sync:false` secret in the
   dashboard for **each** service (note `MONGODB_URI`, `FRONTEND_URL` are needed by both).
2. **Frontend (Vercel):** set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_FASTAPI_URL` to the two Render
   URLs from step 1, then deploy (build-time inlining).
3. Set the Node/FastAPI `FRONTEND_URL` to the Vercel URL from step 2 so CORS allows the frontend.

## Verification

| Check | Command / URL | Expected |
|-------|---------------|----------|
| Node health | `GET https://finai-edge-backend.onrender.com/health` | `{"status":"healthy","db":"connected"}` |
| FastAPI health | `GET https://finai-edge-fastapi.onrender.com/health` | `{"status":"healthy","service":"finai-edge-fastapi"}` |
| FastAPI status | `GET https://finai-edge-fastapi.onrender.com/api/v2/status` | `mongodb.connected: true`, provider status |
| Frontend → FastAPI | Open a Screener page in the deployed frontend | Live data loads (no `localhost:8000` calls in Network tab) |
| CORS | Frontend network requests to both backends | No CORS errors |
