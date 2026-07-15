# Pre-Launch Codebase Audit
> Generated on 2026-07-15 | Branch: `develop` | 8 parallel specialists
> Focus: comprehensive

---

## 1. Executive Summary

Chapa remains a well-engineered product: strict TypeScript, zero circular dependencies, zero dead exports, a mature and fast test suite (487 files / 8,339 tests, all green), and a genuinely strong application security posture (SVG escaping, encrypted sessions, CSRF double-layer, timing-safe comparisons, centralized ownership gating). The scoring pipeline — historically the source of the project's worst shipped bugs — is deeply tested at exact boundary values and backed by a real-pipeline regression contract for the degraded-fetch guard. None of that changed for the worse since the last audit (2026-06-25); if anything the #1001–#1004 hardening cycle closed real gaps.

What's new and serious this cycle is operational, not architectural: **the CI dependency-audit gate is silently scanning zero packages** (npm's legacy audit endpoint was retired), and an in-flight, uncommitted fix in the working tree (`--ignore-registry-errors`) makes the job pass without ever evaluating an advisory — two independent specialists (DevOps and Security) found this without coordinating. Because `pnpm audit` is a **required check on `main`**, this mechanically blocks the `develop → main` release PR today. That single, narrow, S-effort fix is the entire reason this audit cannot say READY.

Beyond that blocker, four high-severity findings deserve attention before launch: a durable write on the highest-volume request path silently discards its failure signal (no alerting), a proactive-warm-cache ceiling of 50 handles/day will start degrading freshness and history the moment user count crosses that line, Supabase migrations have no automated pre-deploy enforcement, and the i18n architecture's root cause (whole-page client-side translation) is flagged as high but is intentionally scoped to *after* launch — it's a real cost, not an emergency.

**Top 3 strengths:**
1. **Test discipline holds under scrutiny.** 8,339 tests pass in ~32s; every API route has a colocated test; the #1004 degraded-fetch guard has a genuine end-to-end contract test against real Postgres/Redis, not just a unit test of the guard in isolation (QA verified this claim directly rather than trusting the docs).
2. **Application security is sound.** Independent review of OAuth, session handling, SVG XSS escaping, admin gating, and injection surfaces found no exploitable app-level issues — this audit's security findings are entirely in CI tooling configuration, not product code.
3. **Architectural hygiene is real, not aspirational.** Zero circular deps, zero unused exports (knip clean), the `@chapa/shared` boundary and `no-process-env` rule both hold (with one narrow enforcement gap, AR-M2) — these are commonly-neglected gates that are actually enforced here.

**Top 5 risks (blast-radius order):**
1. **DO-B1 / SE-M1** — `pnpm audit` is a no-op (scans zero packages) and is a required check on `main`; the working-tree fix in flight makes this worse, not better, by making the no-op permanent and silent.
2. **BE-H1** — The public badge route's durable snapshot write (the single highest-volume write in the product) can fail with zero operational alert, unlike every other write endpoint in the codebase.
3. **PE-H1** — Warm-cache proactively covers only 50 handles/day; past that ceiling, badge latency and lifetime-history completeness both degrade for the long tail, right as a launch would push past it.
4. **DO-H1** — Supabase migrations are manual with no CI enforcement; a hotfix can ship code against an unapplied migration and 500 on legal input.
5. **FE-H1** — The entire content surface hydrates as client components to support i18n, which is the structural cause of both hydration weight and the documented locale-flash; scoped After launch by design, but it is the single highest-leverage frontend fix available.

**Verdict: NOT READY** — one launch-blocker (DO-B1) exists and must clear before a `develop → main` PR can even merge. This is a narrow, S-effort CI-configuration fix, not a sign of product instability — once it lands, the picture is CONDITIONAL-grade: 4 high-severity items, all with clear S/M fixes, remain Before-launch alongside 12 medium items. Total Wave 1 effort is modest; nothing here suggests a deep rework.

---

## 2. System Architecture Overview

Chapa is a pnpm monorepo: `apps/web` (Next.js 16 App Router, React 19, TypeScript, strict mode) and `packages/shared` (pure scoring/stats/format primitives, consumed only through the `@chapa/shared` alias — zero relative-path imports, CI-enforced). The architectural spine is a data-transformation pipeline: four platform integrations (`lib/github`, `lib/bitbucket`, `lib/codeberg`, `lib/gitlab`) each normalize provider data into a canonical `StatsData` shape, which feeds the pure `lib/impact/*` scoring engine (`computeImpactV6`) and the `lib/render/*` SVG pipeline. Cross-cutting infrastructure lives in `lib/cache` (Upstash Redis), `lib/db` (Supabase), `lib/env.ts` (the single sanctioned `process.env` reader), and `lib/i18n`. The recent shared-aggregation refactor (`platform-stats.ts`) unified invariant computation across three of the four platform clients, guarded by a cross-platform parity test — GitHub's own aggregation still duplicates this logic outside the parity test's reach (AR-M1).

Module boundaries are enforced in CI via `madge` (zero circular deps confirmed), a `no-restricted-imports` rule, and a `no-restricted-syntax` env-access rule (with one enforcement gap, AR-M2). Baseline code health is strong: clean typecheck across the workspace, zero unused files/exports/dependencies (knip), minimal escape hatches (0 `as any`, 13 lint/ts disables, 3 TODOs across the whole app).

**Architecture concerns (systemic, cross-specialist):**
- **Duplicated logic outside test reach** — GitHub's stats aggregation (AR-M1) and the parallel `Navbar`/`NavbarClient` implementations (FE-M2) are both cases where the same logic exists twice with no mechanism to catch drift.
- **The i18n design trades RSC benefits for correctness** — client-side-only translation (FE-H1) is a deliberate, documented choice (to fix a prior locale bug) whose cost is now paid on every content page. This is the single most consequential architectural trade-off surfaced this cycle.
- **The write-path durability contract is inconsistently applied** — CLAUDE.md's "every durable write failure must be observable" rule holds on most write endpoints but has a gap on the highest-volume one (BE-H1), and the reconciliation saga meant to enforce it is narrower than its own documentation claims (BE-M1, BE-M2).

---

## 3. End-to-End Flow Analysis

**Key flow: public badge request (`GET /u/[handle]/badge.svg`)** — the hottest path in the product, with an explicit p95 SLO (800ms hit / 3000ms miss) enforced via a `Server-Timing` header. Request flow: SVG cache read (Redis, 24h+jitter, 250ms deadline) → on miss, rate limit → render-lock coalescing → `materializeProfile` (parallel Redis/Supabase lookups via `Promise.allSettled`) → `getStats` (cache-first, 6h primary/7d stale, degraded-fetch guard #1002/#1004) → avatar fetch (up to 2s) → durable snapshot persist (currently synchronous, PE-M1) → render → SVG cache write → deferred side-effects via `after()`. Every stage in this chain was independently scrutinized by Backend (data integrity, write durability) and Performance (latency budget) specialists, and their findings compound: the 250ms Redis deadline (PE-M2) can convert what should be an 800ms cache-hit into a full 3000ms-budget cache-miss recomputation under exactly the load conditions a launch produces, while the render-lock loser path (PE-M3) can burn 2 seconds polling before falling through to the same expensive path anyway on a genuinely cold (new) handle.

**Key flow: score persistence (write side)** — `reconcileSnapshotWrite` is the single saga meant to keep Supabase (durable) and Redis (hot mirror) consistent across every producer: the public badge route's `after()`, the warm-cache cron, and deliberate user actions (`/api/recalculate`, CLI supplemental upload). Backend's review found the saga's guarantee is narrower than documented — it can't distinguish a benign insert-mode duplicate from a genuine write failure (BE-M2), and has no defense against concurrent last-writer-wins races across its multiple producers (BE-M1) — while the public path specifically discards the saga's own failure signal instead of escalating it (BE-H1). Three specialists (BE, DO, QA) converged on this single subsystem from different angles, which is a strong signal it's the most load-bearing piece of new logic to get right before launch.

**Integration and boundary risks:** the four-platform OAuth surface (GitHub/Bitbucket/Codeberg/GitLab) is consistent in the security-critical dimensions (CSRF, token encryption) but inconsistent in rate-limit posture (BE-M3: three of four use fail-open where policy calls for fail-closed) and CSRF replay-resistance depth (SE-L1: only GitHub has single-use nonce consumption). Both are narrow, bounded-impact gaps rather than exploitable holes today, but they're exactly the kind of cross-provider drift that compounds as more platforms are added.

---

## 4. Frontend / UI Findings (Staff Frontend Engineer)

### Domain Model

Chapa is a Next.js App Router application. Entry points: the highest-traffic public routes (`/`, `/u/[handle]`, `/about/*`, `/archetypes/*`, `/verify`, `/privacy`, `/terms`) are ISR/static (`force-static` + `revalidate = 3600`), while auth-gated routes (`/studio`, `/admin`, `/verify/[hash]`) are `force-dynamic` and read `headers()`/session server-side. The root `layout.tsx` renders statically at `DEFAULT_LOCALE` ('es'); each translatable page is a thin static server `page.tsx` that delegates the entire body to a `"use client"` `*PageClient` component using `useTranslation()`. Session is fetched client-side through a module-cached `useSession()` hook; owner-only share-page content and the command bar are code-split via `next/dynamic`. State management is reasonably consistent: React context for i18n/theme/flags, module-level singleton stores for session and keyboard shortcuts.

### Findings

#### FE-H1 i18n client-context translation forces `"use client"` at the root of every content page
- **Severity:** high
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/about/AboutPageClient.tsx:1, apps/web/app/about/scoring/ScoringMethodologyClient.tsx:1 (411 lines), apps/web/app/archetypes/_components/ArchetypePageClient.tsx:1, apps/web/app/privacy/PrivacyPageClient.tsx:1, apps/web/app/terms/TermsPageClient.tsx:1, apps/web/app/LandingPageClient.tsx:1, apps/web/lib/i18n/provider.tsx:30-48
- **What's happening:** Translation is only available through the client `useTranslation()` context. Because content is translatable, every content page pushes its *entire* body into a `"use client"` `*PageClient` component. The server `page.tsx` is a thin static wrapper — the "proven /about pattern" the landing-page refactor (767c1a3e) deliberately propagated to fix the reverted locale bug (2e5dbbe7). The result: large, purely-static marketing/legal markup (e.g. the 411-line scoring methodology page, all archetype essays) ships as client component code and must be fully hydrated, even though none of it is interactive beyond nav/command-bar leaves.
- **Why it matters:** This is the systemic root cause behind three separate symptoms: (1) inflated client JS / hydration cost on the highest-traffic routes, (2) the documented non-default-locale "flash" (Spanish HTML paints, then re-renders to English post-hydration), and (3) FE-M1 below. This is the single highest-leverage structural issue in the frontend.
- **Recommendation:** Move to a locale-segmented route model (`/[locale]/...`) or a middleware rewrite that lets the server render the correct locale, so content pages can stay React Server Components, shipping near-zero JS and hydrating only genuinely-interactive leaves.
- **Regression risk:** A locale segment changes URL shape — canonical URLs, sitemap, OG `alternates`, and the `chapa-locale` cookie precedence must be reconciled, and existing shared `/u/handle` links (no locale prefix) must continue to resolve. Must preserve ISR cacheability — a naive `cookies()` read reintroduces `force-dynamic`, exactly what the prior revert thrashed on. Any migration needs the full-page-translation invariant asserted in a render test before/after.
- **Expected impact:** Content pages become server-rendered HTML with minimal JS; locale flash disappears.
- **Effort estimate:** XL

#### FE-M1 `?lang=` query param sets a cookie but never applies the locale on the current load
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/i18n/locale-sync.tsx:7-14, apps/web/lib/i18n/set-locale-action.ts:6-10, apps/web/lib/i18n/provider.tsx:89-107, apps/web/app/LandingPageClient.tsx:77-88, apps/web/app/u/[handle]/page.tsx:94
- **What's happening:** `LocaleSync` only calls `setLocaleAction(queryLang)`, which writes the cookie and `revalidatePath`. It never calls the provider's `setLocale`. The `LanguageProvider` reads the cookie only in a run-once mount effect that executes before the async server action resolves and never re-runs. Net effect: loading `/u/foo?lang=en` leaves the visible language unchanged on that load — it only takes effect on a later hard reload. The unit test asserts `setLocaleAction` was *called*, not that the locale visibly changed.
- **Why it matters:** `?lang=` is the only shareable-link language mechanism in the app. A Spanish user sharing an English link silently shows the wrong language on first paint.
- **Recommendation:** Have `LocaleSync` apply the locale to the live provider immediately. Strengthen the test to assert the rendered locale, not just the cookie write.
- **Regression risk:** Must not double-write the cookie or cause a refresh loop when the query lang already equals the active locale. Must not reintroduce a `searchParams` read into the static landing page.
- **Expected impact:** Shared/deep language links work on first paint.
- **Effort estimate:** S

#### FE-M2 Duplicate `Navbar` (server) and `NavbarClient` implementations have drifted
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/components/Navbar.tsx:21-79, apps/web/components/NavbarClient.tsx:29-97
- **What's happening:** Two parallel navbars exist. `Navbar` (server) computes admin status as `isAdminHandle(session.login)`; `NavbarClient` takes it from `session.isAdmin` off the client session payload. Center-nav-link logic also diverges between the two.
- **Why it matters:** Any nav change must be made twice and is easy to make in only one. If `session.isAdmin` and `isAdminHandle()` ever disagree, admin-only nav affordances appear inconsistently depending on which page you're on.
- **Recommendation:** Extract shared markup into one presentational `NavbarShell` taking `{ session, isAdmin, navLinks, t }` as props; unify the admin-status source of truth.
- **Regression risk:** The two navbars intentionally differ in how they obtain session (server `headers()` vs client fetch) to preserve ISR — the shared shell must stay agnostic to that. `suppressHydrationWarning` on the client nav must be retained.
- **Expected impact:** One nav to maintain; consistent admin affordances.
- **Effort estimate:** M

#### FE-M3 Typed-accessor refactor is incomplete — validated `tArray`/`tObject` coexist with dozens of raw `as string[]` casts
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/i18n/typed-accessors.ts:14-36, apps/web/app/about/AboutPageClient.tsx:23, apps/web/app/archetypes/_components/ArchetypePageClient.tsx:29-40, apps/web/app/about/scoring/ScoringMethodologyClient.tsx:170-321 (11 sites), apps/web/app/about/verification/VerificationPageClient.tsx:186,280
- **What's happening:** The `tArray`/`tObject` refactor (structurally validates and degrades gracefully on shape mismatch) was applied in only 5 files. At least ~15 call sites still use the old unchecked `t(key) as string[]` pattern, several in the very same files that partially adopted the new helper.
- **Why it matters:** The refactor's safety net — a malformed translation key degrading gracefully instead of crashing on `.map()` — is illusory when half-applied.
- **Recommendation:** Finish the migration to `tArray`/`tObject` everywhere; add a grep-based CI check forbidding `as string[]` directly on a `t(` call.
- **Regression risk:** `tArray` returns `[]` on mismatch where the raw cast previously threw — verify no call site depends on a throw for control flow (none observed).
- **Expected impact:** Uniform, fail-soft i18n access; malformed keys can't crash a page.
- **Effort estimate:** S

#### FE-L1 Share-page owner dashboard fetches trend data client-side, creating a post-hydration waterfall
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** apps/web/components/dashboard/ImpactDashboard.tsx:33, apps/web/hooks/useTrendData.ts:1-50, apps/web/components/SharePageOwnerContentLazy.tsx:7-10
- **What's happening:** The share page streams a shell, hydrates, lazy-loads the owner content, which then client-fetches trend data — a three-step chain for data already available server-side.
- **Why it matters:** Adds a client round-trip and layout shift for score-trend UI on every share view.
- **Recommendation:** Fetch trend/diff in the server component and pass down as props.
- **Regression risk:** Server-fetching trend must stay ISR-safe and tolerate an empty/unavailable history store without failing the page render.
- **Expected impact:** Trend renders with the page; one fewer client fetch.
- **Effort estimate:** M

#### FE-L2 NavbarClient renders logged-out state into static HTML, then swaps after a client session fetch
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [inference]
- **Files:** apps/web/components/NavbarClient.tsx:29-45,77-92, apps/web/hooks/useSession.ts:74-101
- **What's happening:** On ISR pages the static HTML necessarily contains the logged-out nav; the nav swaps to `UserMenu` after the client session fetch resolves.
- **Why it matters:** Minor perceived-polish issue; every returning authenticated user sees a brief "login" flash in the nav.
- **Recommendation:** Accept as-is, or reserve nav-slot space and hide it until `loading` resolves to avoid CLS.
- **Regression risk:** Hiding the slot risks CLS if width isn't reserved; must keep `suppressHydrationWarning`.
- **Expected impact:** No auth-state flash in nav.
- **Effort estimate:** S

### Cross-Domain Notes
- **PE:** FE-H1 is the structural cause of content-page client-JS weight and whole-page hydration. FE-L1's client fetch waterfall also affects share-page interaction timing.
- **UX:** FE-L2 and the documented locale-flash (FE-H1) are visible-polish items with code-structure causes.
- **BE:** FE-M2's admin-status divergence touches the session/admin contract — confirm `/api/auth/session`'s `isAdmin` is authoritative.
- **QA:** FE-M1 and FE-M3 both have tests that assert the mechanism, not the user-visible outcome — a pattern worth a broader test-adequacy sweep.

---

## 5. Backend / API / Data Findings (Staff Backend Engineer)

### Domain Model

Chapa's backend is a Next.js App Router API surface (~50 `route.ts` handlers) fronting Supabase Postgres (durable) and Upstash Redis (hot cache + rate limiting). The core write path is the profile pipeline: `materializeProfile` fetches merged multi-platform stats, computes Impact v6, and produces a `MaterializedProfile`; persistence flows through `persistOrchestratedSnapshot`/`persistProfileSnapshot` → `reconcileSnapshotWrite`, a two-store saga writing Supabase then mirroring to Redis. Write endpoints share a consistent shape: error-capture wrapper → auth → rate-limit → validation → durable write → cache invalidation. Data integrity against GitHub's token-scoped fetch collapse is enforced by a three-layer guard (fetch/cache/persist boundaries). Cron routes are `CRON_SECRET`-gated with Redis heartbeats. The write-registration CI gate currently passes: 33 discovered, 27 registered, 6 exempt, 0 unregistered.

### Findings

#### BE-H1 Public badge-path durable snapshot-write failures escape structured alerting
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/profile/public-profile.ts:95-143, apps/web/lib/db/snapshots.ts:251-257,289-295, apps/web/lib/profile/snapshot-write.ts:45-54
- **What's happening:** `persistProfileSnapshot` (runs on every cold public badge/share render) destructures `persisted` from `reconcileSnapshotWrite` but unconditionally `return true`, discarding the durable-write outcome. When the underlying write fails, the only trace is a `console.error` in the DB layer. Every explicit write endpoint (`/api/insights`, `/api/refresh`, `/api/recalculate`) escalates the same failure to `captureServerError`; the public path does neither.
- **Why it matters:** CLAUDE.md's invariant — "every durable write failure must be observable" — is technically met by `console.error` but inconsistent in practice. A systemic Supabase outage would fire zero operational alerts on the busiest write path while every low-volume endpoint pages.
- **Recommendation:** Thread the `persisted` boolean out and emit `captureServerError`/P2 `captureOperationalAlert` when `persisted === false` on the public path, matching the explicit-endpoint pattern. Keep the route graceful (still render the badge).
- **Regression risk:** Must not alert on the benign insert-mode dedup case (see BE-M1/BE-M2) — distinguish "duplicate/no-op" from "write threw" before escalating, or the webhook floods on every second badge hit for an already-snapshotted handle. Must stay fire-and-forget.
- **Expected impact:** A Supabase snapshot outage becomes visible to on-call within one cron/badge cycle instead of being invisible.
- **Effort estimate:** S

#### BE-M1 `reconcileSnapshotWrite` saga overstates its guarantee — blind to concurrent divergence and to insert-mode dedup
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/profile/snapshot-write.ts:40-86, apps/web/lib/db/snapshots.ts:233-258, apps/web/lib/profile/public-profile.ts:133-137
- **What's happening:** The saga only treats a cache-write failure as divergence. Two real gaps: (1) concurrent last-writer-wins — nothing serializes DB-write→cache-write per handle across the documented concurrent producers (supplemental upload + badge `after()` + refresh), so an interleaving can leave Supabase and Redis on different versions with no alert. (2) Insert-mode dedup conflation — `dbInsertSnapshot` returns `false` for a benign duplicate, which the saga's `if (!persisted)` reads as a failure, deliberately leaving the cache unrefreshed even if an earlier write's cache mirror had silently failed.
- **Why it matters:** The saga is presented as the reconciliation guarantee, but the two most likely divergence sources — write races and the common insert-dedup path — are exactly what it doesn't observe.
- **Recommendation:** Have `dbInsertSnapshot` return a tri-state (`inserted | duplicate | failed`) so the saga distinguishes benign dedup from true failure. Downgrade the header's documented guarantee language to match what it actually covers.
- **Regression risk:** A read-back compare adds a Redis round-trip — keep it off the public insert path (latency SLO) and only on `replace`. Changing the return type touches every persist caller; BE-M2's status-code semantics must be pinned first.
- **Expected impact:** Cache staleness after a partial write becomes self-correcting instead of sticky.
- **Effort estimate:** M

#### BE-M2 Insert-vs-duplicate detection hinges on PostgREST HTTP `status === 201`
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [inference]
- **Files:** apps/web/lib/db/snapshots.ts:241-250
- **What's happening:** `dbInsertSnapshot` returns `status === 201` to mean "inserted", `200` to mean "duplicate (ignored)" — coupling correctness to an undocumented PostgREST/supabase-js response detail. A supabase-js upgrade that changes the returned status would silently halt lifetime-history recording with no error thrown.
- **Why it matters:** A dependency bump could silently break all snapshot recording while all tests pass and no error surfaces.
- **Recommendation:** Use an explicit signal — `.upsert(..., {ignoreDuplicates: true}).select("id")` and treat a returned row as inserted / empty as duplicate, mirroring `dbReplaceSnapshot`'s existing pattern. Add a contract test against real/local Supabase asserting insert-then-duplicate yields `true` then `false`.
- **Regression risk:** Validate the `.select()` behavior against local Supabase before switching; keep the `UNIQUE(handle,date)` dedup semantics intact.
- **Expected impact:** Snapshot recording survives supabase-js upgrades.
- **Effort estimate:** S

#### BE-M3 Platform OAuth write routes use fail-open `rateLimit` while the primary GitHub callback uses fail-closed `rateLimitStrict`
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/auth/platform-oauth.ts:146,195,302, apps/web/app/api/auth/callback/route.ts:86, apps/web/lib/cache/redis.ts:212-248
- **What's happening:** The shared platform-OAuth factory rate-limits Bitbucket/Codeberg/GitLab connect/callback/disconnect with fail-open `rateLimit`; the primary GitHub callback uses fail-closed `rateLimitStrict`. The documented policy reserves fail-open for public reads and strict for auth/write routes — these four platform flows are auth+write.
- **Why it matters:** During a Redis outage, platform OAuth token-exchange/disconnect lose all rate enforcement. Impact is bounded (CSRF state and session auth still gate these), but it's an inconsistent application of the project's own stated policy.
- **Recommendation:** Switch the factory's limiters to `rateLimitStrict`.
- **Regression risk:** Fail-closed means an unconfigured/down Redis blocks OAuth linking entirely — confirm dev/local environments have Redis configured.
- **Expected impact:** Consistent, policy-compliant rate-limit posture across all auth/write OAuth routes.
- **Effort estimate:** S

#### BE-L1 `/api/challenge` reports success even when the dispute email fails, with only a `console.error`
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/challenge/route.ts:89-94
- **What's happening:** `sendChallengeEmail` failure is swallowed to `console.error`; the route still returns `{ success: true }`.
- **Why it matters:** A user who disputes their score believes it reached the team; a Resend outage drops disputes invisibly.
- **Recommendation:** On send failure, `captureServerError` at minimum so dropped disputes are countable; keep 200 since email is best-effort.
- **Regression risk:** Returning non-200 instead would change the client contract — capture-only avoids that.
- **Expected impact:** Dropped disputes become visible.
- **Effort estimate:** S

#### BE-L2 `/api/cron/process-campaigns` processes only the first active campaign per run
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/cron/process-campaigns/route.ts:27-29
- **What's happening:** The cron picks `active[0]` and processes one batch; a second concurrent campaign is starved until the first finishes across successive days.
- **Why it matters:** Low impact at current scale (admin-initiated), but an undocumented single-queue assumption.
- **Recommendation:** Document the "one active campaign at a time" invariant, or round-robin across active campaigns within the run budget.
- **Regression risk:** Multi-campaign processing must respect the shared daily send quota so a second campaign can't blow the Resend cap.
- **Expected impact:** Predictable multi-campaign behavior.
- **Effort estimate:** M

### Cross-Domain Notes
- **SE:** The CLI device-auth poll retains a documented residual (#953, already in accepted-risks) — worth confirming. `escapeIlike` correctly sanitizes the one interpolated PostgREST filter; no injection surface found elsewhere.
- **DO:** `warm-cache`'s 50-handle ceiling already self-alerts, but per-handle freshness degrades past it in a way the latency SLO won't catch — see PE-H1. `reconcileSnapshotWrite`'s P2 alert depends on `CHAPA_ALERT_WEBHOOK_URL` being configured in prod.
- **QA:** The three integrity guards are well-layered and tested end-to-end, but BE-M2's status-code detection and BE-M1's insert-dedup tri-state aren't covered by a test exercising a real PostgREST response.

---

## 6. Performance and Scalability Findings (Performance Engineer)

### Domain Model

The product's hottest path is `GET /u/[handle]/badge.svg`, a public embeddable route with an explicit p95 SLO (800ms hit / 3000ms miss) and a `Server-Timing` header. It reads a full-response SVG cache first (24h + per-handle 0–2h jitter). On miss it applies rate limiting, coalesces via an in-memory Map + Redis render-lock, then calls `materializeProfile`, which fires four Redis/Supabase lookups concurrently. `getStats` is cache-first (6h primary / 7d stale) with in-flight dedup and the degraded-fetch guards. The route awaits avatar fetch (2s cap), awaits a durable Supabase write, renders, writes the SVG cache, and defers side-effects via `after()`. Daily warm-cache cron (`MAX_HANDLES=50`, batches of 5, round-robin) is the only proactive warmer and primary daily-snapshot recorder. Client bundle is healthy: largest chunk 227 KB raw / 71 KB gzip vs the 350 KB budget.

### Findings

#### PE-H1 Warm-cache ceiling (50 handles/day) breaks proactive freshness and history snapshots at scale
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/cron/warm-cache/route.ts:34,37, apps/web/vercel.json, apps/web/lib/github/client.ts:17-18
- **What's happening:** A single daily cron warms at most 50 handles via round-robin rotation. At N users, any handle beyond the ceiling is proactively warmed once every `ceil(N/50)` days, while stats/SVG caches expire in 6–24h — so the request path serves cache misses for the long tail. `warmHandle` is also the primary recorder of the daily lifetime-history snapshot, so users past the ceiling get sparse, gappy history.
- **Why it matters:** A public launch is exactly the moment N crosses 50. Cold/less-popular badges degrade to full-materialize latency on every embed impression, and history charts silently develop gaps. The system already fires `warm_cache_ceiling_approached` at N≥50, confirming this is a known cliff.
- **Recommendation:** Run the cron more frequently (e.g. hourly, keeping `MAX_HANDLES=50` per run → 1200/day) and/or tier freshness by popularity. A single GraphQL call per handle keeps even 1200/day well within GitHub's 5000/hr authenticated budget. Decouple daily-snapshot recording from warm rotation so every user gets one snapshot/day regardless of warm coverage.
- **Regression risk:** More frequent crons multiply Supabase writes and GitHub calls — verify the failure-rate alert and rate-limit headroom hold at the new cadence. Don't raise `MAX_HANDLES` unboundedly — the function has `maxDuration=300` and could hit the wall.
- **Expected impact:** Proactive freshness for ~24× more users/day; eliminates history gaps; keeps cold-badge p95 in the cache-hit regime.
- **Effort estimate:** M

#### PE-M1 Durable Supabase snapshot write is on the badge cache-miss critical path, before render
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/u/[handle]/badge.svg/route.ts:304-310, apps/web/lib/profile/public-profile.ts:95-143
- **What's happening:** On every cache miss the route awaits `persistProfileSnapshot` before rendering and returning — a durable Supabase upsert sitting synchronously inside the 3000ms cache-miss budget, even though nothing in the response depends on its result.
- **Why it matters:** Supabase write latency (typically 50–250ms, worse under load) is charged directly to user-facing TTFB on the hottest path, avoidably.
- **Recommendation:** Move the entire persist+defer block into `after()`; keep render + SVG cache write on the request path.
- **Regression risk:** Verify a write failure inside `after()` is still captured/alerted (ties to BE-H1). Two concurrent cold misses reaching the write before either sets the dedup guard must stay tolerated by the existing `UNIQUE(handle,date)` constraint.
- **Expected impact:** Removes one blocking Supabase round-trip (~50–250ms) from every cache-miss badge response.
- **Effort estimate:** S

#### PE-M2 250ms Redis read deadline silently converts cache-HITs into full cache-MISSes under Redis tail latency
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/render/badge-svg-cache.ts:11,49-67, apps/web/app/u/[handle]/badge.svg/route.ts:193-198
- **What's happening:** The warm-SVG cache read has a 250ms timeout that returns `null` (treated as a miss) on breach. When Redis p99 latency exceeds 250ms — precisely during load spikes — a request that should be an 800ms cache-hit falls through to the full 3000ms cache-miss path.
- **Why it matters:** This couples failure modes: the moment Redis is slow (highest-traffic moments), the origin does maximally expensive work for requests whose data is already cached — a mini thundering-herd, and invisible in `Server-Timing`.
- **Recommendation:** Raise the read deadline, or add a second longer-deadline re-read on the miss branch before committing to materialize. At minimum, emit a distinct `Server-Timing` marker so this is distinguishable from a true miss.
- **Regression risk:** A longer deadline raises worst-case cache-hit latency toward the 800ms budget — keep it strictly below the SLO. Don't remove the fallback entirely (an unbounded Redis wait would hang requests during a real outage).
- **Expected impact:** Prevents hit→miss amplification under Redis latency.
- **Effort estimate:** S

#### PE-M3 Render-lock loser polls up to 2s and then still does a full materialize on cold handles
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [inference]
- **Files:** apps/web/app/u/[handle]/badge.svg/route.ts:39,238-277,279
- **What's happening:** A request that loses the render-lock and finds no stale SVG polls for up to 2000ms. If the winner hasn't written by then, execution falls through to a full materialize+render anyway — burning the poll time and then paying full cost, plausibly exceeding the 3000ms budget.
- **Why it matters:** This is precisely the concurrent-first-request-for-a-brand-new-handle case (viral share, new user's badge hit by many README loads at once) — the worst-case cold-start scenario gets the worst latency.
- **Recommendation:** On poll exhaustion with no stale entry, let the loser render immediately instead of waiting out the full schedule; measure actual winner render time to right-size the poll window.
- **Regression risk:** Letting losers render immediately trades duplicate CPU for lower tail latency — the in-memory Map + render-lock only coalesce per-instance, so N cold instances can each render once regardless.
- **Expected impact:** Bounds cold-handle concurrent-miss p99 under the 3000ms budget.
- **Effort estimate:** M

#### PE-L1 Avatar fetch (up to 2s) is awaited on the badge cache-miss critical path
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/u/[handle]/badge.svg/route.ts:299-301, apps/web/lib/render/avatar.ts:29-34
- **What's happening:** On a cache miss with a cold avatar cache, the route awaits the avatar fetch fully (up to 2s) before rendering, unlike the share page, which caps the same fetch at 250ms via `Promise.race`.
- **Why it matters:** A slow avatar CDN can consume two-thirds of the 3000ms cache-miss budget.
- **Recommendation:** Tighten the badge-route avatar deadline (e.g. 1000ms) and, on timeout, render the placeholder but skip the SVG cache write so a fast subsequent request can populate the real-avatar SVG.
- **Regression risk:** Skipping the cache write on timeout must not cause repeated placeholder renders — mirror the share page's existing gate pattern.
- **Expected impact:** Caps worst-case avatar contribution at ~1s instead of 2s.
- **Effort estimate:** S

#### PE-S1 On-demand recompute is the de-facto scaling strategy; cache TTL tiering leans on organic traffic
- **Severity:** strategic
- **Time horizon:** Later
- **Evidence type:** [inference]
- **Files:** apps/web/lib/github/client.ts:17-18, apps/web/lib/render/badge-svg-cache.ts:25-26, apps/web/app/api/cron/warm-cache/route.ts:34
- **What's happening:** With proactive warming capped at 50/day, "freshness" for the long tail depends on organic embed traffic keeping each badge's cache warm — popular badges stay cheap, unpopular ones perpetually re-materialize.
- **Why it matters:** A sound cost model for an embed product, but freshness and latency aren't uniform across users — worth owning explicitly.
- **Recommendation:** Treat PE-H1's tiered/hourly warming as the strategic fix; longer term consider prioritizing warm rotation by real embed traffic.
- **Regression risk:** Shortening TTLs to compensate would raise GitHub call volume — fix coverage (PE-H1) instead of shortening TTLs.
- **Expected impact:** Predictable freshness/latency independent of a badge's popularity.
- **Effort estimate:** L

### Cross-Domain Notes
- **DO:** PE-H1 is the launch-critical infra item — decide cron cadence/tiering before N crosses 50; confirm the Vercel cron plan allows more-frequent-than-daily schedules.
- **BE:** PE-M1 touches the durable-write-observability rule — coordinate that moving it into `after()` preserves capture/alerting (ties to BE-H1).
- **QA:** A latency-regression test mocking Redis at ~300ms would catch the silent hit→miss conversion (PE-M2); PE-M3 warrants a concurrency test on a fresh handle.

---

## 7. Reliability / DevOps / Observability Findings (DevOps / SRE Lead)

### Domain Model

Chapa deploys on Vercel from `main` only; `develop` is the integration branch, merges gated by branch protection requiring 11 status checks on `main` (6 on `develop`). CI was recently un-serialized: `build` depends only on `lint-and-typecheck`; test/E2E/deployment-smoke are independent gates with sharded aggregators preserving required check names. Observability: `/api/health` (Redis + Supabase + GitHub probes + cron-heartbeat staleness), `captureOperationalAlert()` posting 7 signal types to a webhook, and 4 Vercel crons. Supabase migrations are plain forward-only SQL applied manually. Runbooks live in `docs/runbooks/*`.

### Findings

#### DO-B1 `pnpm audit` gate is red on develop and will block the release PR to main
- **Severity:** launch-blocker
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** .github/workflows/security.yml:23, branch protection on `main` (required check `pnpm audit`)
- **What's happening:** `pnpm audit --prod` exits non-zero because the npm legacy audit endpoint is retired (410). The job has failed on the last several develop pushes. `pnpm audit` is a required status check on `main`, so a release PR cannot merge until it's green. A working-tree change (uncommitted) rewrites the step to `pnpm audit --prod --ignore-registry-errors`, which makes pnpm swallow the registry error and exit 0 — passing without ever evaluating advisories.
- **Why it matters:** Two-headed: the release is mechanically blocked, and the staged "fix" would permanently blind the only automated dependency-vulnerability gate.
- **Recommendation:** Don't rely on `--ignore-registry-errors`. Use a pnpm version whose `audit` targets the bulk advisory endpoint, or replace with `osv-scanner`/`audit-ci` against a working advisory source. Verify it actually returns advisories on a known-vulnerable fixture.
- **Regression risk:** A real audit tool will start failing CI the moment any prod dependency has an advisory — pair it with an allowlist/severity threshold so it fails only on actionable advisories.
- **Expected impact:** Release PR can merge; dependency vulnerabilities are actually detected again.
- **Effort estimate:** S

#### DO-H1 Supabase migrations are applied manually with no automated enforcement before deploy
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** docs/runbooks/migrations.md:5,42,74-96, scripts/validate-migrations.ts:1-60
- **What's happening:** Migrations are applied manually via dashboard/CLI with no automatic runner. The only pre-deploy safety is a documented, human-run diff check. `validate-migrations.ts` only checks filename convention and sequence contiguity — it does not verify a migration has actually been applied to production.
- **Why it matters:** A hotfix that adds a column and code referencing it can be merged and auto-deployed while the migration was never applied to prod — a query on a missing column throws a 500, which for legal user input is a bug per CLAUDE.md.
- **Recommendation:** Add a CI job on the release PR that runs `supabase db diff --linked` and fails if pending migrations exist against production. At minimum, make the manual check a hard, non-skippable release-checklist item.
- **Regression risk:** A `db diff --linked` check needs read access to production DB from CI — scope it read-only and document in secret-rotation.md.
- **Expected impact:** Eliminates the "code shipped ahead of schema" incident class.
- **Effort estimate:** M

#### DO-M1 latency-check cron writes no heartbeat and is invisible to /api/health
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/cron/latency-check/route.ts, apps/web/app/api/health/route.ts:21-25, apps/web/vercel.json
- **What's happening:** warm-cache, sync-audience, and process-campaigns each write a heartbeat checked for staleness by `/api/health`. The newer latency-check cron — itself the synthetic monitor for the badge-latency SLO — writes no heartbeat and isn't in the health monitor's list.
- **Why it matters:** If latency-check silently stops firing, you lose badge-latency SLO alerting with zero indication — the monitor that catches latency regressions can die unnoticed.
- **Recommendation:** Have latency-check write a `cron:lastrun:latency-check` heartbeat and add it to the health route's monitored list; update the observability runbook.
- **Regression risk:** Reuse the existing 48h TTL/26h staleness window so a single missed run doesn't flap health to 503.
- **Expected impact:** A dead SLO monitor now self-reports via health + P1 alert.
- **Effort estimate:** S

#### DO-M2 No down-migration / schema-rollback story; app rollback cannot undo a bad schema change
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** docs/runbooks/migrations.md (no rollback section), docs/runbooks/rollback.md:1-60 (code only)
- **What's happening:** Migrations are forward-only with no down-migrations and no rollback section in the runbook. The rollback runbook covers Vercel promote and `git revert` — code only, not schema.
- **Why it matters:** During an incident where a schema change is the culprit, code rollback is impossible for the DB layer and there's no rehearsed procedure.
- **Recommendation:** Add a "Reversing a migration" section: expand-migrate-contract pattern for destructive changes, a policy requiring a paired reverse script staged before applying anything destructive.
- **Regression risk:** An expand/contract policy slows simple schema changes — scope it to genuinely destructive operations only.
- **Expected impact:** A rehearsable DB rollback path exists before it's needed.
- **Effort estimate:** M

#### DO-L1 Non-CONCURRENT index creation on already-populated tables locks writes at scale
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** supabase/migrations/020_add_partial_index_users_email.sql:5, supabase/migrations/021_add_merge_operations_verified.sql:8
- **What's happening:** Two migrations add indexes to already-populated tables using plain `CREATE INDEX`, which takes a write-blocking lock for the build duration. At current scale the lock is milliseconds; it becomes a problem as these tables grow.
- **Why it matters:** A future index migration on a much larger table could stall writes during a traffic spike.
- **Recommendation:** Document that indexes on populated tables should use `CREATE INDEX CONCURRENTLY` going forward.
- **Regression risk:** `CONCURRENTLY` can't run in a transaction and can leave an INVALID index if it fails — document the check-and-drop-invalid-index recovery step.
- **Expected impact:** Future large-table index migrations don't lock writes.
- **Effort estimate:** S

#### DO-L2 `.next` build artifact is present in the working tree and pollutes tooling/greps
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [inference]
- **Files:** apps/web/.next/
- **What's happening:** A local production build sits in the tree (gitignored, not a commit risk) but silently poisons repo-wide grep/audit tooling.
- **Why it matters:** Minor operational hygiene; a foot-gun during incident triage.
- **Recommendation:** No code change required; optionally note in a runbook to clean `.next` before repo-wide analysis.
- **Regression risk:** None — advisory only.
- **Expected impact:** Cleaner analysis surface.
- **Effort estimate:** S

### Verified-safe (no finding — checked and healthy)
- CI un-serialization (#1007) is correct — `main` branch protection still requires Test/E2E/Build/Deployment-Smoke green despite parallel execution.
- All 7 documented alert signals are real and wired, not aspirational.
- Health endpoint degrades gracefully for optional services; GitHub probe capped and cached.
- `nightly-prod-probe.yml` is scheduled, read-only, and hard-fails if its base URL is unset.
- Secrets hygiene: no tracked env files, no hardcoded secrets, all env reads centralized and trimmed.
- CLAUDE.md env docs match `env.ts` exactly.
- Git state clean aside from the expected `/update-docs` output and the in-flight security.yml fix.

### Cross-Domain Notes
- **SE:** DO-B1 is jointly owned with SE-M1 — the `--ignore-registry-errors` mitigation neuters vulnerability scanning; weigh in on the right replacement and severity threshold.
- **BE:** DO-H1/DO-M2 touch the Supabase data-access layer — validate the "degrades gracefully on missing column" claim against actual `lib/db/*` read paths.
- **QA:** DO-M1's heartbeat addition wants a unit test mirroring the existing 3-cron heartbeat tests.

---

## 8. Security / Privacy Findings (Security Reviewer)

### Domain Model

Chapa's trust boundary sits at the API/route layer. Unauthenticated public surface (badge SVG, share page, profile/history/verify APIs) is read-only, rate-limited fail-open, and CORS-wildcarded by design, with no confidence/private fields exposed. Authenticated surface: session is a stateless AES-256-GCM-encrypted cookie (HttpOnly/Secure/SameSite=Lax, 24h expiry). OAuth uses CSRF double-submit state plus a Redis replay-consume store for GitHub; platform OAuth tokens are AES-256-GCM-encrypted at rest. Every per-handle write route funnels through a single ownership gate; admin routes use session+allowlist or timing-safe bearer auth. User-controlled input into SVG flows through `escapeXml()` on every path; avatar fetch is host-allowlisted (SSRF guard). DB access is via the parameterized Supabase client; the one interpolated filter is pre-sanitized.

**The core application security posture is strong** — SVG escaping, session encryption, CSRF, token-at-rest encryption, admin gating, timing-safe comparisons, and injection defenses are all correctly implemented. Material findings here are in security *tooling/CI gates*, not app code. Note: this audit catches obvious issues only — a dedicated pre-launch security review is still warranted.

### Findings

#### SE-M1 CI dependency-audit gate is vacuous — npm audit endpoint retired, `--ignore-registry-errors` swallows it
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** .github/workflows/security.yml:23, docs/accepted-risks.md:126-132
- **What's happening:** The classic npm audit endpoint is retired — every invocation returns HTTP 410 (reproduced locally). Because CI passes `--ignore-registry-errors`, the job goes green while scanning zero packages. `docs/accepted-risks.md` names this job as the compensating control for GHAS being unavailable — so the documented compensating control is itself non-functional.
- **Why it matters:** Dependency CVEs in production deps go undetected, and both CI and the accepted-risks doc give false confidence they're covered. (Cross-references DO-B1, found independently by a second specialist.)
- **Recommendation:** Switch to `osv-scanner --lockfile=pnpm-lock.yaml` or the npm bulk-advisory endpoint. Drop `--ignore-registry-errors`. Verify Dependabot is genuinely enabled and alerts route somewhere a human sees them.
- **Regression risk:** A real scanner may surface transitive advisories with no fix available on first enablement — triage with an explicit ignore-list, not a blanket error-swallow.
- **Expected impact:** Restores real dependency-vulnerability enforcement; aligns the accepted-risk justification with reality.
- **Effort estimate:** M

#### SE-M2 License-compliance CI uses a 3-item denylist, not the policy allowlist — misses LGPL/SSPL/CDDL/unlicensed
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** .github/workflows/security.yml:36
- **What's happening:** The license-check job fails only on `GPL-2.0;GPL-3.0;AGPL-3.0`. CLAUDE.md's policy is an allowlist (MIT/Apache-2.0/BSD/ISC only). A 3-item denylist passes LGPL, SSPL, CDDL, EPL, unlicensed packages, and dual-license edge cases. (No current violation confirmed — this is about future coverage.)
- **Why it matters:** The CI gate enforces roughly 1% of the stated policy; a new copyleft dependency wouldn't be caught automatically.
- **Recommendation:** Invert to an allowlist (`--onlyAllow "MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC;0BSD;CC0-1.0"`) with an explicit exclude list for the already-accepted MPL/LGPL packages.
- **Regression risk:** Will immediately fail on already-accepted packages unless each is explicitly excluded — the exclusion list must stay in sync with `accepted-risks.md`.
- **Expected impact:** CI actually enforces the MIT/Apache/BSD/ISC policy instead of only blocking GPL/AGPL.
- **Effort estimate:** M

#### SE-L1 Platform OAuth callbacks (Bitbucket/Codeberg/GitLab) rely on double-submit state only — no replay-consume store
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [inference]
- **Files:** apps/web/lib/auth/platform-oauth.ts:218-225, apps/web/app/api/auth/callback/route.ts:104-112
- **What's happening:** GitHub's callback hardens CSRF with both cookie double-submit and a single-use Redis nonce; the shared platform-OAuth factory validates state via cookie double-submit only.
- **Why it matters:** Impact is bounded — these callbacks additionally require a session and derive the redirect from `session.login`, so it's a defense-in-depth inconsistency, not an exploitable account-takeover path.
- **Recommendation:** Thread the same nonce consume mechanism into the platform factory.
- **Regression risk:** Reuse the existing consume helper's retry/fallback logic rather than reimplementing — a naive hard consume previously caused a "state already used on first legitimate link" incident.
- **Expected impact:** Uniform replay resistance across all OAuth providers.
- **Effort estimate:** M

#### SE-L2 Stateless session has no server-side revocation — a copied cookie stays valid up to 24h
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [inference]
- **Files:** apps/web/lib/auth/github.ts:355-465, apps/web/app/api/auth/logout/route.ts
- **What's happening:** Sessions are fully stateless; logout clears the cookie client-side only. An exfiltrated cookie remains valid until its 24h expiry; rotating the signing secret is the only mass-invalidation option.
- **Why it matters:** Standard tradeoff for stateless sessions, well-bounded by the 24h window — raising so the team consciously accepts it.
- **Recommendation:** Accept and document, or add a lightweight per-user epoch check in Redis if revocation is ever needed.
- **Regression risk:** A server-side epoch check couples auth availability to Redis on every request — must be fail-open or it becomes a new outage vector, which weakens the very guarantee it adds.
- **Expected impact:** Optional; enables true logout/compromise revocation if warranted later.
- **Effort estimate:** M

### Cross-Domain Notes
- **DO:** SE-M1/SE-M2 are both in `.github/workflows/security.yml` (currently uncommitted-modified) — own jointly with DO-B1. Confirm Dependabot alerts route somewhere visible.
- **QA:** SE-M1/SE-M2 are gate-configuration issues only manifesting against live registry/advisory APIs — a smoke assertion that the audit command exits non-zero on a known-vulnerable fixture would catch a future silent-pass regression.
- **AR:** `escapeIlike` is the only hand-rolled PostgREST filter sanitizer — centralize it if more interpolated-filter call sites appear.

---

## 9. Code Quality / Maintainability Findings (Principal Architect)

### Domain Model

Chapa is a pnpm monorepo with two TypeScript projects: `apps/web` (Next.js App Router) and `packages/shared` (pure scoring/stats/format primitives, consumed only via the `@chapa/shared` alias). Four platform integrations each transform raw provider data into a canonical `StatsData` shape feeding the pure `lib/impact/*` scoring engine and the `lib/render/*` SVG pipeline. Cross-cutting infrastructure lives in `lib/cache`, `lib/db`, `lib/env.ts`, and `lib/i18n`. Module boundaries are enforced in CI via `madge`, a shared-alias import rule, and an env-access rule. **Baseline health is strong:** typecheck passes clean, madge reports zero circular dependencies, knip reports zero unused files/exports/dependencies, the base tsconfig is fully strict, and craftsmanship escape hatches are minimal (0 `as any`, 13 lint/ts disables, 3 TODOs across the entire app/lib/components tree).

### Findings

#### AR-M1 GitHub stats aggregation is excluded from the shared invariant skeleton, duplicating logic the parity test cannot see
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** packages/shared/src/stats-aggregation.ts:42,134-147, packages/shared/src/platform-stats.ts:117-136, apps/web/lib/platform-aggregation-parity.test.ts:204-283
- **What's happening:** The shared-pipeline refactor extracted invariant aggregation steps into `computePlatformStats()`; Bitbucket/Codeberg/GitLab delegate to it. GitHub's `buildStatsFromRaw()` — the primary and most-exercised platform — still maintains its own inline copy, including a hardcoded `>= 30` burst-detection literal duplicated (not shared) across both files. The parity test covers only the three delegating platforms, not GitHub.
- **Why it matters:** This is a latent scoring-consistency bug generator in the single most important code path in the product — the project's own memory flags scoring integration gaps as a recurring source of shipped bugs.
- **Recommendation:** Either route GitHub's invariant steps through `computePlatformStats` too, or extend the parity test to include a GitHub fixture and lift the `>= 30` literal into a shared named constant.
- **Regression risk:** GitHub's path legitimately diverges in two ways that must be preserved — authoritative `prsMergedCount` from the search total, and GitHub-only quality signals. A naive consolidation would regress both. The test-only option is lower risk.
- **Expected impact:** Invariant-step logic becomes single-sourced or test-locked across all four platforms.
- **Effort estimate:** M

#### AR-M2 The `no-process-env` ESLint guard only matches `process.env.X` member access, not bare `process.env` object reads
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/eslint.config.mjs:25-26, apps/web/app/api/admin/agents/run/route.ts:151
- **What's happening:** The rule's AST selector only matches a three-level member expression. A spread (`{ ...process.env }`) is a two-level expression that slips through entirely — demonstrated live at `agents/run/route.ts:151`.
- **Why it matters:** The centralized-env invariant (all reads through the trimmed, typed `lib/env.ts` accessors — this project has a documented history of whitespace-in-env-var auth failures) is only as good as the gate enforcing it.
- **Recommendation:** Broaden the selector to also flag bare `process.env`, then triage the resulting hits (the agent-run spawn genuinely needs the full parent environment — document that as an explicit, visible exception).
- **Regression risk:** The child-process spawn's full-env passthrough is a legitimate need — the fix there is a documented exception, not a code change.
- **Expected impact:** The env-centralization gate enforces its stated contract.
- **Effort estimate:** S

#### AR-L1 `knip.json` carries stale `ignoreDependencies` / `ignore` entries knip now flags as removable
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** knip.json:5-8,30-40
- **What's happening:** knip runs clean but emits 10 configuration hints indicating several ignore entries are now resolvable and no longer need suppressing.
- **Why it matters:** Over-broad ignore lists are how dead-code detectors go blind over time.
- **Recommendation:** Remove the flagged entries and re-run knip incrementally to confirm it stays green.
- **Regression risk:** Some entries may suppress a real false-positive — remove incrementally, not all at once.
- **Expected impact:** knip's ignore surface shrinks to only what's needed.
- **Effort estimate:** S

#### AR-L2 Dev-tooling dependencies are minor versions behind
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** pnpm outdated output — vitest, @vitest/coverage-v8, tsx, vite
- **What's happening:** Four dev-only dependencies are a few patch/minor releases behind; no production dependency is outdated.
- **Why it matters:** Minimal — avoids accumulating a larger upgrade later.
- **Recommendation:** Bump the four together in one change; run the full test+coverage suite to confirm.
- **Regression risk:** `vitest` and `@vitest/coverage-v8` must stay on the identical version.
- **Expected impact:** Smaller future upgrade surface.
- **Effort estimate:** S

### Cross-Domain Notes
- **SE/BE:** `agents/run/route.ts:149-153` spawns a child process with the full parent env and a server-controlled script path, gated behind admin auth + a feature flag — worth a dedicated Security look at the blast radius beyond the lint-gap angle (AR-M2).
- **QA:** AR-M1 is a test-coverage gap in the scoring pipeline — extending the parity test to cover GitHub would close it directly.

---

## 10. Testing / QA Findings (QA / Reliability Lead)

### Domain Model

Chapa's test suite is a single Vitest project of 487 files / 8,339 unit+integration tests, plus a separate real-Postgres/real-Redis contract project (29 files / 57 tests) and a Playwright E2E layer. Tests are colocated per convention; API routes are exercised by importing the handler and passing a `NextRequest`. Critical-path coverage is deep where it matters: the Impact scoring pipeline (132 tests in `v6.test.ts` alone, exact-threshold assertions), the degraded-fetch safety net (a genuine real-pipeline contract test), and the partial-failure snapshot saga (all four branches including Supabase-ok/Redis-fail).

### Raw command results (verbatim)

| Command | Result |
|---|---|
| `pnpm run test` | **PASS** — 487 test files, 8,339 tests, 32.5s |
| `pnpm run typecheck` | **PASS** — packages/shared + apps/web both clean |
| `pnpm run lint` | **PASS** — packages/shared + apps/web both clean |
| `pnpm run check:write-registration` | **PASS** — 33 write routes: 27 registered, 6 exempt, 0 unregistered |
| `pnpm run test:contract` (bare) | FAIL — infra only, missing local Supabase env, not a code defect |
| `pnpm run test:contract` (CI-equivalent env) | **PASS** — 29 files, 57 tests, 3.7s |
| `pnpm run test:coverage` | Statements 96.73% · Branches 92.76% · Functions 95.71% · Lines 97.92% |

Reliability gate verdict: both checks pass. No `.skip`/`.todo`/`.only`/`xit` anywhere in the suite. Three CLAUDE.md claims independently verified against actual test files, all hold: the #1004 real-pipeline regression contract genuinely exercises the full chain; the `reconcileSnapshotWrite` partial-failure path is directly asserted and wired into both call sites; all 50 API route files have a colocated test.

### Findings

#### QA-M1 Coverage gate is global-only, ~22 points below actual — cannot catch a critical-module regression
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** vitest.config.ts:44-49
- **What's happening:** The only coverage floor is a single global block (75/70/65/75%). There is no per-module threshold for `lib/impact/**` or `stats-integrity.ts`. Measured coverage is ~22 points above the gate. CLAUDE.md claims "per-module thresholds," which doesn't match the config.
- **Why it matters:** The gate is effectively a rubber stamp; someone could delete most of the scoring pipeline's tests and the global average would still clear 75%.
- **Recommendation:** Add per-directory floors for `lib/impact/**` and `stats-integrity.ts` (≈90%); reconcile CLAUDE.md's claim with the actual config.
- **Regression risk:** Set floors a few points under current actuals, not at them, so legitimate refactors don't trip the gate.
- **Expected impact:** A scoring or stats-integrity coverage regression fails CI instead of silently passing.
- **Effort estimate:** S

#### QA-L1 `detectProfileType` is not asserted exactly at the 0.15 solo/collaborative boundary
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/impact/v6.ts:268-276, apps/web/lib/impact/v6.test.ts:982-992
- **What's happening:** Tests assert well away from the documented 0.15 pivot (0.0746 solo, 0.2238 collaborative); no test pins behavior at or immediately astride exactly 0.15.
- **Why it matters:** An off-by-one flip of `<` to `<=` at this exact, documented boundary would not be caught.
- **Recommendation:** Add assertions at inputs producing ratios exactly at, just below, and just above the threshold constant.
- **Regression risk:** Reference the named constant rather than hardcoding 0.15 in the new test.
- **Expected impact:** The exact pivot behavior is locked.
- **Effort estimate:** S

#### QA-S1 Contract suite hard-fails locally without infra env — no developer-facing preflight guidance
- **Severity:** strategic
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** vitest.contract-setup.ts:5-18, package.json:12
- **What's happening:** Running the contract suite without local Supabase env wired throws on all 29 suites with no wrapper script to set it up, unlike CI which handles this correctly.
- **Why it matters:** Not a code defect, but easy to mis-run/mis-read as broken, which discourages routine local use of the seam-bug safety net.
- **Recommendation:** Add a `test:contract:local` script that runs `supabase status -o env` and injects the mapped vars, mirroring the CI job.
- **Regression risk:** Must bind explicitly to local `supabase status` output only — never point at hosted/prod Supabase.
- **Expected impact:** Contract suite becomes a routine local check.
- **Effort estimate:** S

### Cross-Domain Notes
- **DO:** The bare local contract-suite failure is infra-gated, not a regression — CI's job is correctly wired and is the authoritative signal.
- **BE:** `reconcileSnapshotWrite` callers discard `reconciliationRequired`/`cacheUpdated` intentionally (the alert fires inside the saga) — the signal is already tested if a caller ever needs it.
- **SE:** Public read APIs have unit tests with mocked stores rather than real-DB contract tests — acceptable for reads, but their rate-limit/CORS branches are asserted only against mocks.

---

## 11. UX Cohesion / Design System Findings (Product Designer / UX Lead)

### Domain Model

Chapa's user-facing surface spans a terminal-aesthetic landing page, Creator Studio, public share page with interactive badge preview, verification flow, admin dashboard, archetype/about/legal content pages, and a generation loading screen. All colors, fonts, shadows, and ~19 keyframe animations are defined once via Tailwind v4 `@theme`, documented as the single source of truth in `docs/design-system.md`. Every major route ships `loading.tsx` + `error.tsx`, and there is a global `not-found.tsx`/`global-error.tsx`. Overall design-system compliance is high — no icon libraries, no generic fonts, no italic-on-mono, no onClick-on-div, comprehensive `prefers-reduced-motion` escape hatch, correct error/verification token usage in most places, correct alt text on all images.

### Findings

#### UX-M1 Tooltip pattern applied inconsistently — heatmap/badge tooltips use container-relative `position: absolute` instead of the mandated portal+fixed pattern
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/effects/heatmap/HeatmapGrid.tsx:145-158,271-292, apps/web/components/BadgeOverlay.tsx:302-309, apps/web/components/dashboard/ActivityHeatmap.tsx:405-417,479-519, apps/web/components/InfoTooltip.tsx:82-98
- **What's happening:** The project has a documented mandatory tooltip pattern (portal to body, `position: fixed`, `z-index: 99999`, viewport-relative coords, flip-below near the viewport top) precisely because grid-cell tooltips clip at container edges. `ActivityHeatmap` and `InfoTooltip` implement this correctly. `HeatmapGrid` (rendered in the interactive badge and Studio preview) computes container-relative offsets and renders `absolute z-50` with a static transform — no portal, no flip, wrong z-index. `BadgeOverlay` similarly deviates (lower risk, has an `overflow: visible` mitigation).
- **Why it matters:** This is the exact clipping regression the project's own UI rules flag as "no exceptions." A user hovering the top row of the interactive heatmap in Studio or on the share page can get a truncated/hidden tooltip, and the correct implementation exists two directories away, unused.
- **Recommendation:** Refactor `HeatmapGrid`'s tooltip to mirror `ActivityHeatmap`'s `ChartTooltip` (portal, fixed, z-99999, flip). Consider extracting a shared `FloatingTooltip` primitive.
- **Regression risk:** Portal-rendered fixed tooltips must still track correctly under the badge's tilt-3d CSS transform (portal to body sidesteps the transform-breaks-fixed trap). Keep `pointer-events-none`.
- **Expected impact:** Heatmap tooltips remain fully visible at all grid positions; one consistent tooltip mechanism app-wide.
- **Effort estimate:** M

#### UX-M2 Error boundaries inconsistently internationalized — 5 of 13 are hardcoded English in a Spanish-default product
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/studio/error.tsx, apps/web/app/verify/error.tsx:16-34, apps/web/app/generating/error.tsx, apps/web/app/experiments/error.tsx, apps/web/app/admin/error.tsx
- **What's happening:** `DEFAULT_LOCALE` is `es`, yet 5 route error boundaries render hardcoded English, notably `studio/error.tsx` (flagship feature) and `verify/error.tsx` (public verification flow), while others (`u/[handle]/error.tsx`, `about`, `terms`) are correctly wired through `useTranslation`.
- **Why it matters:** A Spanish user who hits an error on Studio or Verify drops from Spanish UI into English — a systemic gap across a whole category of pages, undercutting the Spanish-default promise on the two most conversion-relevant flows.
- **Recommendation:** Wire the 5 hardcoded boundaries through `useTranslation`, copying the existing pattern from `u/[handle]/error.tsx`; add any missing keys to both dictionaries.
- **Regression risk:** Confirm `useTranslation`'s fallback never throws when no provider is mounted, since error boundaries can render when the tree partially failed — the existing i18n'd boundaries already prove this path works.
- **Expected impact:** Consistent locale across all failure states.
- **Effort estimate:** S

#### UX-L1 Verify error boundary uses brand-amber tokens instead of the verify flow's teal (complement) or error-red
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/verify/error.tsx:16,25, apps/web/app/verify/VerifyForm.tsx:48,57
- **What's happening:** The rest of the verify flow correctly uses complement/teal tokens; `verify/error.tsx` uses brand-amber.
- **Why it matters:** Minor, but breaks the teal-means-verification semantic exactly at the moment (an error) where trust cues matter most.
- **Recommendation:** Switch to complement or terminal-red tokens; fold into the UX-M2 i18n pass on the same file.
- **Regression risk:** None functional.
- **Expected impact:** Verify flow reads as one coherent teal-trust surface, even in failure.
- **Effort estimate:** S

#### UX-L2 `InfoTooltip` omits the documented `screenY < 120` auto-flip, relying on a manual `position` prop
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [inference]
- **Files:** apps/web/components/InfoTooltip.tsx:32-51,82-98
- **What's happening:** `InfoTooltip` correctly portals/fixed/z-99999 but its vertical placement depends solely on a static `position` prop, not the mandated dynamic flip near the viewport top that its sibling `ChartTooltip` implements.
- **Why it matters:** The "every tooltip fully visible" guarantee depends on each caller remembering to pass the right `position` — a latent clipping source.
- **Recommendation:** Compute effective placement from `rect.top < 120` automatically, reusing the branch already proven in `ActivityHeatmap`.
- **Regression risk:** Gate the auto behavior to when `position` is unset/default so it doesn't fight an explicit override.
- **Expected impact:** InfoTooltips near the viewport top stay visible without per-callsite tuning.
- **Effort estimate:** S

#### UX-L3 Data-viz colors hardcoded as JS hex constants instead of dimension/intensity CSS tokens
- **Severity:** low
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/effects/heatmap/HeatmapGrid.tsx:239,263, apps/web/components/dashboard/ActivityHeatmap.tsx:432,437
- **What's happening:** Interactive heatmaps set colors from JS hex-constant maps rather than the design system's `--color-dimension-*` CSS tokens (an intentional data-viz exception, theme-invariant today, so no visible bug).
- **Why it matters:** Duplication risk — if a dimension token's value is retuned, these JS constants silently diverge from the badge SVG.
- **Recommendation:** Source from CSS custom properties or a single shared constants module for the HTML/JS surfaces (keep the server-rendered SVG on literal values).
- **Regression risk:** Do not change the hex values — badge/HTML parity depends on them matching exactly.
- **Expected impact:** Single source of truth for dimension colors.
- **Effort estimate:** S

### Cross-Domain Notes
- **FE / docs drift:** `docs/design-system.md` documents `LanguageSwitcher` roles that don't match the (more correct) implementation — update the doc, not the code.
- **QA:** A render test asserting `HeatmapGrid`'s tooltip is portal-rendered/fixed, and a parity test forbidding hardcoded strings in `error.tsx`, would have caught UX-M1/UX-M2.
- **General (positive baselines):** global `prefers-reduced-motion` and `focus-visible` support, complete loading/error/not-found coverage, and correct alt text everywhere are strengths remediation should not regress.

---

## 12. Prioritized Action Plan

| ID | Domain | Title | Severity | Time Horizon | Effort | Impact |
|---|---|---|---|---|---|---|
| DO-B1 | DO | pnpm audit gate is red, blocks release PR | launch-blocker | Before launch | S | Unblocks release |
| BE-H1 | BE | Public badge-path snapshot-write failures escape alerting | high | Before launch | S | Restores durable-write observability |
| PE-H1 | PE | Warm-cache 50-handle ceiling breaks freshness/history at scale | high | Before launch | M | Prevents post-launch scaling cliff |
| DO-H1 | DO | Supabase migrations have no automated pre-deploy enforcement | high | Before launch | M | Prevents schema/code drift incidents |
| SE-M1 | SE | Dependency-audit gate scans zero packages (dup. of DO-B1) | medium | Before launch | M | Real CVE detection restored |
| SE-M2 | SE | License-compliance gate is a denylist, not the policy allowlist | medium | Before launch | M | Closes copyleft-ingestion gap |
| PE-M1 | PE | Durable Supabase write blocks the badge critical path | medium | Before launch | S | Removes 50-250ms from every cache-miss |
| PE-M2 | PE | 250ms Redis deadline converts hits into misses under load | medium | Before launch | S | Prevents thundering-herd amplification |
| BE-M1 | BE | Reconciliation saga blind to write races and insert-dedup | medium | Before launch | M | Closes silent cache-divergence gap |
| BE-M2 | BE | Insert-vs-duplicate detection hinges on a fragile status code | medium | Before launch | S | Survives future supabase-js upgrades |
| AR-M2 | AR | no-process-env lint gate misses bare `process.env` reads | medium | Before launch | S | Closes env-centralization loophole |
| DO-M1 | DO | latency-check cron has no heartbeat monitoring | medium | Before launch | S | SLO monitor becomes self-observing |
| DO-M2 | DO | No down-migration / schema-rollback story | medium | Before launch | M | Rehearsable DB rollback path |
| FE-M1 | FE | `?lang=` deep link doesn't apply locale on current load | medium | Before launch | S | Fixes broken shareable-link feature |
| UX-M1 | UX | HeatmapGrid tooltip violates mandatory portal/fixed pattern | medium | Before launch | M | Fixes real tooltip-clipping regression |
| UX-M2 | UX | 5 error boundaries hardcoded English in Spanish-default app | medium | Before launch | S | Locale consistency on flagship flows |
| FE-H1 | FE | i18n forces client-rendering of every content page | high | After launch | XL | Removes hydration weight + locale flash |
| AR-M1 | AR | GitHub stats aggregation duplicated outside parity test | medium | After launch | M | Closes scoring-consistency drift risk |
| FE-M2 | FE | Duplicate Navbar/NavbarClient implementations drifted | medium | After launch | M | One nav to maintain |
| FE-M3 | FE | Typed-accessor i18n refactor incomplete | medium | After launch | S | Uniform fail-soft i18n access |
| BE-M3 | BE | Platform OAuth fail-open where policy calls for fail-closed | medium | After launch | S | Consistent rate-limit posture |
| QA-M1 | QA | Coverage gate is global-only, 22pts below actual | medium | After launch | S | Protects critical-path regressions |
| UX-L1 | UX | Verify error boundary uses wrong color token | low | After launch | S | Visual consistency |
| UX-L2 | UX | InfoTooltip missing auto-flip near viewport top | low | After launch | S | Removes latent clipping source |
| PE-M3 | PE | Render-lock loser polls 2s then materializes anyway | medium | After launch | M | Bounds cold-handle concurrent-miss p99 |
| BE-L1 | BE | /api/challenge swallows email-send failures | low | After launch | S | Dropped disputes become visible |
| PE-L1 | PE | Avatar fetch (2s) awaited on badge critical path | low | After launch | S | Caps worst-case avatar latency |
| DO-L1 | DO | Non-CONCURRENT index creation on populated tables | low | After launch | S | Avoids future write-lock stalls |
| SE-L1 | SE | Platform OAuth callbacks lack replay-consume store | low | After launch | M | Uniform CSRF replay resistance |
| QA-L1 | QA | Solo/collaborative 0.15 boundary not tested exactly | low | After launch | S | Locks documented pivot behavior |
| AR-L1 | AR | knip.json has stale ignore entries | low | Later | S | Restores dead-code detection coverage |
| AR-L2 | AR | Dev-tooling deps minor versions behind | low | Later | S | Smaller future upgrade surface |
| FE-L1 | FE | Share-page trend data fetched client-side (waterfall) | low | Later | M | Removes one client round-trip |
| FE-L2 | FE | NavbarClient auth-state flash on ISR pages | low | Later | S | No login-flash for returning users |
| BE-L2 | BE | process-campaigns starves concurrent campaigns | low | Later | M | Predictable multi-campaign behavior |
| PE-S1 | PE | On-demand recompute is the de-facto scaling strategy | strategic | Later | L | Predictable freshness independent of popularity |
| DO-L2 | DO | `.next` build artifact pollutes tooling greps | low | Later | S | Cleaner analysis surface |
| SE-L2 | SE | Stateless session has no server-side revocation | low | Later | M | Optional compromise-recovery path |
| UX-L3 | UX | Data-viz colors hardcoded as hex, not tokens | low | Later | S | Single source of truth for colors |
| QA-S1 | QA | Contract suite hard-fails locally with no preflight guidance | strategic | Later | S | Encourages routine local use |

---

## 13. Top 10 Highest-ROI Improvements

1. **DO-B1** — S-effort fix unblocks the entire release pipeline; nothing else matters until this lands.
2. **BE-H1** — S-effort change closes an observability gap on the single highest-volume write in the product.
3. **PE-M1** — S-effort change (move a write into `after()`) removes 50-250ms from every cache-miss badge response, no architecture change required.
4. **PE-M2** — S-effort deadline/marker fix prevents a load-triggered thundering-herd exactly when launch traffic would cause it.
5. **PE-H1** — M-effort cron-cadence change prevents a scaling cliff that a successful launch would trigger by definition.
6. **DO-H1** — M-effort CI check closes the most likely self-inflicted production incident (schema/code drift).
7. **BE-M2** — S-effort, low-risk change (swap a fragile status-code check for an explicit signal) prevents a future silent, untraceable outage from a routine dependency bump.
8. **UX-M1** — M-effort fix closes a real, already-known clipping-regression pattern in the two most interactive surfaces (Studio, share page).
9. **AR-M2** — S-effort lint-rule broadening closes a governance loophole with a documented history of causing real auth failures.
10. **SE-M2** — M-effort CI change converts a stated hard policy (MIT/Apache/BSD/ISC only) from ~1% enforced to fully enforced.

---

## 14. Before Launch / After Launch / Later Strategic

### Before launch (Wave 1)
- DO-B1: pnpm audit gate is red, blocks release PR
- BE-H1: Public badge-path snapshot-write failures escape alerting
- PE-H1: Warm-cache 50-handle ceiling breaks freshness/history at scale
- DO-H1: Supabase migrations have no automated pre-deploy enforcement
- SE-M1: Dependency-audit gate scans zero packages
- SE-M2: License-compliance gate is a denylist, not the policy allowlist
- PE-M1: Durable Supabase write blocks the badge critical path
- PE-M2: 250ms Redis deadline converts hits into misses under load
- BE-M1: Reconciliation saga blind to write races and insert-dedup
- BE-M2: Insert-vs-duplicate detection hinges on a fragile status code
- AR-M2: no-process-env lint gate misses bare `process.env` reads
- DO-M1: latency-check cron has no heartbeat monitoring
- DO-M2: No down-migration / schema-rollback story
- FE-M1: `?lang=` deep link doesn't apply locale on current load
- UX-M1: HeatmapGrid tooltip violates mandatory portal/fixed pattern
- UX-M2: 5 error boundaries hardcoded English in Spanish-default app

### After launch (Wave 2)
- FE-H1: i18n forces client-rendering of every content page
- AR-M1: GitHub stats aggregation duplicated outside parity test
- FE-M2: Duplicate Navbar/NavbarClient implementations drifted
- FE-M3: Typed-accessor i18n refactor incomplete
- BE-M3: Platform OAuth fail-open where policy calls for fail-closed
- QA-M1: Coverage gate is global-only, 22pts below actual
- PE-M3: Render-lock loser polls 2s then materializes anyway
- BE-L1: /api/challenge swallows email-send failures
- PE-L1: Avatar fetch (2s) awaited on badge critical path
- DO-L1: Non-CONCURRENT index creation on populated tables
- SE-L1: Platform OAuth callbacks lack replay-consume store
- QA-L1: Solo/collaborative 0.15 boundary not tested exactly
- UX-L1: Verify error boundary uses wrong color token
- UX-L2: InfoTooltip missing auto-flip near viewport top

### Later / strategic (Wave 3)
- AR-L1: knip.json has stale ignore entries
- AR-L2: Dev-tooling deps minor versions behind
- FE-L1: Share-page trend data fetched client-side (waterfall)
- FE-L2: NavbarClient auth-state flash on ISR pages
- BE-L2: process-campaigns starves concurrent campaigns
- PE-S1: On-demand recompute is the de-facto scaling strategy
- DO-L2: `.next` build artifact pollutes tooling greps
- SE-L2: Stateless session has no server-side revocation
- UX-L3: Data-viz colors hardcoded as hex, not tokens
- QA-S1: Contract suite hard-fails locally with no preflight guidance

---

## 15. Open Questions / Assumptions

- **The `.github/workflows/security.yml` fix is already in flight, uncommitted.** Two independent specialists (DevOps, Security) flagged the working-tree change (`--ignore-registry-errors`) as making the underlying problem worse, not better. Before committing anything to this file, decide: adopt `osv-scanner`, upgrade to a pnpm version targeting the bulk advisory endpoint, or another approach — this needs a human call on tooling preference, not just a code fix.
- **Is Dependabot actually enabled and alerting a human?** Both DO and SE note it's the only currently-functioning dependency-vulnerability control, but neither could verify alert routing from a codebase-only audit — worth a direct check of the repo's Security tab.
- **Is `CHAPA_ALERT_WEBHOOK_URL` configured in production?** Several recommended fixes (BE-H1's new alert, DO-M1's heartbeat) depend on this webhook actually being set; unverified in a read-only codebase audit.
- **What's the actual current user count relative to the 50-handle warm-cache ceiling?** PE-H1's urgency scales directly with how close to (or past) 50 active users the product already is — this determines whether it's a pre-launch must-fix or has runway.
- **Is the FE-H1 locale-segmented-route migration worth doing at all, given its XL effort and "After launch" placement?** It's the single highest-leverage frontend fix available, but it's also the largest. Worth a dedicated design conversation before committing engineering time.
- **No production incident history was reviewed** — this audit is entirely static analysis plus test execution; it cannot see actual production error rates, real Redis/Supabase latency percentiles, or real GitHub API rate-limit consumption, all of which would sharpen PE-H1/PE-M2's severity and urgency.

---

## 16. Final Verdict

- **Verdict: NOT READY**
- **What would most worry you about shipping today?** That the release PR to `main` mechanically cannot merge right now — `pnpm audit` is a required check and it's red, with an in-flight fix that makes the underlying gap permanent rather than closing it. Beyond that single blocker, the two things that would actually cause a bad launch week are the warm-cache ceiling (a scaling cliff a *successful* launch triggers by definition) and the silent snapshot-write-failure gap on the highest-volume write path (an outage nobody would notice until users did).
- **What gives you confidence?** Everything underneath those operational issues is solid: 8,339 tests pass, typecheck and lint are clean, zero circular dependencies, zero dead exports, and — critically — the scoring pipeline and the degraded-fetch safety net (the two areas with the worst historical bug record) are both deeply tested with genuine end-to-end contract coverage, not just unit tests in isolation. Application-level security (auth, sessions, SVG escaping, injection defenses) held up to independent adversarial review with no exploitable findings. Nothing in this audit suggests a fragile foundation — it suggests a foundation that's ready, sitting behind one broken CI gate and a handful of well-understood, mostly S/M-effort operational gaps.
- **Next 5 actions (ordered):**
  1. Fix the `pnpm audit` CI gate (DO-B1/SE-M1) — replace with a working scanner, don't paper over it — this is the literal release blocker.
  2. Add alerting to the public badge-path snapshot write (BE-H1) and move that write off the request-critical path (PE-M1) — same code area, do together.
  3. Decide and implement a warm-cache cadence/tiering fix (PE-H1) before launch traffic arrives.
  4. Add a CI check for pending Supabase migrations before the release PR merges (DO-H1).
  5. Sweep the remaining Wave 1 medium items (SE-M2 license gate, PE-M2 Redis deadline, UX-M1 tooltip, UX-M2 i18n error boundaries, AR-M2 lint gate, BE-M1/BE-M2 snapshot saga, DO-M1/DO-M2, FE-M1) — all are S/M effort and can be parallelized across a small team in under a week.
