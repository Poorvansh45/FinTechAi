# FinTechAI — Pre-Launch Compliance & Product Transformation Blueprint

> **Status:** DRAFT FOR REVIEW — no code has been written or files modified.
> **Nothing in this document is legal advice.** Items marked **LEGAL REVIEW REQUIRED**
> must be confirmed by a qualified Indian securities lawyer before launch. No wording,
> renaming or structural change described here makes FinTechAI legally compliant.

## Context

FinTechAI is preparing a public launch in India. The prior audit established that the
regulatory exposure sits in **what the product does**, not what it says: the Screener
emits, for a named security, an entry price, stop-loss, target, expected return,
confidence score and risk-reward ratio derived from technical analysis. Per SEBI's RA
FAQs (Circular SEBI/HO/MIRSD/MIRSD-PoD/P/CIR/2025/105, 23 Jul 2025, FAQ 5), a buy/sell/hold
recommendation on a specific security based on technical analysis falls under the Research
Analyst Regulations. SEBI's 4 Dec 2025 ASTA order (₹546 cr impounded) established that
"educational" framing and "not financial advice" disclaimers do not cure unregistered
advisory activity.

**Chosen direction (confirmed with the user):**
- Stay **unregistered**; transform the product rather than register or shut down.
- Price levels: **keep the numbers, drop the plan** — present as chart facts, not instructions.
- Backtests: **keep methodology + per-horizon stats, drop the rupee/total-return outcome.**
- Copilot: **describe factual state, hard-refuse all action questions.**

**Guiding rule for every change below:**
> The product may state *what is true about a security right now*.
> It must not state *what the user should do about it*.

---

## A. Executive summary

Five workstreams, in priority order:

1. **AI / portfolio surfaces** (🔴🔴 — the most serious finding, and it was not on the
   feature list I was given). `POST /generate-portfolio` returns real tickers with allocation
   percentages and expected returns, personalised to the user's goal, horizon, risk appetite
   and SIP amount, during onboarding. That is the Investment Adviser regime, not Research
   Analyst. Alongside it: the user's risk profile is injected into *every* copilot agent with
   an instruction to "personalise accordingly", an unused-but-reachable copilot route carries
   a prompt telling it to be "actionable", and screener deep-links auto-execute arbitrary
   URL-supplied text as the signed-in user. See Section E0.
2. **Landing page** (🔴, least ambiguous) — five fabricated testimonials with invented
   performance numbers ("cut drawdown 40%"), plus hardcoded return-range claims on the
   Screener Overview. A problem independent of SEBI; needs no legal nuance to see.
3. **Screener output** (🔴) — remove the trade-plan layer (`TradePlanStrip`), forward-return
   fields and confidence percentages across LaunchPad / Alpha Zone. Preserve every
   underlying calculation; change only what is *exposed and how it is framed*.
4. **Copilot guardrails** (🔴) — no deterministic controls exist at all today; the only
   safety content is advisory text inside prompts. Needs a refusal spec before launch.
5. **Legal surface** (🟠) — no Terms, Privacy or risk-disclosure page exists anywhere on the
   site, and the footer links to none. Also a DPDP Act 2023 gap, not only a SEBI one.

Journal, Equity Journal, Watchlists, charts, raw indicators and the scanner engines
themselves are largely untouched. **No scanner algorithm is deleted.**

**Honest framing:** items 2–5 are the transformation you asked for. Item 1 is a different
category — it is not a labelling or framing problem that transformation solves, and I do not
think the product should launch with `/generate-portfolio` enabled in its current form.

**The good news, and it is substantial:** tracing the maths showed that `expected_return` is
algebraically `2.0 × risk_pct` and `projected_return` is `3.0 × risk_pct` — the stop distance
times a hardcoded constant. `risk_reward` is *always* exactly 2.0 or 3.0 by construction.
None of these carry any market information or any forecast. So the fields that create the
most regulatory exposure are also the ones whose removal costs the product **nothing
analytically**. Four of the seven scanners (`/technical`, `/volume`, `/fvg`, `/smc`,
`/momentum`) already contain no trade-plan fields at all. See D0.

---

## B. Feature-by-feature risk matrix

| Feature | Current exposure | Risk | Action |
|---|---|---|---|
| **`POST /generate-portfolio`** (`api/ai.py:175-189`) | Returns real tickers + allocation % + expected returns, personalised to the user's goal/horizon/risk/SIP. **Investment Adviser regime, not RA.** Runs during onboarding | 🔴🔴 | Disable or redesign — see E0.1 |
| **Profile injected into every agent** (`workflow.py:73-83` → `base.py:127`) | Market agent told user's risk appetite + "personalise accordingly" → stock answers are already personalised | 🔴 | Strip profile from market route |
| **Orphan copilot route** (`app/api/copilot/chat/route.ts`) | Unused but HTTP-reachable; prompt instructs "recommendations", "actionable"; no guardrails | 🔴 | Delete the file |
| Copilot deep-link auto-run (`ai-copilot/page.tsx:141-156`) | Executes arbitrary URL-supplied text as the signed-in user, no confirmation | 🔴 | Allowlist or require send |
| Landing testimonials (`app/page.tsx:61-100`) | 5 fabricated personas w/ invented metrics ("cut drawdown 40%", "reduced revenge trading 37%") under header "PROVEN EDGE" | 🔴 | Remove entirely |
| Overview return claims (`app/screener/page.tsx:242,299`) | Hardcoded "Typical Return Target +5% to +20%", "Expected Profit Target +10% to +40%" | 🔴 | Remove |
| `TradePlanStrip` (`QuantLab.tsx:149-193`) | Entry / Stop / Target / R:R per security | 🔴 | Replace with `LevelsStrip` (chart facts) |
| `expected_return` / `projected_return` | Forward-looking per-security return | 🔴 | Remove from API response + UI |
| `confidence` / `institutional_score` as % | Implied accuracy | 🔴 | Reframe as conditions-matched count |
| `buildRationale()` (LaunchPad + Alpha Zone) | Analyst-style prose incl. stop/target | 🔴 | Rewrite to conditions-only |
| AI Copilot | Unbounded security-specific Q&A | 🔴 | Refusal spec (Section E) |
| "AI Anal." deep-link | Passes entry + expected return into copilot | 🔴 | Strip trade params from link |
| IPO Vintage equity headline ("₹1,00,000 became ₹3,17,175") | Unverified past-return claim; PaRRVA live 4 May 2026 | 🔴 | Remove rupee outcome, keep methodology |
| Volume Scanner forward returns (`Avg 2D/5D/10D Ret`, `Win Rate 5D`) | Forward-return statistics per security | 🟠 | Reframe as historical occurrence stats + disclosure |
| Watchlists "Best/Worst Performers", "Alpha vs Nifty50" | Superlative + performance framing | 🟠 | Rename to neutral ranking |
| `SignalBadge` Strong/Medium/Weak | Functions as a graded rating | 🟠 | Replace with conditions-matched |
| `quantContent.ts` prescriptive copy | "Entry = current price. Stop = …", "Higher is better", "Check it before sizing a position" | 🟠 | Rewrite |
| Missing disclaimer on 6 of 9 screener pages | Only `StrategyFooter` pages carry one | 🟠 | Move to layout |
| No Terms / Privacy / Legal pages | DPDP Act 2023 + basic consumer law | 🟠 | Create |
| Raw indicators, prices, zone boundaries, charts | Factual market data | 🟢 | Keep unchanged |
| Journal / Equity Journal / Trader Score | Analyses user's own past decisions | 🟢 | Keep unchanged |

---

## C. Current → Proposed UI mapping

### C1. Shared component: `QuantLab.tsx`

`TradePlanStrip` is rendered by LaunchPad and Alpha Zone. Replace with a new
`TechnicalLevelsStrip` that shows the **same numbers as chart facts, unordered, unlabelled
as actions**, and drops R:R entirely.

| Current label | Current source | Proposed label | Proposed source |
|---|---|---|---|
| `Entry` ₹ | `s.entry` | *(removed as a concept)* | — |
| `Stop` ₹ | `s.stop_loss` | `Zone Low` / `Structure Low` ₹ | `s.fvg_low` / `s.zone_low` |
| `Target` ₹ | `s.target` | *(removed — it is a derived objective, not a chart fact)* | — |
| `R:R` | `s.risk_reward` | *(removed)* | — |
| `Risk %` | `s.risk_pct` | `ATR (14)` ₹ + `Volatility %` | `s.atr_14` |
| `ATR` ₹ | `s.atr_14` | keep | `s.atr_14` |
| — | — | `Zone High` ₹ | `s.fvg_high` / `s.zone_high` |
| — | — | `200 EMA` ₹ / `Dist %` | existing indicator |
| — | — | `Current Price` ₹ | `s.cmp` / `s.ltp` |

> **Note the deliberate asymmetry:** zone low/high and EMA are levels that *exist on the
> chart independently of any trade idea*. "Target" does not — it is computed as
> `entry + reward_multiple × risk`, i.e. it only means anything as part of a plan. That is
> why zone boundaries stay and target goes. This is the substantive distinction, not a rename.

`SignalBadge` (Strong/Medium/Weak) → `ConditionsBadge` showing `6 / 8 conditions`.

`ExplainPanel` header `"Why this setup"` → `"How this stock matched"`;
`"Confidence Breakdown"` → `"Condition scores"` with an inline methodology note.

`StrategyFooter` disclaimer text (`QuantLab.tsx:243-247`) → replaced by the stronger
persistent notice in Section F, and **moved into `screener/layout.tsx`** so all nine
screener pages inherit it (currently six have none).

### C2. LaunchPad (`app/screener/launchpad/page.tsx`)

- **KEEP:** FVG detection, gap %, FVG zone boundaries, FVG age, EMA200 distance, avg volume,
  ATR, `fvg_sample` / `fvg_win_rate` / `fvg_avg_win` / `fvg_avg_loss` historical block
  (reframed per Section G), all filters, all charts, card layout.
- **MODIFY:** page subtitle — drop *"high-probability momentum breakout setups"* →
  *"Stocks where a bullish Fair Value Gap currently overlaps the 200 EMA region."*
  Card metric `Exp. Return` → removed; `Risk` (Low/Med/High) → `ATR %`.
  `getConfidenceBadgeColor` / `Conf. {n}%` → `{n}/8 conditions`.
- **REMOVE:** `TradePlanStrip`, `expected_return`, `confidence` %, `signal_strength` badge,
  `buildRationale()` in its current form, `"Proprietary Strategy"` eyebrow.
- **SAFE REPLACEMENT:** rationale rewritten to state only observed conditions, e.g.
  *"A bullish FVG formed 6 sessions ago spans ₹412.50–₹431.20. Price (₹438.10) is 1.6% above
  the gap high and 8.4% above the 200 EMA. 20-day average volume is 1.2M."* — facts, no plan.

### C3. Alpha Zone (`app/screener/alpha-zone/page.tsx`)

- **KEEP:** order-block detection, zone low/high, zone type (Fresh/Retested), touch count,
  distance %, zone age, all new Price/Avg-Volume filters, card layout.
- **MODIFY:** `Institutional Score` → `Structure Score` with methodology disclosure (the
  current name asserts an unknowable fact about *who* traded). `Proj. Return` → removed.
  `Hold ≈ {n}d` (`expected_holding`) → removed — it is a forecast.
  Subtitle drops *"premium medium-term swing investing"*.
- **REMOVE:** `TradePlanStrip`, `projected_return`, `expected_holding`, `zone_strength` badge.
- **BUG TO FIX IN THE SAME PASS:** `alpha-zone/page.tsx:436,476` pass `accent="cyan"`, which
  `QuantLab.tsx:106-107,210` does not handle — it silently falls through to purple. This is a
  regression introduced by my earlier blue→cyan sed; `ACCENT` in `filters/types.ts` supports
  cyan but QuantLab's local accent branch does not.

### C4. Technical Scanner (`app/screener/technical/page.tsx`) — 🟢 lowest risk

- **KEEP essentially everything.** RSI, EMA50/200 distance, MACD histogram, volume, LTP,
  filters, table, CSV export. This page is already a genuine screener.
- **MODIFY:** the oversold/overbought legend and hints (`L39`, `L330-331`) carry mild
  directional framing (*"bullish alignment"*, *"bullish crossover momentum"*) — restate as
  neutral definitions. Add the persistent disclaimer (inherited from layout).

### C5. Volume Scanner (`app/screener/volume/page.tsx`) — 🟠

- **KEEP:** volume ratio, today's volume, 20-day average, day return, surge count, per-surge
  history table, filters.
- **MODIFY:** `Avg 2D/5D/10D Ret` and `Win Rate 5D` are **forward-return statistics** — the
  single riskiest thing outside LaunchPad/Alpha Zone. Retain as *historical distribution*
  with explicit framing: `Hist. 5D move (median)` + a mandatory "past occurrences, not a
  forecast, before costs" line. `Positive Surge %` → `Sessions closing positive (n=…)`.
  Always show sample size `n`.
- **REMOVE:** `"Avg return on surge: …%"` summary line (`L469`) in its current phrasing.

### C6. FVG / SMC Scanners — 🟢/🟠

- **KEEP:** all detection, zone boundaries, mitigation status, BOS/CHoCH events, 52W
  distances, scores.
- **MODIFY:** `FVG Strength: Strong/Medium/Weak` → numeric score + conditions.
  SMC `Discount`/`Premium` labels are standard SMC terminology and factual about position
  relative to equilibrium — **keep**, but define them inline.
- **NOTE:** `components/screener/FVGScanner.tsx`, `VolumeScanner.tsx` and
  `TechnicalFilters.tsx` are **dead code** (no importers — the routes are self-contained).
  Delete rather than edit, to avoid maintaining two copies of the risky labels.

### C7. IPO Vintage — see Section G

### C8. Screener Overview (`app/screener/page.tsx`) — 🔴

- **REMOVE:** `Typical Return Target +5% to +20%` (L242-243), `Expected Profit Target
  +10% to +40%` (L299-300) — hardcoded return claims, the clearest Advertisement-Code-style
  problem in the app.
- **MODIFY:** `Featured Proprietary Strategies` → `Available Scanners`;
  `Total Setup Opportunities` → `Total Matches`; `Current Opportunities` → `Current Matches`;
  `Scan X Opportunities` CTAs → `Open X Scanner`; `Entry Trigger` → `Detection Rule`.
- **KEEP:** scan status, last-scanned, universe size, holding-period and methodology
  descriptors (these are factual descriptions of what the rule does).

### C9. Watchlists — see Section H

### C10. Landing page (`app/page.tsx`) — 🔴 highest urgency

- **REMOVE:** `TESTIMONIALS` array (L61-100) and the entire marquee section (L1015+),
  including the `PROVEN EDGE` eyebrow (L1019) and `Trusted by Serious Traders` (L1022).
  These are five invented people with invented performance figures. Independent of SEBI, this
  engages the Consumer Protection Act 2019 and CCPA misleading-advertisement guidelines.
- **REMOVE:** dead `components/landing/testimonials.tsx` (3 more fabricated quotes, unrouted).
- **MODIFY:** the mock live ticker (`L140-144`, NVDA/TSLA/AAPL with fake prices and "flash"
  animations) reads as live market data. Either label it clearly as an illustration or use
  real delayed data. Also note the copy says **"FinAI Edge"** (L71) while the product is
  "FinTechAI" — inconsistent branding in user-facing text.
- **REPLACE WITH:** feature descriptions, methodology explanations, screenshots. If you want
  social proof later, it must be real, attributable, consented, and free of performance claims.

---

## D. Backend data / output changes

**Principle:** do not delete the computation. `TradePlan` and the scoring functions stay in
the engine; they stop being **serialised into the API response**. The change is enforced at
the API boundary, which keeps it reversible and makes it testable with one assertion.

### D0. Three findings that simplify this enormously

**D0.1 — `expected_return` contains no information. This is the headline finding.**
`api/screener.py:303-304` computes `expected_return = reward_per_share / entry × 100`.
Since `reward_per_share = 2.0 × risk` and `risk = entry − stop`, this reduces algebraically to:

```
expected_return  ≡  2.0 × risk_pct          (LaunchPad)
projected_return ≡  3.0 × risk_pct          (Alpha Zone, alpha_zone.py:109)
```

It is the stop distance multiplied by a hardcoded constant. **It is not a forecast, contains
no market information beyond `risk_pct`, and is not derived from any analysis of likely
future movement.** Deleting it therefore costs the product *nothing analytically* — which
resolves the tension in your brief about not removing genuine value. Note also that
`risk_reward` is *always exactly* the reward multiple (2.0 / 3.0) by construction — it is a
constant being displayed as if it were a per-stock measurement.

`expected_holding` (Alpha Zone) is `projected_return / 0.8`, where `DAILY_PROGRESS_PCT = 0.8`
is an assumed daily pace with no empirical derivation anywhere in the code.

**D0.2 — Four of the seven scanners are already clean.**
`/technical`, `/volume`, `/volume-surge`, `/fvg`, `/momentum` and `/smc` contain **zero**
trade-plan fields. Only `/launchpad`, `/alpha-zone` and `/ipo-vintage` are affected. This is
a much smaller blast radius than the audit implied.

**D0.3 — IPO Vintage's `entry` and `stop_loss` must NOT be removed.**
Unlike the other two, these are *observed historical prices*: `entry` = the actual close on
the breakout bar, `stop_loss` = the actual opening-session low. They are load-bearing for
stop-hit detection (`ipo_vintage.py:200`), MAE flooring (261, 274), every horizon's
`status` / `return_pct` (221-228), `setup_status`, the `risk_quality` confidence sub-score,
and the `max_risk` API filter and sort. **Relabel these; do not delete them.** IPO Vintage
also has no `target` and no `risk_reward` at all — it is already the least
recommendation-shaped scanner.

### D1. Field disposition

| Field | Where | Action | Why |
|---|---|---|---|
| `expected_return` | LaunchPad (API-computed) | **Delete** | ≡ 2×`risk_pct`; no information |
| `projected_return` | Alpha Zone (cached) | **Delete** | ≡ 3×`risk_pct` |
| `expected_holding` | Alpha Zone | **Delete** | Forecast from an invented pace constant |
| `target` | LaunchPad, Alpha Zone | **Delete** | `entry + k·risk` — only meaningful as part of a plan |
| `risk_reward` | LaunchPad, Alpha Zone | **Delete** | Always the constant 2.0 / 3.0 |
| `risk_per_share`, `reward_per_share` | both | **Delete** | Zero consumers once the above go |
| `entry` | LaunchPad, Alpha Zone | **Delete from response** | An instruction, not a chart fact |
| `stop_loss` | LaunchPad, Alpha Zone | **Delete from response** | Superseded by `fvg_low` / `zone_low`, which are the same structural level stated factually |
| `risk_pct` | LaunchPad, Alpha Zone | **Replace** with `atr_pct` | Cosmetic there (`_risk_label` only) |
| `risk_pct` | **IPO Vintage** | **Keep**, rename display → `Stop distance %` | Load-bearing: confidence input, filter, sort |
| `entry`, `stop_loss` | **IPO Vintage** | **Keep**, rename display → `Breakout close` / `Opening-session low` | Observed prices; guts the strategy if removed |
| `signal_strength`, `zone_strength` | all | **Replace** with `conditions_met` / `conditions_total` | Graded rating → countable fact |
| `confidence`, `institutional_score` | all | **Keep value, rename + reframe** | Computed from real OHLCV; stop presenting as a % |
| `holding_period` | all | **Delete** | Class constant presented as guidance |
| `fvg_low/high`, `zone_low/high`, `ema_200`, `atr_14`, `gap_pct`, `*_dist_pct`, `days_since_formation`, `touch_count`, `volume`, `cmp`/`ltp`, dates | all | **Keep unchanged** | Factual market data — the replacement surface |

### D2. Naming corrections found along the way

- `alpha_zone.py:130` publishes the **blended confidence** under the key `institutional_score`,
  while the *actual* OB institutional score is published as `origin_score` (line 132). The API
  sorts on `institutional_score` (`screener.py:491`), so it sorts by blended confidence, not
  institutional quality. Rename to `structure_score` / `order_block_score` while we are here.
- `api/screener.py:311` aliases `rsi` from `d.get("rsi_14")`, which LaunchPad never sets —
  permanently `None`. Dead; delete.

### D3. Dependency migrations required

These break if the fields are removed and must be handled in the same change:

- **API filters:** `min_return`/`max_return` on `/launchpad` (`screener.py:402-405`),
  `min_return` on `/alpha-zone` (469). Replace with `gap_min`/`gap_max` (already exists) and
  a new `atr_pct` band. IPO Vintage's `max_risk` / `sort_by=risk_pct` (648, 654, 657) **stay**.
- **Frontend filters:** LaunchPad "Expected Return" `RangeFilter` and Alpha Zone "Projected
  Return" `RangeFilter` are removed; their state, params, `activeCount` and reset entries go
  with them (same pattern as the Confidence-filter removal already done this session).
- **Watchlist payload:** `launchpad/page.tsx:166` sends `price: s.entry` → change to `s.cmp`.
  `alpha-zone/page.tsx` already uses `s.ltp`.
- **Tests:** `tests/test_engines.py:117-135, 154, 202-204` (9 assertions on
  `stop_loss`/`risk_reward`/`target`/`risk_pct`/`risk_per_share`/`entry`/`projected_return`)
  and `tests/test_ipo_vintage.py:79-80, 299-307`. The `TradePlan` unit tests can stay green by
  testing the class directly; the API-shape assertions get inverted into the negative
  assertion described in the verification plan.
- **Glossary:** `quantContent.ts:12, 22, 23, 34, 42, 52, 65` explains Entry/Stop/Target and
  the reward multiple. These entries become false and must be rewritten, not just deleted.

### D4. What stays in the engine

`TradePlan`, `from_support`, `strength_label`, and every scoring function in
`engines/ranking/scorer.py` and `alpha_zone_ob.py` remain in the codebase and keep running.
`fvg.py:286-289` uses entry/floor/target *internally* to compute the historical FVG win-rate
and emits no trade field — untouched. **Nothing in the analytical engine is deleted.**

---

## E. AI Copilot behaviour specification

### E0. Four findings that change the risk picture

**E0.1 — `POST /generate-portfolio` is personalised investment advice. 🔴🔴**
`backend/fastapi_app/api/ai.py:175-189` takes the user's goal, horizon, risk appetite,
monthly SIP amount and financial-health profile, and returns **4–6 real Indian tickers
(`RELIANCE.NS`, `HDFCBANK.NS`, …) with allocation percentages summing to 100% and expected
annual returns**. This is not screening and it is not research — it is a personal
recommendation to a specific individual based on their stated circumstances, which is the
**Investment Adviser** regime (SEBI IA Regulations 2013), not merely Research Analyst.
It runs during **onboarding**, so it is the first thing a new user sees.

This was not in the feature list I was given and it is, in my assessment, the highest-risk
single feature in the product. It must be disabled or fundamentally redesigned before
launch. Options: remove; or convert to asset-*class* education (e.g. "portfolios like this
are often described as 60/30/10 equity/debt/gold") with **no tickers and no expected
returns**. **LEGAL REVIEW REQUIRED — treat as blocking.**

**E0.2 — Every agent is told the user's profile and instructed to personalise.**
`workflow.py:73-83` builds `"Known user profile (personalise accordingly): …"` (risk
appetite, horizon, goals) and `agents/base.py:127` concatenates it onto **every** agent's
system prompt — including the market agent, which is what the screener deep-links hit.
`MARKET_AGENT_PROMPT` additionally says *"Relate findings back to risk and, when known, the
user's portfolio concentration."* So security-specific answers are **already personalised to
a known individual**. This is the IA bright line and it is currently crossed by default.
**Fix: the market route must not receive the profile block.** Personalisation stays only on
the portfolio route, which discusses the user's *existing* holdings rather than new purchases.

**E0.3 — An orphan route bypasses all of the above. 🔴**
`frontend/src/app/api/copilot/chat/route.ts:43-59` is a second, unused copilot with a far more
permissive prompt that explicitly instructs *"Structure recommendations clearly"* and *"Keep
answers professional, quantitative, and actionable"*. Its demo fallback hardcodes
*"**Actionable Insights**: - Recommend analyzing asset correlations…"*. Nothing in the UI
calls it, but it is reachable by direct authenticated HTTP POST. **Delete it** — do not
merely leave it unrouted.

**E0.4 — Deep links auto-execute arbitrary text as the signed-in user.**
`app/ai-copilot/page.tsx:141-156` reads `prompt` from `window.location.search` and fires it
after 500 ms with no allowlist, validation or confirmation. Any external link can put
attacker-authored text into the copilot as that user, in a route primed with their risk
profile. This is a security issue independent of compliance. **Fix: allowlist a small set of
templated intents, or require the user to press send.**

### E1. Decision table

| User asks | Response |
|---|---|
| "Should I buy this?" / "Should I hold?" / "Is this a good stock?" | **Refuse.** Offer factual state instead. |
| "What should I buy?" | **Refuse.** No security selection of any kind. |
| "Where should I enter?" / "Where do I put SL?" / "What target?" | **Refuse.** May state where chart levels are, must not frame them as the user's plan. |
| "Analyze this stock" | **Partial.** Describe current indicator values, matched conditions and chart structure. No conclusion, no direction, no outlook. |
| "What are INFY's indicators?" | **Answer.** Factual. |
| "What is a Fair Value Gap?" | **Answer.** Educational concept, no security named. |
| "Why did X appear in LaunchPad?" | **Answer.** State which conditions matched. |
| Anything about the user's own past trades (Journal) | **Answer.** Reviewing the user's own history is not advice. |
| Anything forward-looking about any security | **Refuse.** |

### E2. Current state vs required state

| Control | Today | Required |
|---|---|---|
| Deterministic guardrail | **None** — everything is prompt-level suggestion | Input classifier + output filter, fail closed |
| Prohibited-topic list | `RESPONSE_STYLE` forbids only *"a bare buy X / sell X directive"* and guaranteed returns | Must also cover entry, exit, stop-loss, target, position sizing, "should I", "is it good" |
| Output filter | None — `finalize_node` only checks for an empty string | Scan for action language before returning |
| Copilot disclaimer | *"can make mistakes. Verify important information."* | Explicit not-advice notice |
| Rate limiting on `/api/v2/copilot/chat` | **None** | Per-user limit |
| Safety tests | None (`test_copilot.py` covers routing/tools/memory only) | Refusal battery in CI |

**The specific gap that matters:** `RESPONSE_STYLE` bans *"buy X"* but says nothing about
trade setups. So *"validate this entry and stop for INFY"* — exactly what the screener
deep-links ask — is **squarely inside current policy** and will be answered.

### E3. Design requirements

1. **Enforcement must not be prompt-only.** A system prompt is bypassable. Use (a) a
   pre-flight intent classifier, (b) hardened prompts, (c) a post-generation output check.
   Fail closed on all three.
2. **Refusal copy** must be useful, not a wall: state that FinTechAI does not provide
   recommendations, offer the factual alternative, point to a SEBI-registered adviser.
3. **Remove trade parameters from the deep links** (`launchpad:506`, `alpha-zone:464`,
   `ipo-vintage:768`). They currently send entry, stop, risk % and projected return — the
   exact framing being removed from the UI — and the agent's tools *cannot verify* any of
   those numbers, so it would be endorsing figures it cannot check.
4. **Strip the profile block from the market route** (E0.2).
5. **Remove the "How does this fit my portfolio?" follow-up chip** (`workflow.py:51-55`) —
   it deliberately walks the user from generic analysis into personalised advice.
6. Log every refusal (intent, timestamp) as evidence of good-faith controls.
7. Review the two adjacent LLM prompts not part of the copilot graph:
   `api/ai.py:175-189` (E0.1) and `app/api/journal/analyze/route.ts:66` (journal coach —
   lower risk, reviews the user's own past trades, but should be bounded against
   forward-looking suggestions).

---

## F. Disclaimer / acknowledgement UX

1. **First-use modal** — once per account, not per visit (per-visit trains dismissal).
   Checkbox + server-stored `{userId, version, timestamp}` so you can prove what was shown.
   Re-prompt only when the version string changes.
2. **Persistent notice** — a compact always-visible line in `screener/layout.tsx`, so all
   nine screener pages inherit it. Today only the three pages rendering `StrategyFooter`
   carry any disclaimer.
3. **Card-level "why this matched"** — the highest-value disclosure in the whole plan,
   because it reframes a card from verdict to filter output, and it is *true*.
4. **Methodology page** per scanner — the rules, the data source, the lag, the limits.
5. **Legal pages — none currently exist.** Need Terms of Use, Privacy Policy (DPDP Act 2023
   obligation, separate from SEBI), Risk Disclosure, and Contact/Grievance. The footer
   presently links to none. **LEGAL REVIEW REQUIRED.**

Do **not** publish "We are not SEBI registered" — it is an admission of the element SEBI
would need to establish, and it triggers the 29 Aug 2024 association rules that bar
registered intermediaries from partnering with you (foreclosing broker integrations).
State what the product *is*.

---

## G. Historical performance / backtest treatment

Applies to IPO Vintage's study panel, LaunchPad's per-stock FVG track record, and Volume
Scanner's forward-return columns.

**Remove:** the rupee equity outcome (`₹1,00,000 became ₹3,17,175`), `total_return_pct`,
`multiple`, and the equity-curve headline framing. A growth-of-₹1-lakh curve is a portfolio
performance claim — the thing PaRRVA (live 4 May 2026) exists to verify.

**Keep:** the per-horizon table (trades, win rate, median, mean, stopped-out %), per-year
breakdown, sample start/size, and the existing caveats. Frame as *"how often this chart
pattern was historically followed by an up-move"*, not *"what you would have earned"*.

**Keep and reuse the existing honesty.** The IPO Vintage page already states outright that
the median trade loses money while the mean is positive, and that the result comes from a
minority of large winners. That is the correct tone and it should be the template.

**Add everywhere:** sample size, date range, "before brokerage, taxes and slippage",
"not verified by any agency", "past occurrences do not indicate future results".

The interactive equity chart component itself can survive if it plots *pattern occurrence
distribution* rather than *account value*. **LEGAL REVIEW REQUIRED** on whether per-horizon
win-rate statistics are retainable at all without registration.

---

## H. Watchlist treatment

- **KEEP:** user-created lists, add-from-scanner, the whole storage layer.
- **MODIFY:** `Best Performers` / `Worst Performers` → `Largest gain` / `Largest decline`
  (over period, factual). `Alpha vs Nifty50` → `Difference vs Nifty 50 (%)`.
  `Portfolio Return` → `List price change (%)`. `Win Rate` → `Advancing / total`.
- **HARD RULE:** never ship a default, curated, featured or "recommended" watchlist. SEBI's
  Stallion Asset settlement (6 May 2022, ₹28.6 lakh + 3-year registration bar) penalised a
  *registered* RA for exactly that pattern. A house list is the single easiest way to turn a
  low-risk feature into a high-risk one.

---

## I. What can remain untouched

Charts and visualisations · all indicator engines (RSI, EMA, MACD, ATR, volume) · FVG/SMC/OB
detection algorithms · scan orchestration, coordinator, locking, cooldown · Technical Scanner
· filter components (`RangeFilter`, `DualRangeSlider`, `FilterPanel`) · Trading Journal ·
Equity Journal · Trader Score / AI Coach (reviews the user's *own* past behaviour) · auth,
nav, layout, theming · CSV export · watchlist storage · copilot education & planning routes ·
calculator tools (already carry "not guaranteed" strings).

**No scanner algorithm is deleted anywhere in this plan.**

⚠️ **Correction:** the Portfolio Optimizer / onboarding portfolio generator is **not** in this
list. See E0.1 — it is the highest-risk feature found and is blocking.

---

## J. What must change before launch

**Blocking:** `/generate-portfolio` (E0.1) · profile-injection into the market route (E0.2) ·
orphan copilot route (E0.3) · deep-link auto-run (E0.4) · fabricated testimonials · Overview
hardcoded return claims · `TradePlanStrip` · expected/projected return · confidence % ·
Copilot guardrails · "AI Anal." deep-link params · IPO Vintage rupee outcome ·
Terms/Privacy/Risk pages · first-use acknowledgement · persistent disclaimer on all screener
pages.

**Strongly recommended:** Strong/Medium/Weak badges · Volume Scanner forward-return framing ·
Watchlist superlatives · `quantContent.ts` prescriptive copy · "Proprietary Strategy" ·
Overview "Opportunities" language · mock ticker labelling · dead-component deletion ·
the `accent="cyan"` regression.

---

## K. Requires Indian securities-lawyer confirmation

1. Does the post-transformation output (conditions matched + chart levels, no plan) fall
   outside "research services"? **Where exactly is the line?**
2. Are per-horizon historical win-rate statistics retainable unregistered, post-PaRRVA?
3. **Does `/generate-portfolio` — tickers + allocations + expected returns, personalised to a
   user's stated goal/horizon/risk — constitute investment advice under IA Reg. 2(m)? What is
   the exposure given it has already been publicly reachable during onboarding?** *(Ask this
   one first; it is the most consequential question on the list.)*
4. Does telling the market agent the user's risk appetite constitute personalisation even
   where the answer itself is factual?
5. Do scanner names ("Alpha Zone", "LaunchPad") create holding-out risk under IA Reg. 2(m)?
6. Exposure for the period the product has already been publicly accessible?
7. Do user-created watchlists risk model-portfolio characterisation (Stallion)?
8. Does the 29 Jan 2025 three-month data-lag rule bite if any positioning is educational?
9. Sign-off on the disclaimer, Terms, and acknowledgement wording.

---

## L. Recommended implementation order

| # | Phase | Why this order |
|---|---|---|
| 0 | **Kill switches:** disable `/generate-portfolio`, delete orphan copilot route, strip profile from market route, gate deep-link auto-run | Highest severity, smallest diffs, no design work needed. Do these first regardless of what else is agreed |
| 1 | Landing page: delete testimonials + Overview return claims | Highest risk, lowest effort, zero dependencies, needs no legal input |
| 2 | Legal pages + persistent disclaimer + first-use modal | Independent of scanner work; can proceed in parallel |
| 3 | Backend: stop serialising trade-plan fields; add `conditions[]` | Everything in phase 4 depends on the new response shape |
| 4 | `QuantLab.tsx`: `TradePlanStrip` → `TechnicalLevelsStrip`, badges, `ExplainPanel` | Single shared component — fixes 3 pages at once |
| 5 | LaunchPad + Alpha Zone page copy, rationale rewrite, cyan bug | Consumes phases 3–4 |
| 6 | IPO Vintage backtest reframing | Self-contained |
| 7 | Volume Scanner + Watchlist relabelling | Lower risk, can trail |
| 8 | Copilot guardrails + deep-link fix | Largest single piece; needs its own verification pass |
| 9 | Delete dead components; `quantContent.ts` rewrite | Cleanup |

## Verification plan

- `npx tsc --noEmit` clean after each phase.
- Backend: `python -m pytest tests/ -q` after each backend phase. 118 tests pass today;
  expect breakage in `test_engines.py` (9 assertions) and `test_ipo_vintage.py` — these are
  migrated, not deleted (D3).
- **Negative-assertion test — the key regression guard.** Assert `/launchpad` and
  `/alpha-zone` responses contain none of `entry`, `stop_loss`, `target`, `risk_reward`,
  `risk_per_share`, `reward_per_share`, `expected_return`, `projected_return`,
  `expected_holding`, `holding_period`. Assert `/ipo-vintage` still *does* contain `entry`,
  `stop_loss`, `risk_pct` (D0.3) — so a later over-zealous cleanup can't gut that strategy.
- **Copilot refusal battery in CI:** the eight question types in E1, plus jailbreak variants
  ("hypothetically", "as an example", "my friend asks"), asserting refusal. There are
  currently zero safety tests.
- Assert `/generate-portfolio` returns disabled/redesigned output and no `.NS` ticker list.
- Assert the orphan route `frontend/src/app/api/copilot/chat/route.ts` no longer exists.
- Browser pass per phase via the preview tools, reading computed DOM for removed strings.
- Final gate: full-text grep across `frontend/src` for the banned vocabulary
  (`Expected Return`, `Target`, `Stop Loss`, `Entry`, `R:R`, `Strong Buy`, `high-probability`,
  `Opportunities`, `PROVEN`, `Best Performer`).
