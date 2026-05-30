# FinAI Edge Architecture Refactor Plan

## Target Structure

```text
frontend/src/
  app/                         # Next.js routes and route handlers
  features/
    auth/                      # auth provider, guards, profile services, token lifecycle
    journal/
    markets/
    screener/
    quant-lab/
    ai/
  components/
    ui/                        # reusable UI primitives
    layout/                    # app shell and navigation
    common/
  config/
    env.ts                     # public runtime config
  lib/
    api/                       # reusable API client and API errors
    firebase/                  # Firebase initialization
    storage/                   # browser storage helpers

backend/src/
  app.js                       # Express app composition
  server.js                    # process bootstrap only
  config/
    env.js
    firebaseAdmin.js
  middleware/
    auth.js
    errorHandler.js
    rateLimit.js
  modules/
    markets/
    portfolio/
  services/
    python/
  utils/
    asyncHandler.js
    httpError.js

backend/scripts/               # Python quant/data engines
backend/data/                  # local datasets
```

## Phase 1: Foundation Without Business Logic Changes

- Centralize frontend environment reads in `src/config/env.ts`.
- Add one frontend API client for JSON requests, backend base URL resolution, and optional Firebase ID token attachment.
- Add one frontend token service so ID token lifecycle is not duplicated across features.
- Standardize backend environment reads in `backend/config/env.js`.
- Extract backend auth, async route handling, HTTP errors, and error response handling into dedicated modules.
- Keep route URLs, payloads, and UI behavior unchanged.

## Phase 2: Feature Migration

- Move auth files under `features/auth` and leave compatibility re-exports during migration.
- Move journal, markets, screener, quant-lab, and AI-specific components/services under matching feature folders.
- Keep `app/` pages as thin route shells that import feature screens.
- Move shared browser storage helpers out of feature services and into `lib/storage`.

## Phase 3: Backend Module Split

- Move `routes/markets.js` and `services/marketService.js` into `src/modules/markets`.
- Move `routes/portfolio.js` and `services/portfolioService.js` into `src/modules/portfolio`.
- Keep Python scripts isolated and invoke them through a small `services/python` adapter.
- Add response contracts per module.

## Auth Issues Identified

- Frontend does not have a central access-token helper, so future backend calls can easily omit auth.
- Protected route logic is split between `AuthGuard`, `SessionGate`, auth page effects, and page-level redirects.
- Backend token verification exists inline in `server.js`, making it hard to reuse consistently.
- Frontend profile cache can mark users authenticated while Firestore is offline; this is useful for UX, but backend calls still require a valid Firebase ID token.
- Firebase client config uses hardcoded fallback values, making environment separation unclear.

## Dependency Graph Problems

- Next API routes spawn Python scripts from the sibling backend folder. This couples the frontend deploy artifact to backend runtime files.
- Quant Lab page calls `http://localhost:8080` directly instead of a configurable API layer.
- Backend routes mix route logic and async error handling.
- App navigation advertises future routes that do not have matching pages yet.
- `next.config.ts` ignores TypeScript and ESLint errors during builds.

## Missing Abstractions

- API client with request/response normalization.
- API error type with status and payload.
- Auth token service with optional force refresh.
- Backend `asyncHandler`.
- Backend `HttpError`.
- Backend environment module.
- Backend reusable auth middleware.
