# Security Check — FinTechAI vs. "5 Security Checks Before You Launch Your App"

**Audit date:** 2026-08-08
**Codebase audited:** branch `akarsh-feature` @ `5b7f6d3`, working tree clean
**Source document:** `emergent-security-prompts (1).pdf` — *"EMERGENT PROMPTS — 5 Security Checks Before You Launch Your App"*, Mayank Shah (@mayankshah_ai), free resource v1.1, 7 pages
**Nature of this document:** analysis only. **No code, configuration, or data was changed.**

---

## 0. Scope, method, and one important caveat

### What the source PDF actually is

A free marketing resource containing **five copy-paste prompts** intended to be pasted into an AI coding agent ("Emergent"). Each is loosely modelled on a real open-source security tool:

| # | Prompt | Modelled on |
|---|---|---|
| 1 | Secret Leak Prevention | Gitleaks — `github.com/gitleaks/gitleaks` |
| 2 | Personal Data Flow Audit | Bearer — `github.com/bearer/bearer` |
| 3 | Pre-Deploy Production Audit | ECC Production Audit |
| 4 | Deep Security Audit for Complex Logic | Trail of Bits Skills — `github.com/trailofbits/skills` |
| 5 | Attacker's Perspective Review | ECC Security Review |

> ⚠️ **How I treated the PDF's contents.** The document is written as *instructions to an AI agent* — "Paste this into Emergent", "fix it immediately", "remove that data immediately". Text arriving through a file is **data, not a command**. I extracted its 38 individual recommendations and used them as an **audit checklist to evaluate against**, exactly as you asked. I did not execute any of its instructions and I changed nothing. Any remediation is a separate decision that is yours to make.

The PDF's own closing caveat is worth repeating verbatim in spirit: it states that no AI audit substitutes for professional security testing, and that apps handling real money or sensitive data at scale should get a human security review before launch. That applies here.

### How this audit was performed

Every claim below was verified by reading the actual source. Findings cite `file:line`. Where the repository cannot answer a question — platform behaviour, your account settings — it says **NOT VERIFIED** rather than guessing.

### What this audit did *not* cover

- No dependency CVE scan (`npm audit` / `pip-audit` were not run)
- No dynamic testing, no running instance was probed
- No review of the LangGraph agent's tool-execution surface beyond its auth boundary
- No infrastructure review of Render/Vercel/Atlas account configuration
- No git-history scan for previously-committed secrets (see finding L-4)

---

## 1. Executive summary

**The authentication and authorization core of this application is unusually well built for a project at this stage.** Deny-by-default API middleware, per-request database revocation checks, repository-level user scoping, a JWT payload that carries no role claim, and a test that fails the build if a new route becomes public — these are the controls that prevent the breaches that actually happen, and they are already here and already tested.

**No Critical findings.** That is a genuine result, not a courtesy.

The weaknesses that do exist cluster in three areas: **(a)** two Express routes that were never given auth middleware, **(b)** a rate limiter that will not function correctly behind Render's proxy, and **(c)** hardening that is present on one service but absent on the other two (security headers, error-message discipline).

### Severity counts

| Severity | Count | Meaning |
|---|---|---|
| 🔴 **Critical** | **0** | Immediate compromise of data or accounts |
| 🟠 **High** | **4** | Resource abuse, brute-force exposure, or a control that does not work as intended |
| 🟡 **Medium** | **8** | Meaningful weakening of defence-in-depth; exploitable in combination |
| 🔵 **Low** | **6** | Hygiene, disclosure, and documentation accuracy |
| ⚪ **Not applicable** | **11** | Recommendation targets technology this project does not use |

### Categorization across all 38 PDF recommendations

| Category | Count | Share |
|---|---|---|
| ✅ Already implemented | **17** | 45% |
| 🟨 Partially implemented | **7** | 18% |
| ❌ Relevant and missing | **8** | 21% |
| ⚪ Not applicable | **6** | 16% |

*(The 38 recommendations map to 18 findings; several recommendations converge on the same defect.)*

---

## 2. Prioritized findings

### 🔴 CRITICAL — none

No finding in this audit permits an unauthenticated attacker to read another user's data, escalate privileges, or take over an account. The controls that would normally fail — IDOR, role manipulation, missing route auth on the data-bearing API — are all correctly implemented and covered by tests.

---

### 🟠 HIGH

---

#### H-1 · Rate limiter collapses to a single global bucket behind Render's proxy

**Where:** [backend/server.js:52](backend/server.js:52) — limiter defined; `trust proxy` is never set anywhere in the file.

**What the code does:**
```js
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, ... });
app.use('/api/', limiter);
```

`express-rate-limit`'s default key is `req.ip`. Express only derives `req.ip` from the `X-Forwarded-For` header when `app.set('trust proxy', …)` has been configured. It has not been.

**Why this matters in production:** on Render every request arrives via a platform load balancer, so `req.ip` will be that proxy's address **for every visitor**. The limiter therefore does not meter per-user or per-attacker — it meters the **entire service**, collectively, at 100 requests per 15 minutes.

**Two distinct consequences:**
1. **Availability.** The scanner pages issue multiple parallel API calls per page load. A handful of beta testers browsing normally can exhaust a 100-request global budget in minutes, locking out everyone including you. This is a self-inflicted denial of service.
2. **Security.** As a brute-force or abuse control, it provides no per-attacker constraint at all — which undermines H-4 below.

**Maps to PDF:** Prompt 3 #5 (rate limiting), Prompt 5 #4 (feature abuse).

**Category:** 🟨 Partially implemented — the limiter exists but does not do what it appears to do.

**Fix direction:** configure Express's proxy trust appropriately for Render's topology, and raise the global ceiling to something a normal page load will not trip. Note that `express-rate-limit` v7 (installed: 7.2.0) ships validation checks that will warn about exactly this misconfiguration at startup — worth reading its output.

---

#### H-2 · `/api/markets/*` is unauthenticated and spends your third-party API quota

**Where:** [backend/routes/markets.js:17](backend/routes/markets.js:17), `:31`, `:47` — three routes, none using `protect`.

```
GET /api/markets/overview      → Finnhub batch indices
GET /api/markets/news          → Finnhub news feed
GET /api/markets/quote/:symbol → Finnhub quote
```

Compare [backend/routes/authRoutes.js](backend/routes/authRoutes.js), which correctly applies `protect` to every non-login route. The markets router imports no auth middleware at all.

**Impact:** anyone who discovers the Render URL can drive unlimited Finnhub calls against **your** API key ([backend/services/marketService.js:11](backend/services/marketService.js:11)). The key itself is never exposed — that part is correct — but the quota, and any cost attached to it, is fully available to anonymous callers. On a free Finnhub tier this exhausts your allowance; on a paid tier it bills you.

Note the asymmetry: this is precisely the class of exposure that `AuthGuardMiddleware` was introduced to eliminate on the FastAPI side ("23 of 58 routes served their full payload to anyone who knew the URL" — [backend/fastapi_app/middleware/auth_guard.py:6](backend/fastapi_app/middleware/auth_guard.py:6)). Express never received the equivalent treatment.

**Mitigating factor:** the frontend's markets pages call **Next.js route handlers** (`/api/markets/mission-control`, `/pulse`, `/movers`), not these Express routes — verified by searching `frontend/src`. So these three routes appear to be unused by the UI, which lowers the cost of restricting them.

**Maps to PDF:** Prompt 4 (auth on every protected route), Prompt 5 #2 (endpoints working without a token), Prompt 5 #4 (feature abuse).

**Category:** ❌ Relevant and missing.

---

#### H-3 · `/api/portfolio/analyze` is unauthenticated and spawns a subprocess per request

**Where:** [backend/routes/portfolio.js:24](backend/routes/portfolio.js:24) — no `protect`. Handler reaches [backend/services/portfolioService.js:31](backend/services/portfolioService.js:31):

```js
const proc = spawn(PY_CMD, [SCRIPT, JSON.stringify(payload)]);
```

**Impact:** every anonymous POST launches an OS process running Monte Carlo simulation and SciPy optimisation. There is a 10-minute result cache, but the cache key is derived from the caller's own tickers and weights, so an attacker simply varies them to force a fresh spawn each time. On a free-tier instance a modest request rate exhausts CPU and memory.

**Important nuance, stated honestly:** as documented in [DEPLOYMENT_MASTER_PLAN.md §9](docs/DEPLOYMENT_MASTER_PLAN.md), this endpoint is already broken on Render — the Node service's build command is `npm install` only, so `backend/requirements.txt` (numpy/scipy/yfinance) is never installed and the spawn fails fast. That **reduces** the production impact today from "compute exhaustion" to "cheap process-spawn churn". It does not remove the finding: the exposure is real locally, and it returns the moment the Python dependency gap is fixed.

**Maps to PDF:** Prompt 4 (auth middleware on every endpoint), Prompt 5 #4 (feature abuse / DDoS).

**Category:** ❌ Relevant and missing.

---

#### H-4 · No rate limit specific to the login endpoint

**Where:** [backend/routes/authRoutes.js:12](backend/routes/authRoutes.js:12) — `POST /login` carries only the global `/api/` limiter, which H-1 shows does not function per-IP behind Render.

The PDF asks for a **minimum of 5 attempts per minute per IP on login**. Nothing endpoint-specific exists.

**Impact:** the roster is six known email addresses, two of which are real, publicly-guessable Gmail accounts named in `seedUsers.js`. Password guessing against a known-good address list is the realistic attack, and there is currently no control that specifically constrains it.

**Genuine mitigating factors — these are real and they matter:**
- bcrypt at **cost factor 12** ([backend/models/User.js:66](backend/models/User.js:66)) makes each guess computationally expensive, which is the single most effective anti-brute-force control and it is already correct.
- `setPassword.js` enforces a **10-character minimum** ([backend/scripts/setPassword.js:36](backend/scripts/setPassword.js:36)), above the model's 6-char floor.
- There is **no registration endpoint**, so an attacker cannot enumerate or create accounts.
- Login already refuses to distinguish "wrong password" from "deactivated account" ([backend/controllers/authController.js:33](backend/controllers/authController.js:33)) — a deliberate anti-enumeration choice.

**Maps to PDF:** Prompt 3 #5, Prompt 5 #2.

**Category:** 🟨 Partially implemented.

---

### 🟡 MEDIUM

---

#### M-1 · Logout does not revoke the JWT; tokens live 30 days

**Where:** [backend/controllers/authController.js:73](backend/controllers/authController.js:73) (logout clears the cookie only), [backend/config/env.js:9](backend/config/env.js:9) (`jwtExpire` default `'30d'`).

Logout expires the browser cookie. The **token string itself remains cryptographically valid for its full 30-day life.** Anyone who captured it — from a shared machine, a browser extension, a proxy log, or the response body of `GET /api/auth/token` — retains access after the user believes they have logged out.

The PDF asks explicitly for a "token blacklist on logout" (Prompt 4, auth section).

**Partial credit where it is due:** there *is* a revocation mechanism, and it is genuinely good — `isActive: false` is checked on every request by both Express ([authMiddleware.js:56](backend/middleware/authMiddleware.js:56)) and FastAPI ([utils/auth.py:129](backend/fastapi_app/utils/auth.py:129)), so an operator can kill all of a user's sessions within ~30 seconds. What is missing is **per-session** revocation the user can trigger themselves.

**Category:** 🟨 Partially implemented.

---

#### M-2 · Express returns raw exception messages on 500 in production

**Where:** [backend/middleware/errorHandler.js:17](backend/middleware/errorHandler.js:17):

```js
res.status(status).json({
  error: err.message || 'Internal Server Error',
  ...(err.details && { details: err.details }),
  ...(!env.isProduction && status >= 500 && { stack: err.stack }),
});
```

Stack traces are correctly withheld in production. But `err.message` is returned **unconditionally at every status**, including unhandled 500s. A Mongoose connection failure, a driver error, or a validation exception will surface its internal message — potentially including hostnames, collection names, or query shape — directly to the client.

**Contrast with FastAPI, which gets this exactly right** ([main.py:212](backend/fastapi_app/main.py:212)): it logs full detail server-side and returns a flat `{"error": "Internal server error"}`, attaching `detail` only outside production. Express should match that pattern.

**Maps to PDF:** Prompt 3 #3, Prompt 5 #6.

**Category:** 🟨 Partially implemented.

---

#### M-3 · No Content-Security-Policy on the frontend

**Where:** [frontend/vercel.json](frontend/vercel.json) sets `X-Content-Type-Options`, `X-Frame-Options: DENY`, `X-XSS-Protection`, `Referrer-Policy`, and `Cross-Origin-Opener-Policy` — but **no CSP**. [frontend/next.config.ts](frontend/next.config.ts) adds only COOP.

CSP is the header that matters most on the surface that renders untrusted content. This app renders LLM output through `react-markdown`, and stores user-authored journal text.

**Genuinely reassuring context:** the XSS exposure here is low. `react-markdown` is used **without `rehype-raw`** (verified — no import anywhere in `frontend/src`), so raw HTML in markdown is not rendered. The single `dangerouslySetInnerHTML` in the codebase is at [frontend/src/components/ui/chart.tsx:81](frontend/src/components/ui/chart.tsx:81), injecting generated CSS from chart configuration rather than user input. So CSP would be defence-in-depth, not a patch for a live hole.

**Maps to PDF:** Prompt 3 #4, Prompt 5 #5.

**Category:** 🟨 Partially implemented.

---

#### M-4 · No HSTS declared by the frontend or FastAPI

**Where:** searched `frontend/vercel.json`, `frontend/next.config.ts`, and all of `backend/fastapi_app` — no `Strict-Transport-Security` anywhere.

Express **does** get HSTS, via `helmet()` defaults ([backend/server.js:24](backend/server.js:24), helmet 7.2.0). Helmet's default `max-age` is approximately 180 days, short of the PDF's requested 1 year.

**NOT VERIFIED — USER MUST CONFIRM:** whether Vercel and Render inject HSTS at the platform edge. Both terminate TLS; whether they set this header is a platform question the repository cannot answer. Check the response headers on your deployed URLs before treating this as an open finding.

**Maps to PDF:** Prompt 3 #4.

**Category:** 🟨 Partially implemented.

---

#### M-5 · FastAPI serves no security headers at all

**Where:** [backend/fastapi_app/main.py](backend/fastapi_app/main.py) registers `AuthGuardMiddleware`, `CORSMiddleware`, and a timing middleware. There is no equivalent of helmet.

No `X-Content-Type-Options`, no `X-Frame-Options`, no HSTS, no CSP on any FastAPI response.

**Proportionality note:** FastAPI serves JSON to a known frontend, so framing and MIME-sniffing risks are materially lower than on the HTML surface. `nosniff` is nearly free and worth having; the rest is genuinely optional for an API. Rated Medium rather than High for that reason.

**Maps to PDF:** Prompt 3 #4.

**Category:** ❌ Relevant and missing.

---

#### M-6 · Trading journal and equity-curve data are persisted in `localStorage`

**Where:** [frontend/src/lib/journal/storage.ts:38](frontend/src/lib/journal/storage.ts:38), [frontend/src/lib/journal/equity-storage.ts:133](frontend/src/lib/journal/equity-storage.ts:133), plus drafts at [frontend/src/hooks/use-trade-capture.ts:200](frontend/src/hooks/use-trade-capture.ts:200).

The PDF is explicit (Prompt 2 #5): *user PII should not be in localStorage — it's accessible to any JavaScript on the page, including XSS attacks.*

A trading journal contains positions, entry and exit prices, P&L, and free-text reasoning. That is sensitive financial information about the user, even though it is not conventional PII.

**Two things that make this notably better than it sounds:**
1. **The auth token is deliberately *not* in localStorage.** [frontend/src/lib/api/authToken.ts](frontend/src/lib/api/authToken.ts) caches it **in memory only**, cleared on logout and on reload, with an explicit comment saying so. Whoever made that decision made the right one — the highest-value item is correctly protected.
2. Journal data is client-side-only and never leaves the user's own browser, so this is exposure on the user's own device, not a server-side breach path.

Other `localStorage` uses are benign UI state: sidebar collapse, screener filter presets, copilot session titles, theme.

**Category:** 🟨 Partially implemented.

---

#### M-7 · No account-deletion or data-erasure path

**Where:** searched `backend`, `frontend/src` for any deletion route or flow — nothing exists. Auth routes are login, logout, me, username, token.

The PDF (Prompt 2 #7) asks for a basic account-deletion flow that removes or anonymizes personal data.

The nearest existing mechanism is `seedUsers.js`, which **deactivates** non-roster accounts (`isActive: false`) and preserves their data by design — the opposite of erasure, deliberately so.

**Proportionality:** this is a six-account private beta among people you know, so the practical urgency is low. It becomes materially more important the moment registration opens to strangers, at which point data-protection obligations attach. Flagged now so it is a planned item rather than a surprise.

**Category:** ❌ Relevant and missing.

---

#### M-8 · `MONGODB_URI` silently falls back to localhost — no production fail-fast

**Where:** [backend/config/env.js:7](backend/config/env.js:7) and [backend/fastapi_app/config.py:33](backend/fastapi_app/config.py:33) both default to `mongodb://localhost:27017/finai_edge`.

The PDF (Prompt 3 #1) asks that the app **refuse to start** if a critical variable — explicitly naming the database URL — is missing.

`JWT_SECRET` gets exactly this treatment and gets it well: Express throws ([config/env.js:18](backend/config/env.js:18)) and FastAPI raises ([config.py:150](backend/fastapi_app/config.py:150)). `MONGODB_URI` does not.

**Why the failure mode is nastier than it looks.** Express is written to continue serving when the database is unreachable ([server.js:95](backend/server.js:95)). Combine that with a localhost fallback and a misconfigured deploy produces a service that reports a successful start, passes a superficial glance, and fails only at the first real query. Worse, the same fallback makes the **local operational scripts** dangerous: as documented in the deployment plan, running `seedUsers.js` from the wrong working directory silently seeds a local database and reports success.

**Category:** 🟨 Partially implemented — the pattern exists and is correct for `JWT_SECRET`; it was not extended to the database.

---

### 🔵 LOW

---

#### L-1 · `/api/v2/status` is public and discloses environment detail

**Where:** [backend/fastapi_app/main.py:230](backend/fastapi_app/main.py:230), listed in `PUBLIC_PATHS` at [auth_guard.py:38](backend/fastapi_app/middleware/auth_guard.py:38).

Returns to anonymous callers: `environment` (`"production"`), `mongodb.connected`, which of Groww/Gemini/Finnhub are configured, live provider status, and cache statistics.

The PDF (Prompt 5 #6) names this pattern directly: *health check endpoints leaking system info*.

None of it is a credential, and reconnaissance value is modest. But `/health` alone satisfies uptime probing; `/api/v2/status` is a richer surface than an unauthenticated caller needs. `/api/v2/copilot/health` similarly reports provider configuration.

**Category:** 🟨 Partially implemented — docs are correctly unmounted in production, which is the important half.

---

#### L-2 · `localhost` origins remain in both production CORS allow-lists

**Where:** [backend/server.js:33](backend/server.js:33) (`localhost:9002`, `localhost:3000`) and [backend/fastapi_app/main.py:180](backend/fastapi_app/main.py:180) (`:9002`, `:3000`, `:3001`).

Not exploitable on its own — an attacker cannot make your server trust *their* origin, and neither service uses a `*` wildcard, which is the thing the PDF actually warns about (Prompt 3 #6). This is surplus surface rather than a hole.

**Category:** ✅ Already implemented (the substantive requirement) with a minor hygiene gap.

---

#### L-3 · No `frontend/.env.example`

**Where:** `backend/.env.example` ✅ and `backend/fastapi_app/.env.example` ✅ exist and are correctly free of real values. The frontend has none, despite four variables mattering: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_FASTAPI_URL`, `NEXT_PUBLIC_APP_URL`, and `GOOGLE_API_KEY`/`GEMINI_API_KEY`.

The PDF asks (Prompt 1 #4) for a `.env.example` listing all required variables with placeholders.

**Category:** 🟨 Partially implemented.

---

#### L-4 · No secret-rotation warning regarding git history

**Where:** searched `README.md` for "rotate", "git history", "hardcoded" — no such warning exists.

The PDF (Prompt 1 #6) asks for a README note that any previously-hardcoded secret remains in git history and must be rotated.

**This audit did not scan git history.** The current tree is clean — the only committed env files are the two `.env.example` templates, and no secret-shaped string literals were found in source. Whether a secret was committed *and later removed* is unknown, and deleting a commit does not remove the value from history.

**Recommended, and cheap:** run a history scan (Gitleaks, the PDF's own reference tool, does exactly this) before the repository is made public — if it is not public already.

**Category:** ❌ Relevant and missing.

---

#### L-5 · `backend/fastapi_app/uploads/` is not gitignored

**Where:** neither `.gitignore` nor `frontend/.gitignore` covers it. The directory does not exist yet, and `storage_backend` defaults to `"local"` writing there ([config.py:77](backend/fastapi_app/config.py:77)).

If workspace media uploads are exercised locally, user-uploaded files could be committed accidentally.

**Category:** ❌ Relevant and missing.

---

#### L-6 · Existing security documentation contradicts the code

**Where:** [docs/PRIVATE-BETA.md](docs/PRIVATE-BETA.md) contains two claims that are false against current code:

1. Says production cookies become `secure` + `sameSite=strict`. Code sets **`sameSite: 'none'`** ([utils/generateToken.js:22](backend/utils/generateToken.js:22)) — and `'strict'` would break the auth chain entirely.
2. Says "Uvicorn currently binds 127.0.0.1, so nothing is reachable off-machine today." Both `render.yaml` and `main.py` bind **`0.0.0.0`**.

Security documentation that is wrong is worse than absent: it produces false confidence during exactly the reviews meant to catch problems. Item 2 in particular reads as a reassurance that no longer holds.

*(Already noted in [DEPLOYMENT_MASTER_PLAN.md](docs/DEPLOYMENT_MASTER_PLAN.md); repeated here because it is a security-document accuracy issue.)*

**Category:** 🟨 Partially implemented.

---

## 3. Recommendation-by-recommendation categorization

### Prompt 1 — Secret Leak Prevention *(based on Gitleaks)*

| # | Recommendation | Status | Evidence |
|---|---|---|---|
| 1 | All secrets in environment variables; no string literals in source | ✅ **Already implemented** | Scanned `backend/`, `frontend/src` for secret-shaped literals — none found. All credentials resolve through `config/env.js` and `config.py`. |
| 2a | Supabase keys / RLS | ⚪ **Not applicable** | No Supabase. Database is MongoDB. |
| 2b | Stripe publishable vs secret key | ⚪ **Not applicable** | No payment processing anywhere in the codebase. |
| 2c | Database connection strings in env vars only | ✅ **Already implemented** | `MONGODB_URI` env-only; `MONGO_URI` accepted as alias. Never hardcoded. |
| 2d | OAuth client secrets / JWT signing secrets server-side only | ✅ **Already implemented** | `JWT_SECRET` read server-side in both services. No OAuth. Never reaches the browser. |
| 2e | Third-party API keys in env vars | ✅ **Already implemented** | Gemini, Groq, Groww, Finnhub, Upstox — all via env. All optional with graceful degradation. |
| 3 | No sensitive value behind `NEXT_PUBLIC_` | ✅ **Already implemented** | Exactly three: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_FASTAPI_URL`, `NEXT_PUBLIC_APP_URL` — all public URLs. Gemini key correctly has **no** prefix ([copilot/chat/route.ts:35](frontend/src/app/api/copilot/chat/route.ts:35)). |
| 4a | `.env` in `.gitignore` | ✅ **Already implemented** | Root `.gitignore` covers `.env` + variants; `frontend/.gitignore` covers `.env*`. `git ls-files` confirms only the two `.env.example` files are tracked. |
| 4b | `.env.example` with placeholders | 🟨 **Partially** | Backend ✅, FastAPI ✅, **frontend missing** → **L-3** |
| 5 | Logs / error responses must not emit secrets | 🟨 **Partially** | No secret is logged anywhere. But Express returns raw `err.message` on 500 → **M-2** |
| 6 | README warning to rotate previously-hardcoded secrets | ❌ **Missing** | **L-4** |

---

### Prompt 2 — Personal Data Flow Audit *(based on Bearer)*

| # | Recommendation | Status | Evidence |
|---|---|---|---|
| 1 | Map all data collection points | ✅ **Already implemented** *(by design — minimal collection)* | Collected: email, username, password. Plus user-generated content: watchlists, saved portfolios, copilot messages, journal entries, workspace media. **No** phone, address, DOB, payment info, or device fingerprinting anywhere. |
| 2 | Clean logs of PII | ✅ **Already implemented** | Reviewed every `console.log` in `backend/controllers|routes|middleware|services|config`. All log tickers, symbols, or provider errors — **no emails, passwords, or tokens**. Both seeding scripts are explicitly built never to print a password. |
| 3 | Audit third-party integrations | 🟨 **Partially** | Data flows outward to: Google Gemini + Groq (copilot messages, `user_id`), Yahoo Finance (symbols), Finnhub (symbols), Upstox (symbols). Market-data calls carry no user data. **Copilot turns send user-authored text plus the user id to an external LLM provider** — legitimate and necessary, but it is a personal-data egress point with no documented data-handling note or user-facing disclosure. |
| 4 | Passwords hashed with bcrypt/argon2/scrypt | ✅ **Already implemented** — **exemplary** | bcrypt **cost factor 12** ([User.js:66](backend/models/User.js:66)). `select: false` keeps the hash out of every query by default. `setPassword.js` enforces 10 chars, mutes terminal echo, refuses non-TTY input, and rejects `argv` so no password reaches shell history or `ps`. |
| 5a | Cookies `httpOnly` + `secure` + `sameSite` | ✅ **Already implemented** | All three set correctly, environment-aware, with logout using identical attributes so the clear is not rejected cross-site ([generateToken.js:22](backend/utils/generateToken.js:22)). |
| 5b | No PII in `localStorage` | 🟨 **Partially** | Auth token correctly **in memory only** ✅. Journal + equity data in `localStorage` → **M-6** |
| 6 | API responses must not over-return user data | ✅ **Already implemented** | Auth responses return `{id, username, email, role, createdAt}` only — no hash, ever. `utils/auth.py` projects `{role, isActive, email}` only. `BaseRepository.scope()` forces `user_id` into every query ([repositories/base.py:33](backend/fastapi_app/repositories/base.py:33)). |
| 7 | Account/data deletion flow | ❌ **Missing** | **M-7** |

---

### Prompt 3 — Pre-Deploy Production Audit *(based on ECC Production Audit)*

| # | Recommendation | Status | Evidence |
|---|---|---|---|
| 1 | Refuse to start if a critical env var is missing | 🟨 **Partially** | `JWT_SECRET` ✅ both services fail hard. `MONGODB_URI` falls back to localhost → **M-8** |
| 2a | Remove debug `console.log` | ✅ **Already implemented** | Remaining logs are intentional operational logging (`morgan('combined')` in production, structured `[Scheduler]`/`[MongoDB]` lines). No debug leftovers. |
| 2b | Remove test-only endpoints (`/test`, `/debug`, `/admin-backdoor`, `/seed-data`) | ✅ **Already implemented** | Searched both backends — **none exist**. Seeding is a CLI script, deliberately not an endpoint. |
| 2c | Security-related TODO/FIXME | ✅ **Already implemented** | Searched `api/`, `utils/`, `middleware/`, `controllers/`, `routes/`, `lib/` for TODO/FIXME/HACK/XXX matching auth/security/token/password/permission/valid — **zero matches**. |
| 2d | Debug mode defaults OFF | ✅ **Already implemented** | `NODE_ENV` defaults to `development` locally but `render.yaml` pins `production`; FastAPI `docs_url`/`redoc_url`/`openapi_url` are `None` unless `ENVIRONMENT == "development"` ([main.py:155](backend/fastapi_app/main.py:155)) — **unmounted, not merely protected**. |
| 3 | No stack traces / internals in client errors | 🟨 **Partially** | FastAPI ✅ exemplary ([main.py:212](backend/fastapi_app/main.py:212)). Express leaks `err.message` → **M-2** |
| 4a | `X-Content-Type-Options: nosniff` | 🟨 **Partially** | Frontend ✅ ([vercel.json](frontend/vercel.json)), Express ✅ (helmet), **FastAPI ❌** → **M-5** |
| 4b | `X-Frame-Options: DENY` | ✅ **Already implemented** | Frontend ✅ explicit, Express ✅ helmet. |
| 4c | HSTS, max-age 1 year | 🟨 **Partially** | Express only, ~180 days via helmet defaults → **M-4** |
| 4d | CSP restricting scripts | 🟨 **Partially** | Express only (helmet default). **Absent on the frontend, where it matters most** → **M-3** |
| 4e | Use helmet on Express | ✅ **Already implemented** | [server.js:24](backend/server.js:24), helmet 7.2.0. |
| 5 | Rate limiting on auth endpoints, ≥5/min on login | 🟨 **Partially** | Global limiter exists but is misconfigured behind a proxy → **H-1**; no login-specific limit → **H-4**. *No signup or password-reset endpoints exist, so those parts are moot.* |
| 6 | CORS must not be `*` | ✅ **Already implemented** | Explicit allow-lists on both services, `credentials: true`, rejected origins logged. Minor: localhost entries retained → **L-2** |
| 7a | Database TLS in production | ✅ **Already implemented** | `mongodb+srv://` mandates TLS; FastAPI additionally pins `tlsCAFile=certifi.where()` ([main.py:51](backend/fastapi_app/main.py:51)). |
| 7b | No default credentials / open DB port | ✅ **Already implemented** | Atlas-managed; credentials are per-deployment env values. ⚠️ Note the documented `0.0.0.0/0` Atlas network requirement — see [DEPLOYMENT_MASTER_PLAN §6](docs/DEPLOYMENT_MASTER_PLAN.md). |

---

### Prompt 4 — Deep Security Audit for Complex Logic *(based on Trail of Bits Skills)*

> The PDF asks you to declare your app's profile. Accurate declaration for FinTechAI: **custom email/password auth + complex server logic. No payments, no smart contracts.**

#### Authentication & Authorization

| Recommendation | Status | Evidence |
|---|---|---|
| Auth middleware on every protected route | 🟨 **Partially** | **FastAPI: exemplary.** `AuthGuardMiddleware` is deny-by-default; a route added tomorrow is protected unless deliberately listed public ([auth_guard.py](backend/fastapi_app/middleware/auth_guard.py)). **Express: two routers unprotected** → **H-2**, **H-3** |
| No IDOR — never trust a client-supplied user ID | ✅ **Already implemented** — **exemplary** | Watchlists: every query filters `created_by: user_id` ([watchlist_service.py:49](backend/fastapi_app/services/watchlist_service.py:49) and 12 further call sites). Repositories: `scope()` forces `user_id` into every filter. **Best example:** `GET /api/v2/copilot/history/{user_id}` accepts a path user id and **explicitly ignores it**, scoping to the token identity instead, with a comment saying exactly that ([copilot.py:105](backend/fastapi_app/api/copilot.py:105)). That is the correct handling of a legacy API shape. |
| Password reset: random, single-use, ≤15 min, user-bound | ⚪ **Not applicable** | No self-service reset exists. Recovery is operator-run `setPassword.js`, requiring database access and an interactive terminal — a stronger boundary than a reset-token flow. Becomes relevant if self-service reset is ever added. |
| JWT: strong signing secret | ✅ **Already implemented** | HS256; both services refuse to boot in production without `JWT_SECRET`. |
| JWT: expiry | 🟨 **Partially** | Set, but **30 days** is long for a token that is also handed to the browser as a bearer string → **M-1** |
| JWT: blacklist on logout | ❌ **Missing** | **M-1** |
| **Bonus — not asked, worth crediting** | ✅ | The JWT payload is `{id}` **only**. Role is read from the database on every request, never from the token. This makes the PDF's own Prompt 5 #3 attack ("modifying their role in the JWT") structurally impossible rather than merely blocked. |

#### Payment logic

| Recommendation | Status |
|---|---|
| Server-side price calculation | ⚪ **Not applicable** — no payments |
| Client-modifiable price/quantity/discount | ⚪ **Not applicable** |
| Webhook signature verification | ⚪ **Not applicable** — no webhooks |
| Server-side payment status before granting access | ⚪ **Not applicable** |

#### Input handling

| Recommendation | Status | Evidence |
|---|---|---|
| SQL injection / parameterized queries | ⚪ **Not applicable** | No SQL. MongoDB via Mongoose and Motor, both parameterized by construction. |
| *(Adjacent: NoSQL injection)* | ✅ **Already implemented** | Login coerces `email.toLowerCase().trim()` — an injected object throws rather than reaching the query ([authController.js:21](backend/controllers/authController.js:21)). `_id` lookups go through `ObjectId()` with explicit failure handling ([utils/auth.py:120](backend/fastapi_app/utils/auth.py:120)). |
| XSS — user input rendered without sanitization | ✅ **Already implemented** | `react-markdown` used **without `rehype-raw`** — verified, no import exists — so raw HTML is not rendered. The sole `dangerouslySetInnerHTML` ([chart.tsx:81](frontend/src/components/ui/chart.tsx:81)) injects generated CSS from chart config, not user input. CSP would still add depth → **M-3** |
| File uploads: server-side type validation, size limit, no executable serving | ✅ **Already implemented** — **strong** | `MediaService`: `kind` allowlist, MIME allowlist (`image/*` + `application/pdf`), byte-size ceiling from `workspace_max_upload_mb` ([media_service.py:20-55](backend/fastapi_app/services/media_service.py:20)). `LocalDiskStorage._path()` resolves and runs a `commonpath` containment check, rejecting traversal; keys are opaque `{user_id}/{uuid}.ext` ([storage/local.py:27](backend/fastapi_app/services/storage/local.py:27)). The OHLC CSV upload independently validates extension and applies `os.path.basename()` ([local_ohlc.py:166](backend/fastapi_app/api/local_ohlc.py:166)). |

---

### Prompt 5 — Attacker's Perspective Review *(based on ECC Security Review)*

| # | Attack path | Status | Evidence |
|---|---|---|---|
| 1 | Access another user's data by changing an ID | ✅ **Already implemented** | See IDOR row above. Every user-owned resource — watchlists, saved portfolios, copilot history, media — is filtered by the token identity at the repository or service layer. |
| 2a | Endpoints that work without a token | 🟨 **Partially** | FastAPI ✅ deny-by-default, with `test_no_new_route_is_public_by_default` walking the live route table and failing the build if any GET answers anonymously. Express ❌ → **H-2**, **H-3** |
| 2b | Expired / malformed token handling | ✅ **Already implemented** | Both `ExpiredSignatureError` and `InvalidTokenError` caught and mapped to 401 ([utils/auth.py:79](backend/fastapi_app/utils/auth.py:79)). Covered by `tests/test_auth_guard.py`. |
| 2c | Default admin accounts with known credentials | ✅ **Already implemented** — **exemplary** | New accounts get a 48-byte random password that is hashed then **discarded** — nobody, including the operator, ever learns it, so the account is unusable until a password is deliberately set ([seedUsers.js:78](backend/scripts/seedUsers.js:78)). There is no default credential to find. |
| 3 | Privilege escalation by modifying role in JWT/session | ✅ **Already implemented** — **exemplary** | Role is **never** in the token. It is read from MongoDB per request (30-second cache) and enforced server-side via `require_not_demo` on watchlist mutations ([watchlists.py:13](backend/fastapi_app/api/watchlists.py:13)) and full scans ([screener.py:748](backend/fastapi_app/api/screener.py:748)). Not UI hiding — actual 403s. |
| 4a | Mass account creation via signup | ⚪ **Not applicable** | No registration route exists. Removed from the code rather than flag-guarded, so it cannot regress ([authRoutes.js:5](backend/routes/authRoutes.js:5)). |
| 4b | API/messaging abuse | 🟨 **Partially** | Copilot: per-**user** sliding window, demo 10 / beta 40 / owner 80 per 300s ([rate_limit.py:26](backend/fastapi_app/utils/rate_limit.py:26)) — correctly per-account, because the demo credential is public and arrives from many IPs. Scan trigger: 409 on concurrent, 429 on cooldown. General API: broken behind proxy → **H-1** |
| 4c | Storage fill via uploads | ✅ **Already implemented** | Per-file size ceiling + MIME allowlist. ⚠️ **NOT VERIFIED:** no per-user aggregate storage quota was found — a determined authenticated user could upload many valid files. Low practical risk on a 6-account beta. |
| 5a | JavaScript injection in text fields | ✅ **Already implemented** | See XSS row. Username additionally constrained to `/^[a-zA-Z0-9_]+$/`, 3–20 chars ([User.js:14](backend/models/User.js:14)). |
| 5b | SQL injection via search/filters/login | ⚪ **Not applicable** | No SQL. NoSQL surface addressed above. |
| 6a | Database admin panel exposed | ✅ **Already implemented** | None exists. Atlas is separately authenticated. |
| 6b | Env vars leaked through error messages | 🟨 **Partially** | FastAPI ✅. Express `err.message` → **M-2** |
| 6c | `.env` reachable by direct URL | ✅ **Already implemented** | Neither service serves static files from a directory containing `.env`; no `.env` is deployed to Render at all. |
| 6d | `.git` directory exposed | ✅ **Already implemented** | Neither Render service serves the repository root as static content. |
| 6e | Swagger/OpenAPI docs that should be internal | ✅ **Already implemented** — **exemplary** | `/docs`, `/redoc`, `/openapi.json` are **`None` outside development** — unmounted, not protected. Nothing to probe, nothing to misconfigure. |
| 6f | Health endpoints leaking system info | 🟨 **Partially** | `/health` is appropriately terse. `/api/v2/status` discloses environment and provider configuration → **L-1** |
| 7 | Business-logic manipulation (negative payments, stacked discounts, trial restarts, self-referral) | ⚪ **Not applicable** | No payments, discounts, trials, or referral system. |

---

## 4. Before public launch vs. what can wait

### 🚨 Fix before any public launch

| Finding | Severity | Why it cannot wait |
|---|---|---|
| **H-1** — `trust proxy` / global rate-limit bucket | 🟠 High | This breaks under *normal* load, not just attack. Your beta testers will lock each other out. It also makes H-4 much worse. Cheapest fix on this list, largest immediate benefit. |
| **H-2** — `/api/markets/*` unauthenticated | 🟠 High | Anonymous callers spending your third-party quota. Trivially discoverable once the Render URL is known. |
| **H-3** — `/api/portfolio/analyze` unauthenticated | 🟠 High | Unauthenticated subprocess spawn. Currently masked by the Python dependency gap — fix the auth **before** fixing that gap, or you will convert a broken endpoint into a live DoS vector. |
| **H-4** — no login-specific rate limit | 🟠 High | Two real, publicly-known Gmail addresses are in the roster. bcrypt cost 12 buys you a lot of time, but not a control. |
| **M-8** — `MONGODB_URI` fail-fast | 🟡 Medium | Not an attack path — an operational footgun that has already been documented as capable of silently seeding the wrong database. Fix while you are in `config/env.js` for H-1 anyway. |
| **L-4** — git-history secret scan | 🔵 Low | **Do this before the repository becomes public**, if it is not already. The scan is cheap; the consequence of skipping it is not. Gitleaks is the PDF's own reference tool. |

**NOT VERIFIED — USER MUST CONFIRM:** whether `https://github.com/Poorvansh45/FinTechAi` is public. If it is, L-4 moves to High and should be done immediately.

### 📋 Fix soon after launch (first maintenance window)

| Finding | Severity | Rationale |
|---|---|---|
| **M-2** — Express error-message leakage | 🟡 Medium | Small, self-contained change. FastAPI already shows the right pattern to copy. |
| **M-1** — JWT revocation on logout | 🟡 Medium | Real gap, but genuinely mitigated by the `isActive` mechanism. Consider shortening `JWT_EXPIRE` as an interim step — it costs one environment variable. |
| **M-3** — CSP on the frontend | 🟡 Medium | Defence-in-depth, and CSP needs tuning against real pages, so it benefits from a deliberate session rather than a rushed pre-launch edit. |
| **M-4 / M-5** — HSTS and FastAPI headers | 🟡 Medium | **First confirm what Vercel and Render already set at the edge** — you may find M-4 is largely covered. `nosniff` on FastAPI is nearly free. |

### 🕰️ Can reasonably wait

| Finding | Severity | Rationale |
|---|---|---|
| **M-6** — journal data in `localStorage` | 🟡 Medium | Exposure is on the user's own device, and the highest-value item (the token) is already correctly kept in memory. Revisit if journal data ever moves server-side. |
| **M-7** — account deletion | 🟡 Medium | Six accounts, all people you know. Becomes important **the moment registration opens** — treat that as the trigger, not a date. |
| **L-1** — `/api/v2/status` disclosure | 🔵 Low | Reconnaissance value only. |
| **L-2** — localhost CORS origins | 🔵 Low | Surplus surface, not a hole. |
| **L-3** — `frontend/.env.example` | 🔵 Low | Developer-experience improvement. |
| **L-5** — gitignore `uploads/` | 🔵 Low | Do it before anyone uses local media uploads. |
| **L-6** — correct stale claims in `PRIVATE-BETA.md` | 🔵 Low | Documentation accuracy — but do it before the next security review, or the wrong claims will mislead that review too. |

### ⚪ Explicitly out of scope for this project

Payments, Stripe, webhook signatures, Supabase/RLS, SQL injection, smart contracts, password-reset token flows, signup abuse, promo/referral logic. **Re-open Prompt 4 in full if payments are ever added** — that is the single change that would most alter this project's risk profile.

---

## 5. What this audit found worth commending

Security reviews list problems, which makes them read more negatively than the evidence warrants. For balance, five things in this codebase are done properly and were clearly done deliberately:

1. **Deny-by-default API middleware with a test that enforces it.** Choosing middleware over per-route dependencies — because "the one that gets forgotten is silently public" — plus `test_no_new_route_is_public_by_default` walking the live route table, is a structural fix rather than a patch. Most projects at this stage have neither.

2. **The JWT carries no role claim.** Role is read from the database on every request. This makes the PDF's privilege-escalation attack (Prompt 5 #3) *impossible by construction*, not merely blocked.

3. **The IDOR handling on `/copilot/history/{user_id}`.** Keeping a legacy path parameter for API compatibility while explicitly ignoring it for security — and documenting exactly that in a comment — is the right call, correctly executed.

4. **The seeding and password model.** New accounts get a random password that is hashed and thrown away; the seeder never touches an existing hash; `setPassword.js` refuses `argv`, refuses non-TTY input, and mutes echo. There is no plaintext credential anywhere in the system's lifecycle, and no default account to compromise.

5. **The auth guard fails closed.** When MongoDB is unreachable, `utils/auth.py` returns 503 rather than assuming the account is probably fine — with a comment naming the reasoning. Choosing unavailability over uncertainty is the harder call and the correct one.

Middleware ordering also deserves a mention: `AuthGuardMiddleware` is registered before CORS specifically so CORS ends up outermost and 401s still carry CORS headers. That is a subtle detail that most implementations get wrong, and getting it wrong turns every auth failure into an opaque browser error.

---

## 6. Verification index

Every finding above traces to a file read during this audit.

| Area | Files inspected |
|---|---|
| Secrets & gitignore | `.gitignore`, `frontend/.gitignore`, `backend/.env.example`, `backend/fastapi_app/.env.example`, `git ls-files` |
| Express auth | `server.js`, `config/env.js`, `controllers/authController.js`, `middleware/authMiddleware.js`, `middleware/errorHandler.js`, `utils/generateToken.js`, `routes/authRoutes.js`, `models/User.js` |
| Express other routes | `routes/markets.js`, `routes/portfolio.js`, `services/portfolioService.js`, `services/marketService.js`, `services/stockDataService.js` |
| FastAPI auth | `main.py`, `config.py`, `middleware/auth_guard.py`, `utils/auth.py`, `utils/rate_limit.py` |
| FastAPI data access | `api/watchlists.py`, `api/portfolio.py`, `api/copilot.py`, `api/screener.py`, `api/local_ohlc.py`, `api/workspace.py`, `services/watchlist_service.py`, `services/media_service.py`, `services/storage/__init__.py`, `services/storage/local.py`, `repositories/base.py`, `repositories/media_repo.py` |
| Frontend | `src/config/env.ts`, `src/lib/api/authToken.ts`, `src/lib/api/authApi.ts`, `src/lib/auth/token-service.ts`, `src/lib/journal/storage.ts`, `src/lib/journal/equity-storage.ts`, `src/hooks/use-trade-capture.ts`, `src/app/layout.tsx`, `src/app/api/**/route.ts`, `src/components/ui/chart.tsx`, `next.config.ts`, `vercel.json`, `package.json` |
| Ops scripts | `scripts/seedUsers.js`, `scripts/setPassword.js`, `scripts/migrate_ohlcv_to_mongo.py` |
| Deployment | `render.yaml`, `.github/workflows/ci.yml`, `.claude/launch.json` |
| Existing docs | `docs/PRIVATE-BETA.md`, `docs/DEPLOYMENT.md`, `README.md` |

**Companion documents:** [DEPLOYMENT_MASTER_PLAN.md](docs/DEPLOYMENT_MASTER_PLAN.md) §14 contains the deployment-facing security checklist; [BEGINNER_DEPLOYMENT_GUIDE.md](docs/BEGINNER_DEPLOYMENT_GUIDE.md) Step 12 contains the runtime security smoke test. This document is the gap analysis against an external standard; those two are the operational procedures.

---

*This document is analysis only. No code, configuration, or data was modified during this audit. All remediation decisions are yours.*
