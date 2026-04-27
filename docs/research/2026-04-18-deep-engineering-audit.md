# Deep Engineering Audit — Research Notes

**Project:** Chapa — Dev Impact Badge (`/Users/juan/code/chapa`, branch `develop`)
**Stack:** Next.js 15 App Router, TypeScript, Tailwind v4, Upstash Redis, Supabase, Vercel, Resend
**Date:** 2026-04-18
**Phase:** Research (per `.claude/rules/rpi-details.md:18` — documents what exists; does not prescribe fixes)

---

## 1. Scope and Ground Rules

### What this document is

Observations of the codebase as it exists on `develop` today. Each observation is grounded in a `file:line` reference so the claim can be re-verified. Per `.claude/rules/rpi-details.md:18`, this is the research phase: **no recommendations, no phased plans, no "fix before release" labels**. Any re-mediation plan belongs in a subsequent `/plan` artifact.

### Files reviewed

`apps/web/lib/{impact, cache, auth, github, render, verification, db, history, email}/**`; every route under `apps/web/app/api/**`; badge SVG pipeline at `apps/web/app/u/[handle]/badge.svg/route.ts`; share page at `apps/web/app/u/[handle]/page.tsx`; Supabase migrations under `supabase/migrations/`; scoring test suite; OAuth flow; CLI device-auth flow.

### Not reviewed (runtime-only, out of scope here)

Live Supabase RLS policies; live Redis behavior; Resend API responses; Vercel deployed env values. Anything that depends on those is flagged "Plausible — needs runtime validation" in §4B.

### Distinction made throughout

What the code *does* (from reading it) vs. what comments and docs *claim* (not necessarily true). Several observations hinge on this gap.

---

## 2. Accepted Risks Contract

`CLAUDE.md:181` states: *"Items in [`docs/accepted-risks.md`] are intentional and should not be flagged as audit warnings."* The following items were specifically checked against the current code and **treated as out-of-scope for this audit** because they match the resolved/accepted state in the contract:

| Accepted-risk ID | Resolved/Accepted state | File:line checked |
|---|---|---|
| #401 (`docs/accepted-risks.md:39-44`) | HMAC SHA-256 digest truncated to 128 bits is the **accepted** fix (was 64 bits before 2026-03-24). | `apps/web/lib/verification/hmac.ts:35` |
| #398 (`docs/accepted-risks.md:21-25`) | Redis rate-limiter fail-open on connection failure is accepted. | `apps/web/lib/cache/redis.ts` (`rateLimit()`) |
| #402 (`docs/accepted-risks.md:46-51`) | Component-level admin gating (instead of server-side-only) is accepted for `/admin` pages. | `apps/web/components/AdminDashboardClient.tsx` |
| #596 (`docs/accepted-risks.md:68-73`) | Wildcard `Access-Control-Allow-Origin: *` on `/api/verify/[hash]` is accepted (read-only public endpoint). | `apps/web/app/api/verify/[hash]/route.ts` |
| #596 (`docs/accepted-risks.md:75-80`) | Use of `dangerouslySetInnerHTML` with server-rendered SVG is accepted (input is fully server-generated). | `apps/web/app/u/[handle]/page.tsx` |
| #685 (`docs/accepted-risks.md:105-111`) | Cron fail-open when `CRON_SECRET` is unset (dev/preview environments) is accepted. | `apps/web/app/api/cron/warm-cache/route.ts`, `process-campaigns/route.ts`, `sync-audience/route.ts` |
| (`docs/accepted-risks.md:151-156`) | Solo/collaborative boundary value (ratio `= 0.15` counts as collaborative) is accepted. | `packages/shared/src/constants.ts:43` (`SOLO_REVIEW_RATIO_THRESHOLD = 0.15`), `apps/web/lib/impact/v6.ts:253` |

No finding in this document disputes any item above. The HMAC-length observation in §3.2 below explicitly excludes the truncation question.

---

## 3. Principal Observations

Five areas where code behavior diverges from either documentation, claim, or structural expectation. Observations only — no remediation.

### 3.1 `/api/telemetry` accepts unauthenticated writes keyed on client-supplied `targetHandle`

**Files:** `apps/web/app/api/telemetry/route.ts:7-69`, `apps/web/lib/validation.ts`, `apps/web/lib/db/telemetry.ts`

Observed:

- The handler has no call to `resolveRequestAuth`, no bearer-token check, no session check (`route.ts:7-69`).
- `targetHandle` and `sourceHandle` arrive from the client body (`route.ts:22-24`) and are persisted verbatim.
- Protections present: IP floor rate limit (60/IP/60s, `route.ts:45`), per-handle rate limit (10/targetHandle/60s, `route.ts:55`), payload shape validation via `isValidTelemetryPayload` (`route.ts:17`).
- The DB insert is fire-and-forget: `void dbInsertTelemetry(payload)` (`route.ts:65`). Any insert failure is swallowed.
- Handler always responds `{ ok: true }` even when the background insert fails (`route.ts:68`).

What this means in terms of current state: any internet client can persist telemetry rows attributed to an arbitrary GitHub handle at up to 10 rows/handle/minute, floored at 60 rows/IP/minute. The write path is not cryptographically bound to a CLI install. This observation does not appear in `docs/accepted-risks.md`.

### 3.2 Badge verification primitives (excluding the accepted 128-bit truncation)

**Files:** `apps/web/lib/verification/hmac.ts:1-55`, `apps/web/app/api/verify/[hash]/route.ts`

Observed (with the 128-bit truncation at `hmac.ts:35` specifically excluded per accepted-risks #401):

- **Silent `null` return when `CHAPA_VERIFICATION_SECRET` is unset.** `generateVerificationCode` (`hmac.ts:43-51`) returns `null` if the env var is missing, with no log, no throw, no telemetry emission. `CLAUDE.md` lists `CHAPA_VERIFICATION_SECRET` as "required for /api/verify" but the code does not enforce it at boot or at call-time.
- **Payload coverage vs. product claim.** `buildPayload` (`hmac.ts:14-28`) includes: `handle`, `adjustedScore`, `archetype`, `confidence.score`, each dimension via `Math.round()`, `stats.commitsTotal`, `stats.prsMergedCount`, `stats.reviewsSubmittedCount`, `yyyymmdd`. It **does not** include `stats.reposContributed`, `stats.activeDays`, `impact.dimensions.craft`, `batchSizeScore`, or any linked-platform fingerprint. Two days with identical rounded dimensions + identical commits/PRs/reviews but different repos-contributed or different craft sub-components produce the same hash.
- **Redundant `Math.round()` on dimensions.** `hmac.ts:20-23` rounds each dimension before hashing; the scoring layer (`apps/web/lib/impact/utils.ts` `clampScore`) already returns integer 0-100 values, so the round is a no-op today. If `clampScore` ever returns fractional values, collision surface widens without the hash changing its shape.
- **Non-timing-safe DB lookup on verify.** `/api/verify/[hash]/route.ts` performs a Supabase `select … eq('hash', …)`. The DB index lookup is not guaranteed timing-safe. The hash itself is handled as a bare string — not compared via `crypto.timingSafeEqual`.

### 3.3 `burst_activity` confidence penalty: JSDoc and implementation disagree by 5×

**File:** `apps/web/lib/impact/utils.ts`

Observed:

- JSDoc table for `computeConfidence` at `utils.ts:83` documents: *"`burst_activity` | -15 | >= 20 commits in a 10-minute window"*.
- Implementation at `utils.ts:124` reads: `if (stats.maxCommitsIn10Min >= 100) { … score -= 15; }`.
- `stats.maxCommitsIn10Min` is computed in `apps/web/lib/github/stats.ts` and aggregated through `packages/shared/src/stats-aggregation.ts`; the field name implies a 10-minute bucket but its derivation is via daily counts upstream.

The two numbers (20 vs. 100) differ by 5×. Only one of the two sources matches intended behavior; which one is not determinable from code alone. This is not listed in `docs/accepted-risks.md`.

### 3.4 Cache keys have no algorithm/schema-version axis

**Files:** `apps/web/lib/cache/snapshot-cache.ts:19` (`snapshot:latest:${handle}`), `apps/web/lib/cache/craft-cache.ts:17` (1-hour TTL), `apps/web/app/u/[handle]/badge.svg/route.ts:1-122`

Observed:

- Snapshot cache key shape: `snapshot:latest:{handle}` (`snapshot-cache.ts:19`). No scoring-version, no schema-version, no flag-version suffix.
- Snapshot TTL is 24h (per `CLAUDE.md` cache rules). Craft sub-component cache TTL is 1h (`craft-cache.ts:17`).
- `/api/insights` POST (`apps/web/app/api/insights/route.ts`) invalidates the craft cache on upload but does not invalidate the composite snapshot cache that may embed an already-computed craft value.
- Badge SVG route cache key (`badge.svg/route.ts`) keys on `handle` + `theme` + day; it does not key on a render-version constant.

Consequence of current state: a scoring-algorithm deploy does not cause a cache key miss; the 24h TTL is the sole rotation mechanism. An insights upload produces a fresh `craft` value on next compute but any composite snapshot cached in the last 24h continues to serve the older composite.

### 3.5 Admin API surface: three endpoints with distinct blast-radius shapes

**Files:** `apps/web/app/api/admin/bulk-recalculate/route.ts:1-124`, `apps/web/app/api/admin/campaigns/[id]/test/route.ts:1-129`, `apps/web/app/api/admin/agents/run/route.ts:1-307`

Observed:

- **`bulk-recalculate`** (`bulk-recalculate/route.ts:54-115`): accepts `{ handles: string[] }` or "all users". No explicit `handles.length` ceiling in the route. Processes in batches of 5 inline within the HTTP request. Vercel's 300-second function ceiling applies without an explicit timeout guard.
- **`campaigns/[id]/test`** (`campaigns/[id]/test/route.ts:1-129`): sends a test email via Resend. Auth-gated via admin session, but contains no `rateLimit()` call. No per-recipient cooldown.
- **`agents/run`** (`agents/run/route.ts:98-112`): builds a child-process command from `AGENTS[agentKey].scriptName`, where `AGENTS` is a **hardcoded object in the same file**. Path assembly: `join(projectRoot, \`scripts/${agentConfig.scriptName}.sh\`)`. Current keys are a closed set controlled by code; injection surface depends on that invariant holding.
- All three accept either an admin session (`ADMIN_HANDLES` whitelist match) or a bearer `ADMIN_SECRET` (`lib/auth/admin.ts`). Comparison of the bearer uses `crypto.timingSafeEqual` (verified at `lib/auth/admin.ts`).

---

## 4. Defects and Anomalies

Split into **Confirmed** (reproducible from code alone) and **Plausible — Needs Runtime Validation** (depends on runtime behavior this audit did not exercise).

### 4A. Confirmed defects

| # | Area | Observation | File:line |
|---|------|-------------|-----------|
| B1 | Scoring | Median uses `Math.floor(n/2)` and returns the lower element for even-length arrays; biases "evenness" and PR lead-time median toward the lower value. | `apps/web/lib/impact/heatmap-evenness.ts:46`; `packages/shared/src/stats-aggregation.ts:96` |
| B2 | Scoring | Week coverage = `activeWeeks / Math.ceil(days/7)`. A 7-day window where the user is active all 7 days produces `activeWeeks=1 / ceil(7/7)=1 = 1.0`, i.e. perfect consistency from a single week of data. | `apps/web/lib/impact/heatmap-evenness.ts:79-82` |
| B3 | Scoring | `aggregateWeeklyTotals` buckets by `Math.floor(i/7)` (positional index), not calendar week. The heatmap's week-zero alignment depends on the source array's first day being a Sunday. | `apps/web/lib/impact/heatmap-evenness.ts:8-15` |
| B4 | Scoring | Recency cutoff uses local-midnight (`setHours(0,0,0,0)`) while heatmap dates are stored as UTC ISO strings. Request-time TZ offset can produce a ±1-day drift at day boundaries. | `apps/web/lib/impact/recency.ts:16-19` |
| B5 | Auth | OAuth callback clears the `oauth_state` cookie on success but does not mark the state value as consumed in any server-side store. Within the 10-minute cookie TTL, the same state value is structurally re-submittable if the callback partially fails before the cookie is cleared. | `apps/web/app/api/auth/callback/route.ts:81-169` |
| B6 | Auth | Bearer-token extraction does `header.slice(7)` with no `.trim()`, contrary to the project-wide env-var trim rule in `CLAUDE.md:Environment Variable Safety`. | `apps/web/lib/auth/resolve-request-auth.ts` (bearer branch) |
| B7 | Data | `mapCampaignRow` / `mapSendRow` take `any` and return typed objects without going through the `parseRow` Zod validation used in sibling `lib/db/*` modules. | `apps/web/lib/db/campaigns.ts:51`, `:73` |
| B8 | Data | `dbUpdateCampaign` accepts any string for `status`; no whitelist enforcement of the allowed state machine. | `apps/web/lib/db/campaigns.ts:196-253` |
| B9 | Data | Daily email-quota check and `incrementDailyQuota` are two separate Redis calls in `sendCampaignBatch`; not atomic. | `apps/web/lib/email/campaigns.ts:131-138` |
| B10 | Data | `resend.batch.send` result handling treats a non-null `error` as a total-batch failure; partial-success shapes are not discriminated. | `apps/web/lib/email/campaigns.ts:180-202` |
| B11 | Data | `MetricsSnapshot.capturedAt` is set in app code as `new Date().toISOString()`; not driven by a Postgres `DEFAULT now()` column default. | `apps/web/lib/history/snapshot.ts:20` |
| B12 | Render | `RadarChart` does not special-case the all-zero dimension case — polygon collapses to the chart center point. | `apps/web/lib/render/RadarChart.ts:71-76` |
| B13 | Render | `GET /u/[handle]/og-image` does not call `rateLimit()`. Each request triggers the SVG→PNG path via `resvg`. | `apps/web/app/u/[handle]/og-image/route.ts:1-98` |
| B14 | Admin | `/api/cron/warm-cache` returns the full processed-handles list in its JSON response. | `apps/web/app/api/cron/warm-cache/route.ts:188-208` |
| B15 | Security | `/api/health` response includes `githubRateLimit.{limit, remaining, reset}` for unauthenticated callers. | `apps/web/app/api/health/route.ts:85-99` |
| B18 | Auth | `NEXTAUTH_SECRET` is read and used without a length-minimum assertion at boot. | `apps/web/lib/auth/session.ts` (`getSessionKey`) |

### 4B. Plausible — needs runtime validation

| # | Area | Observation | File:line |
|---|------|-------------|-----------|
| B16 | Security | `/api/webhooks/resend` passes the payload's `emailId` into a Resend-SDK fetch-by-id helper without an additional format check. Exploitability depends on the SDK enforcing ID shape downstream — not determinable from this repo's code. | `apps/web/app/api/webhooks/resend/route.ts:78-93` |
| B17 | Security | CLI device-auth `sessionId` is a bare UUIDv4 persisted in Redis with a 5-minute TTL. `/api/cli/auth/poll` accepts the raw UUID and returns approval state. Whether brute-force is prevented depends on the live rate-limit tier that applies to the poll route, which was not exercised at runtime. | `apps/web/app/api/cli/auth/poll/route.ts:25-26` |

### Not-a-defect items verified during the audit

- `/api/studio/config` GET/PUT is scoped exclusively to the session owner: both read (`route.ts:33`) and write key on `cacheGet<BadgeConfig>(\`config:${session.login}\`)`. No cross-handle access surface.
- `ADMIN_SECRET` comparison uses `crypto.timingSafeEqual` (`lib/auth/admin.ts`).
- Supabase service-role key is only imported from `lib/db/*` server modules; no `NEXT_PUBLIC_` prefix and no client-bundle import path.
- `cacheIncr` relies on Upstash atomic `INCR`, which is safe for the single-key counter use case (`lib/cache/redis.ts`).

---

## 5. Performance Observations

- **Campaign stats aggregation is client-side over every send row.** `dbGetCampaignStats` fetches `campaign_sends` rows and tallies statuses in JavaScript (`apps/web/lib/db/campaigns.ts:425-463`). The `SELECT` has no `LIMIT`. Cost scales linearly with send volume per campaign.
- **Supabase fallback in feature flags is unbounded.** `getFeatureFlag` falls back to Supabase on Redis miss without a `withTimeout` guard (`apps/web/lib/db/feature-flags.ts:72-105`). A slow Postgres query holds the caller for the driver's default timeout.
- **Tool-insights payload has no byte cap.** `isValidInsightsUpload` (`apps/web/lib/validation.ts`) validates shape, not byte length. `tool_insights.raw_data` is `jsonb` with no server-side size enforcement visible from the migration files.
- **Supabase client instantiation pattern.** `apps/web/lib/db/supabase.ts` constructs a client on call. Memoization across warm invocations depends on module-singleton semantics in the Next.js serverless runtime — not explicitly cached.
- **Badge SVG concurrent render.** Two parallel cold-cache requests for the same `{handle, date, theme}` both render the SVG and both reach the verification-store write path. `cacheSetNx` guards the DB insert but not the upstream render cost. `apps/web/app/u/[handle]/badge.svg/route.ts:1-122`.
- **Warm-cache response verbosity.** See §4A B14.

Bundle size and Core Web Vitals were not measured in this research pass.

---

## 6. Structural / Maintainability Observations

- **Scoring thresholds are scattered across modules.** Burst threshold (`apps/web/lib/impact/utils.ts:124`), lead-time caps 4/48/168 hours (`apps/web/lib/impact/v6.ts`), batch-size default 0.3 (`apps/web/lib/impact/v6.ts`), tier thresholds 85/70/30 (`apps/web/lib/impact/v6.ts`) live as inline numeric literals rather than in a shared constants module. `packages/shared/src/constants.ts` exists and holds `SOLO_REVIEW_RATIO_THRESHOLD` at line 43 but is not used by these other thresholds.
- **Row-mapping inconsistency in `lib/db/*`.** Most modules (`lib/db/snapshots.ts`, `lib/db/users.ts`, `lib/db/telemetry.ts`) use `parseRow` for row validation; `lib/db/campaigns.ts:51,73` uses `any`-typed mappers.
- **`void fn().catch()` fire-and-forget pattern recurs without a common helper.** Instances: `apps/web/app/api/telemetry/route.ts:65`, `apps/web/lib/email/campaigns.ts` (campaign send), `apps/web/app/api/notifications/unsubscribe/route.ts`. Each catches (or drops) errors independently.
- **Dimension-color palette is defined in three places.** `docs/design-system.md` (table), `apps/web/styles/globals.css` (`@theme` tokens), and `apps/web/lib/render/theme.ts` (TS constants).
- **Admin-auth has two shapes.** Session + `ADMIN_HANDLES` whitelist is used by `/api/admin/users`; `ADMIN_SECRET` bearer is used by `/api/admin/stats` and `/api/admin/bulk-recalculate`. `lib/auth/admin.ts` supports both; selection is per-route.

---

## 7. Test Coverage Observations

Tests exist and are carefully written — golden impact profiles, non-accusatory-messaging assertions on confidence messages, boundary tests around solo threshold.

Observed gaps:

1. **End-to-end scoring pipeline coverage is partial.** `apps/web/lib/impact/pipeline.test.ts:1-76` contains two `it` blocks — at line 17 (*"all fields survive aggregation → merge → scoring → snapshot"*) and at line 49 (*"v2.5.0 regression: solo quality survives multi-platform merge"*). These cover `aggregate → merge → score → snapshot`. They do **not** exercise `buildPayload` / `computeHash` / `generateVerificationCode` or the DB-side verification-record write. Raw GraphQL → final on-disk verification record is not covered in a single test.
2. **No test for the missing-secret path in `generateVerificationCode`.** Neither `apps/web/lib/verification/hmac.test.ts` nor the wider test suite asserts what happens when `CHAPA_VERIFICATION_SECRET` is unset.
3. **No test asserts that insights upload invalidates the snapshot cache.** (Because the current implementation does not invalidate it — see §3.4.)
4. **No test for concurrent badge render.** Deterministic under serial test execution.
5. **No route-level test covers `/api/telemetry` authentication semantics.** (Because the route has no authentication — see §3.1.)
6. **No test for `resend.batch.send` partial-failure response shapes.** The Resend SDK's response shapes are not mocked for the partial-ok case.
7. **No HMAC golden-vectors fixture** for cross-version migration testing.

---

## 8. Items Explicitly Validated Against the Accepted Risks Contract

Restated from §2 with the code pointer and the accepted-risks pointer for each, so a reader can re-verify that no in-scope finding contradicts the contract:

- HMAC 128-bit truncation (`hmac.ts:35`) — **accepted** (`docs/accepted-risks.md:39-44` / #401). Not flagged.
- Redis rate-limit fail-open (`lib/cache/redis.ts`) — **accepted** (`docs/accepted-risks.md:21-25` / #398). Not flagged.
- Component-level admin gate — **accepted** (`docs/accepted-risks.md:46-51` / #402). Not flagged.
- Verify-endpoint wildcard CORS — **accepted** (`docs/accepted-risks.md:68-73` / #596). Not flagged.
- Share-page `dangerouslySetInnerHTML` with server-rendered SVG — **accepted** (`docs/accepted-risks.md:75-80` / #596). Not flagged.
- Cron fail-open when `CRON_SECRET` unset — **accepted** (`docs/accepted-risks.md:105-111` / #685). Not flagged.
- Solo/collaborative boundary at `ratio = 0.15` classified as collaborative (`packages/shared/src/constants.ts:43`, applied at `apps/web/lib/impact/v6.ts:253`) — **accepted** (`docs/accepted-risks.md:151-156`). Not flagged.

---

## 9. Open Questions Surfaced by the Research (Not Resolvable From Code Alone)

These are questions a subsequent `/plan` phase would need to answer; they are recorded here so they are not lost between phases.

1. **§3.3 — `burst_activity` threshold.** Which of the two values (JSDoc's 20 or code's 100) reflects intended policy?
2. **§3.2 — verification payload coverage.** Is the omission of `stats.activeDays`, `stats.reposContributed`, `impact.dimensions.craft`, and linked-platform fingerprint intentional, or a leftover from an earlier dimension set?
3. **§3.1 — `/api/telemetry`.** Is this endpoint *intentionally* unauthenticated (e.g., to support pre-auth first-run CLI telemetry), or was the auth check omitted unintentionally?
4. **§3.4 — cache versioning.** Is the 24h TTL considered sufficient rotation in place of a key-version suffix?
5. **§3.5 — admin blast radius.** Is `bulk-recalculate` expected to run inline within an HTTP request, or is out-of-band (queue-backed) execution planned?
6. **§4B B17 — CLI device-auth poll.** What rate-limit tier applies at runtime to `/api/cli/auth/poll`, and does it hold under sustained concurrent polling from a single IP range?
7. **Supabase RLS status.** RLS policy state is not verifiable from the migrations alone in this repo (no `CREATE POLICY` statements in the migrations dir reviewed). Is RLS considered out of scope because only the service role accesses the tables?
