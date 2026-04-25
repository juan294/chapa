# Pre-Launch Codebase Audit
> Generated on 2026-04-23 | Branch: `develop` | 8 domain tracks
> Focus: comprehensive

## 1. Executive Summary
Chapa is not in obvious collapse: the local verification baseline is strong, the repo has broad automated coverage, and the product has real operational scaffolding. But this is not ready for launch yet. The main risks cluster around green CI that does not prove the runtime works, a public share page that does not meet the product contract, public-route performance that is too heavy for a launch surface, and backend/email flows that are still missing concurrency and idempotency controls.

- Top 3 strengths:
  - Local verification is healthy: `pnpm run typecheck`, `pnpm run lint`, `pnpm run test`, `pnpm run build`, and `pnpm audit` all passed during this audit.
  - Test breadth is real: the suite passed 402 test files / 7165 tests, and the repo has coverage across auth, API routes, render paths, admin flows, cron routes, and accessibility checks.
  - The codebase has strong baseline discipline: typecheck passed, `pnpm run check:circular` reported no circular dependencies, and the repo already contains runbooks, health endpoints, accepted-risk docs, and deployment workflow structure.
- Top 5 risks:
  - `UX-B1`: the public share page does not satisfy the repo’s own requirement to show badge + breakdown + embed snippet to public visitors.
  - `DO-H1` / `QA-H1`: CI can go green without proving launch-critical runtime integrations actually work.
  - `FE-H1` / `FE-H2` / `PE-H1` / `PE-H2`: public routes are shipping too much client runtime before page-specific value is delivered.
  - `PE-H3` / `PE-M1` / `PE-M2`: badge/share hot paths still expose origin fan-out and high tail-latency risk under cache misses or slow Redis.
  - `BE-H2` / `BE-M3` / `SE-L2`: outbound email paths are not concurrency-safe or idempotent enough for public launch.
- Verdict: NOT READY

There is now one confirmed `launch-blocker` in this pass: the public share page does not match the product contract documented in `CLAUDE.md`, because public visitors do not get the promised breakdown and embed experience. Combined with the still-permissive launch validation path, shipping today would be knowingly launching a product whose core public artifact is both under-validated and incomplete.

## 2. System Architecture Overview
Chapa is a two-package workspace: `packages/shared` holds shared scoring/types contracts, and `apps/web` is the only deployable runtime. Inside `apps/web`, App Router entrypoints under `app/*` feed a shared profile pipeline: auth/session resolution in `lib/auth/*`, cache/database access in `lib/cache/*` and `lib/db/*`, provider fetch/merge work in `lib/github/*`, scoring in `lib/impact/*`, and render output in `lib/render/*`.

Major modules and responsibilities:
- `app/u/[handle]` and `app/u/[handle]/badge.svg`: public share/badge surfaces
- `app/api/auth/*`: OAuth and session lifecycle
- `app/api/admin/*`: admin read/write and agent/campaign controls
- `app/api/cron/*` and `app/api/webhooks/*`: scheduled and provider-triggered background work
- `lib/profile/*`: public/profile materialization orchestration
- `lib/github/*`, `lib/bitbucket/*`, `lib/codeberg/*`: provider fetch and merge logic
- `lib/email/*`: notification, audience, and campaign sending

How the pieces connect:
- Public pages and badge routes call profile materialization, which pulls cached or live provider data, scores it, renders it, and writes side effects such as snapshots and verification records.
- Admin/campaign routes read/write Supabase rows and trigger send loops that call external email APIs.
- Cron routes warm caches, process campaigns, and sync operational data.
- Shared client runtime from the root layout is mounted across almost every public route.

Architecture concerns:
- `AR-M1`: `lib/github/client.ts` has become a god module with too many responsibilities.
- `AR-M2`: route-owned `app/*` modules are being imported upward into shared layers.
- `AR-M3`: verification reads currently have two sources of truth.
- `AR-S1`: public traffic, admin operations, cron work, and campaign sending still share one runtime boundary.

## 3. End-to-End Flow Analysis
Key flows reviewed:
- Landing page -> `/api/auth/login` -> OAuth callback -> encrypted session cookie
- `/u/[handle]` and `/u/[handle]/badge.svg` -> Redis/cache lookups -> provider fetch/merge -> scoring -> SVG/share rendering -> persistence side effects
- Admin dashboard -> campaign CRUD -> manual campaign send
- Cron/webhook paths -> cache warming, audience sync, campaign processing, email forwarding

Request/data/control flow observations:
- Public profile surfaces do too much request-time work on cold/cache-miss paths. GitHub fetches, cache reads, avatar retrieval, and render work are still stacked synchronously on user-facing responses.
- CI validates a build-shaped environment, not a deployment-shaped environment. Dummy secrets and permissive smoke coverage mean green checks do not prove the launch surface actually works.
- Email/campaign flows still behave like an ad hoc job system without durable claims or idempotency keys.

Integration and boundary risks:
- Runtime/auth config drift can silently weaken cookies or break release procedures.
- Redis slowness/outage changes behavior in critical ways that are not always fail-open.
- Shared client shell decisions are directly inflating public page startup cost.

## 4. Frontend / UI Findings (Staff Frontend Engineer)
#### FE-H1 Shared global client shell is inflating the baseline JS cost of nearly every route
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/.next/diagnostics/route-bundle-stats.json:3, apps/web/.next/diagnostics/route-bundle-stats.json:109, apps/web/app/layout.tsx:4, apps/web/app/layout.tsx:125, apps/web/app/layout.tsx:131, apps/web/components/PostHogProvider.tsx:6, apps/web/components/KeyboardShortcutsListener.tsx:125, apps/web/components/ClientAnalytics.tsx:5
- **What's happening:** Existing build diagnostics show roughly 695KB uncompressed first-load JS on mostly content routes like `/`, `/about`, and `/about/scoring`, with `/u/[handle]` even larger. The root layout mounts `ThemeProvider`, `PostHogProvider`, `KeyboardShortcutsListener`, and `ClientAnalytics` for every page, so non-essential interactive runtime is global instead of route-scoped.
- **Why it matters:** This raises the startup cost of the entire site, not just advanced surfaces. Public launch traffic will hit landing/about/share pages first, so a heavy shared shell directly increases parse/hydration time and makes every further route optimization less effective.
- **Recommendation:** Move non-essential client concerns out of the root shell and into route- or feature-scoped islands. Keep keyboard shortcuts and command surfaces off static marketing pages, and defer analytics behind lighter boundaries.
- **Expected impact:** Lower first-load JS on public pages, faster hydration/interaction, and cleaner route-level bundle ownership.
- **Effort estimate:** L

#### FE-H2 The public share page is coupled to the Studio preview runtime for customized badges
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/.next/diagnostics/route-bundle-stats.json:3, apps/web/app/u/[handle]/page.tsx:69, apps/web/app/u/[handle]/page.tsx:120, apps/web/app/u/[handle]/page.tsx:190, apps/web/components/ShareBadgePreviewLazy.tsx:6, apps/web/components/ShareBadgePreview.tsx:3, apps/web/app/studio/BadgePreviewCard.tsx:22, apps/web/app/studio/BadgePreviewCard.tsx:63
- **What's happening:** The share route server-renders inline SVG only for default configs. As soon as a saved config differs from defaults, it switches to `ShareBadgePreviewLazy` with `ssr: false`, which imports `ShareBadgePreview`, which imports the Studio-only `BadgePreviewCard` and its visual-effects stack.
- **Why it matters:** The primary public product surface is paying for Studio runtime and a client-only render path. That makes the loading path worse for the users with customized badges and aligns with `/u/[handle]` being the heaviest public route in the current bundle stats.
- **Recommendation:** Keep public badge rendering server-side even for custom configs, or split a slimmer share-only renderer from the Studio preview stack.
- **Expected impact:** Smaller share-page bundles, fewer hydration dependencies on the main public route, and more predictable profile-page rendering.
- **Effort estimate:** L

#### FE-M1 Studio availability is determined inconsistently between server routing and client navigation
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/feature-flags.ts:1, apps/web/lib/feature-flags.ts:61, apps/web/app/studio/page.tsx:55, apps/web/components/KeyboardShortcutsListener.tsx:187, apps/web/components/terminal/command-registry.ts:197, apps/web/components/terminal/command-registry.ts:253, apps/web/components/UserMenu.tsx:326
- **What's happening:** The server gates `/studio` with `isStudioEnabled()`, which is DB-backed with env fallback, while client surfaces use `isStudioEnabledSync()`, which is env-only. The command bar, keyboard shortcuts, and user menu can therefore expose or hide Studio based on a different truth source than the route itself.
- **Why it matters:** This creates split-brain routing behavior: the UI can advertise a route that immediately redirects away, or hide a route that the server would allow. That becomes especially risky near launch when operators change flags without redeploying.
- **Recommendation:** Resolve Studio availability once on the server and pass it into client navigation surfaces, or expose one hydrated/public flag source consumed consistently by both layers.
- **Expected impact:** Stable navigation behavior, fewer redirect dead ends, and safer operational control of feature rollout.
- **Effort estimate:** M

#### FE-M2 Admin summary cards are computed from paginated rows but presented as whole-dataset KPIs
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/admin/useAdminDashboard.ts:56, apps/web/app/admin/useAdminDashboard.ts:79, apps/web/app/admin/useAdminDashboard.ts:152, apps/web/app/admin/AdminStatsCards.tsx:39
- **What's happening:** `useAdminDashboard()` computes `tierCounts` from the current `users` page only, while `AdminStatsCards` divides those counts by `totalUsers`, which represents the full dataset.
- **Why it matters:** The dashboard’s top-level numbers are mathematically wrong and drift with pagination, search, and sort state. Incorrect KPIs on an operations surface are worse than missing KPIs because they look authoritative.
- **Recommendation:** Return aggregate tier counts from `/api/admin/users` or a companion summary endpoint and keep page-local table state separate from whole-dataset metrics.
- **Expected impact:** Correct admin telemetry and fewer operator mistakes caused by misleading summary cards.
- **Effort estimate:** M

#### FE-M3 Admin table requests can race and overwrite newer state with stale responses
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/admin/useAdminDashboard.ts:61, apps/web/app/admin/useAdminDashboard.ts:97, apps/web/app/admin/useAdminDashboard.ts:146, apps/web/app/admin/AdminSearchBar.tsx:17
- **What's happening:** `fetchUsers()` issues async fetches on mount, refresh, sort, page changes, and deferred search updates, but it has no `AbortController`, request token, or last-write-wins guard. Every response writes directly into UI state.
- **Why it matters:** Fast input or multiple operator actions can produce out-of-order updates where an earlier response lands after a newer one and replaces correct UI state with stale rows or totals.
- **Recommendation:** Add request cancellation or monotonic request IDs and ignore responses that are not the latest active request for the current search/sort/page state.
- **Expected impact:** Deterministic admin table state under rapid interaction and fewer stale-response regressions.
- **Effort estimate:** M

#### FE-L1 Owner visits to the share page trigger an automatic second refresh cycle after the initial render
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/u/[handle]/page.tsx:103, apps/web/components/SharePageOwnerContent.tsx:88, apps/web/hooks/useOwnerCacheWarm.ts:29, apps/web/app/api/refresh/route.ts:56
- **What's happening:** The share page already materializes profile data on the server, but once client-side ownership resolves, `useOwnerCacheWarm()` automatically posts to `/api/refresh`, clears cached stats, recomputes the profile, revalidates the page, and then calls `router.refresh()`.
- **Why it matters:** Owners pay for a second network/render cycle on first visit per tab session, which increases perceived work on the page and spends refresh budget even when the initial SSR payload was already sufficient.
- **Recommendation:** Gate the owner warm-up behind explicit staleness detection or a user action rather than forcing an automatic refresh after initial render.
- **Expected impact:** Less duplicate work on owner profile views and lower accidental churn on the refresh pipeline.
- **Effort estimate:** M

## 5. Backend / API / Data Findings (Staff Backend Engineer)
#### BE-H1 Public profile side effects fail closed when Redis is unavailable
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/profile/public-profile.ts:66, apps/web/lib/profile/public-profile.ts:72, apps/web/lib/profile/public-profile.ts:76, apps/web/lib/cache/redis.ts:326, apps/web/lib/cache/redis.ts:331, apps/web/lib/cache/redis.test.ts:610
- **What's happening:** `runPublicProfileSideEffects()` uses `cacheSetNx()` as a once-per-day guard and returns early when that call yields `false`. In production, `cacheSetNx()` returns `false` both for “already processed” and for Redis-unavailable paths.
- **Why it matters:** A Redis outage suppresses snapshot inserts, verification writes, badge analytics, first-badge notifications, and user upserts instead of letting them proceed. The public surface keeps rendering while data correctness silently degrades.
- **Recommendation:** Split guard outcomes into explicit states: acquired, already exists, and storage unavailable. Only skip side effects on the duplicate case and fail open on storage outages.
- **Expected impact:** Public rendering degrades gracefully under Redis incidents without silently dropping core persistence side effects.
- **Effort estimate:** M

#### BE-H2 Campaign sending has no claim/lease boundary, so concurrent invocations can send duplicate emails
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [inference]
- **Files:** apps/web/app/api/admin/campaigns/[id]/send/route.ts:37, apps/web/app/api/admin/campaigns/[id]/send/route.ts:46, apps/web/app/api/cron/process-campaigns/route.ts:13, apps/web/app/api/cron/process-campaigns/route.ts:24, apps/web/lib/email/campaigns.ts:101, apps/web/lib/email/campaigns.ts:129, apps/web/lib/email/campaigns.ts:147, apps/web/lib/email/campaigns.ts:189, apps/web/lib/email/campaigns.ts:204, apps/web/lib/db/campaigns.ts:578, apps/web/lib/db/campaigns.ts:612, supabase/migrations/016_create_email_campaigns.sql:22
- **What's happening:** Campaign processing reads `pending` rows, sends them, and only marks them sent/failed afterward. There is no claim step, lease token, transactional state transition, or outbound idempotency key. Manual send and cron both operate on the same pending set.
- **Why it matters:** Overlap or retries can select and send the same recipients more than once. For a user-facing email system, that is a launch-grade reliability defect.
- **Recommendation:** Add an atomic claim phase that moves a bounded set of sends from `pending` to `processing` with an owner/lease token, then finalize them idempotently after send.
- **Expected impact:** Campaign execution becomes retry-safe and concurrency-safe instead of timing-dependent.
- **Effort estimate:** L

#### BE-M1 Snapshot-mutating endpoints do not maintain a coherent cache invalidation sequence
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/refresh/route.ts:60, apps/web/app/api/refresh/route.ts:85, apps/web/app/api/recalculate/route.ts:59, apps/web/app/api/insights/route.ts:71, apps/web/lib/history/history.ts:58, apps/web/lib/history/history.ts:68
- **What's happening:** Write paths that change a user snapshot are inconsistent about invalidation. `refresh` invalidates history before persistence completes, `recalculate` replaces the snapshot without clearing history caches, and `insights` clears only part of the read model after craft-affecting writes.
- **Why it matters:** Clients can observe stale profile/history data after explicit refresh and recalculation actions, which makes the system look nondeterministic.
- **Recommendation:** Centralize post-write invalidation in one helper that runs after durable persistence and clears all affected read models in a defined order.
- **Expected impact:** Predictable read-after-write behavior across profile, history, and related cached views.
- **Effort estimate:** M

#### BE-M2 Campaign admin APIs validate campaign rows on read, but not campaign payloads on write
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/admin/campaigns/route.ts:40, apps/web/app/api/admin/campaigns/route.ts:66, apps/web/app/api/admin/campaigns/[id]/route.ts:75, apps/web/app/api/admin/campaigns/[id]/route.ts:85, apps/web/lib/db/campaigns.ts:164, apps/web/lib/db/campaigns.ts:184, apps/web/lib/db/campaigns.ts:224
- **What's happening:** Create/update routes only do shallow checks on a few fields and `ctaUrl`, then persist `features` and other content directly. The stronger structural checks exist only on the read side.
- **Why it matters:** Invalid admin payloads can be stored first and only fail later when campaigns are fetched, previewed, or processed, turning data integrity into a client-behavior problem.
- **Recommendation:** Add shared write-time schema validation for campaign payloads and reuse the same schema at both the route and DB boundaries.
- **Expected impact:** Invalid campaign content is rejected at ingress, preventing latent corruption and downstream 500s.
- **Effort estimate:** M

#### BE-M3 Resend webhook forwarding is not idempotent
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/api/webhooks/resend/route.ts:19, apps/web/app/api/webhooks/resend/route.ts:95, apps/web/app/api/webhooks/resend/route.ts:111, apps/web/lib/email/resend.ts:167, apps/web/lib/email/resend.ts:203
- **What's happening:** The webhook handler verifies the signature and forwards every accepted `email.received` event immediately, but it never records `svix-id` or `email_id` as processed and does not provide application-level idempotency on the outbound forward.
- **Why it matters:** Retries, replays, or ambiguous timeout cases can generate duplicate forwarded support emails and noisy inbox behavior.
- **Recommendation:** Add a processed-event guard keyed by `svix-id` or `email_id` and make the forward step idempotent relative to that key.
- **Expected impact:** Webhook retries become safe and duplicate forwards are suppressed.
- **Effort estimate:** S

## 6. Performance and Scalability Findings (Performance Engineer)
#### PE-H1 Public routes carry an oversized client baseline before page-specific UI is added
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/.next/diagnostics/route-bundle-stats.json:92, apps/web/.next/diagnostics/route-bundle-stats.json:113, apps/web/.next/diagnostics/route-bundle-stats.json:739, apps/web/app/layout.tsx:4, apps/web/app/layout.tsx:125, apps/web/app/layout.tsx:131, apps/web/app/about/page.tsx:3, apps/web/app/about/page.tsx:123, apps/web/components/GlobalCommandBar.tsx:1
- **What's happening:** The production build shows `/_not-found` at 616603 uncompressed first-load JS, `/about` at 695888, and `/` at 697155. The root layout mounts always-on client providers, and marketing pages synchronously import the full `GlobalCommandBar`.
- **Why it matters:** This creates a large parse/hydration floor for the highest-traffic public pages, hurting startup CPU, responsiveness, and real-user LCP/INP before any route-specific content is added.
- **Recommendation:** Move analytics, shortcut UI, and command-bar behavior behind route-group or interaction-triggered lazy boundaries and keep marketing pages server-first.
- **Expected impact:** Lower first-load JS, faster hydration, and reduced startup CPU on landing/about/legal surfaces.
- **Effort estimate:** M

#### PE-H2 The share page ships owner-only dashboard and preview code to every visitor
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/.next/diagnostics/route-bundle-stats.json:3, apps/web/components/SharePageOwnerContent.tsx:6, apps/web/components/SharePageOwnerContent.tsx:83, apps/web/components/SharePageOwnerContent.tsx:100, apps/web/components/SharePageOwnerContent.tsx:140, apps/web/components/dashboard/ImpactDashboard.tsx:4, apps/web/components/dashboard/ImpactDashboard.tsx:46, apps/web/app/u/[handle]/page.tsx:13, apps/web/app/u/[handle]/page.tsx:20
- **What's happening:** `/u/[handle]` is the largest measured public route at 746542 uncompressed first-load JS. Its always-mounted client subtree statically imports owner-only dashboard and preview code even though most visits are anonymous.
- **Why it matters:** The main public profile route pays for authenticated-owner functionality on anonymous traffic, increasing transfer, parse cost, and hydration work exactly where the product needs fast share-page loads.
- **Recommendation:** Split the owner path after session resolution with a dynamic import and keep visitor CTA/content in a lighter component.
- **Expected impact:** Smaller public share-page bundle, better first paint for anonymous visitors, and less main-thread work on the route most likely to be shared externally.
- **Effort estimate:** M

#### PE-H3 The badge render lock collapses after 300ms, so cache-miss bursts can still fan out expensive renders
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/u/[handle]/badge.svg/route.ts:25, apps/web/app/u/[handle]/badge.svg/route.ts:26, apps/web/app/u/[handle]/badge.svg/route.ts:27, apps/web/app/u/[handle]/badge.svg/route.ts:70, apps/web/app/u/[handle]/badge.svg/route.ts:148, apps/web/app/u/[handle]/badge.svg/route.ts:152, apps/web/app/u/[handle]/badge.svg/route.ts:164
- **What's happening:** Cross-instance badge rendering is guarded by a Redis lock, but losers only poll cache 6 times at 50ms intervals. After roughly 300ms, they fall through into full `materializePublicProfile()` execution even if the original render is still working.
- **Why it matters:** On cache misses or cold starts, concurrent badge requests can still stampede GitHub, Redis, and origin CPU, pushing up p95/p99 latency and undermining the intended anti-herd protection.
- **Recommendation:** Make the waiter horizon align with realistic render latency or lock TTL, add jitter/backoff, and prefer serving stale-or-pending results over duplicate renders.
- **Expected impact:** Lower tail latency and materially less upstream/load amplification during bursty badge traffic.
- **Effort estimate:** M

#### PE-M1 The public share/badge hot path still blocks TTFB on several synchronous remote operations
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/u/[handle]/page.tsx:108, apps/web/app/u/[handle]/page.tsx:124, apps/web/lib/profile/materialize-profile.ts:71, apps/web/lib/profile/materialize-profile.ts:77, apps/web/lib/github/client.ts:61, apps/web/lib/github/client.ts:132, apps/web/lib/github/client.ts:143, apps/web/lib/render/avatar.ts:29, apps/web/lib/render/avatar.ts:67, packages/shared/src/github-query.ts:15, packages/shared/src/github-query.ts:69
- **What's happening:** On cache misses, the request path waits for Redis reads, a broad GitHub GraphQL query, optional platform enrichment, scoring, and a network avatar fetch before inline SVG is produced. The share page explicitly awaits the avatar promise before rendering.
- **Why it matters:** This stacks multiple network/IO dependencies directly onto response generation, so cold or stale pages will show high TTFB variance and poor p95/p99 behavior under upstream slowness.
- **Recommendation:** Remove avatar fetch from the critical path, precompute/persist public profile materialization more aggressively, and bias request-time work toward cached artifacts plus background refresh.
- **Expected impact:** Lower TTFB variance on cache misses and faster recovery under upstream GitHub/CDN slowness.
- **Effort estimate:** L

#### PE-M2 Cache operations on hot paths have error handling but no latency budget, so slow Redis still stalls requests
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/cache/redis.ts:47, apps/web/lib/cache/redis.ts:65, apps/web/lib/cache/redis.ts:176, apps/web/lib/cache/redis.ts:309, apps/web/app/u/[handle]/badge.svg/route.ts:100, apps/web/app/u/[handle]/badge.svg/route.ts:123, apps/web/app/u/[handle]/badge.svg/route.ts:148, apps/web/app/u/[handle]/page.tsx:108
- **What's happening:** `cacheGet`, `cacheSet`, and `rateLimit` are wrapped in try/catch but not in explicit timeouts, while these calls are awaited repeatedly in badge and share-page hot paths. The health check is the exception.
- **Why it matters:** When Upstash is slow rather than fully failing, requests do not fail open quickly; they accumulate latency at the cache layer itself, worsening tail latency across public endpoints.
- **Recommendation:** Add short deadlines and a simple circuit-breaker strategy for hot-path cache/rate-limit calls, with fast fallback to stale data or uncached execution.
- **Expected impact:** Better resilience to partial cache degradation and tighter p95/p99 latency under infrastructure slowness.
- **Effort estimate:** M

## 7. Reliability / DevOps / Observability Findings (DevOps / SRE Lead)
#### DO-H1 CI can go green without proving launch-critical runtime integrations work
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** .github/workflows/ci.yml:108, .github/workflows/ci.yml:137, apps/web/e2e/smoke.spec.ts:19, apps/web/e2e/smoke.spec.ts:49, docs/runbooks/release-checklist.md:27
- **What's happening:** Build and E2E jobs inject dummy OAuth/Redis secrets, and the smoke suite explicitly accepts `badge.svg` failing with `500/503` and `/api/auth/login` failing with `500`. The only production-shaped validation described is manual preview checking.
- **Why it matters:** A deploy can satisfy CI while still being broken in the exact launch-critical paths that matter: OAuth, public badge rendering, and environment-backed dependency wiring.
- **Recommendation:** Add a protected preview or integration job with real non-prod secrets that asserts login redirects, badge rendering, and health dependency behavior in a deployed environment.
- **Expected impact:** Release confidence moves from “builds in CI” to “works in a deployment-shaped environment.”
- **Effort estimate:** M

#### DO-H2 Runtime detection is still mostly passive; there is no evidence of an active alerting path
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [inference]
- **Files:** docs/runbooks/incident-response.md:12, apps/web/lib/analytics/server-errors.ts:58, apps/web/lib/analytics/server-errors.ts:95, apps/web/lib/analytics/server-errors.ts:145
- **What's happening:** The incident runbook says issues are typically discovered through manual health checks, deploy notifications, CI failures, or user reports. Server-side event capture is fire-and-forget and silently drops failures or missing config, and there is no repo evidence of paging or threshold-based alerting.
- **Why it matters:** For a public launch, silent degradation can sit unnoticed until users report it, extending mean time to detect and turning telemetry into passive logging instead of monitoring.
- **Recommendation:** Define one active alert path for launch-critical signals: health degradation, badge 5xx rate, OAuth callback failures, and cron failures. Document who receives those alerts and what thresholds trigger them.
- **Expected impact:** Failures become operator-visible without manual polling, materially improving incident detection and response time.
- **Effort estimate:** M

#### DO-M1 Operational documentation has drifted from actual auth, health, and secret requirements
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/auth/cron.ts:13, apps/web/lib/auth/cron.ts:24, docs/accepted-risks.md:105, apps/web/app/api/health/route.ts:89, docs/runbooks/release-checklist.md:40, docs/runbooks/incident-response.md:14, docs/runbooks/outage-playbook.md:9, docs/runbooks/outage-playbook.md:31, apps/web/lib/verification/hmac.ts:44, README.md:149
- **What's happening:** Code and docs no longer align on cron auth behavior, health payload shape, and whether `CHAPA_VERIFICATION_SECRET` is optional or required.
- **Why it matters:** During release or incident response, operators will be working from incorrect assumptions, which is exactly when documentation drift causes slow diagnosis and unsafe decisions.
- **Recommendation:** Reconcile accepted risks, README env requirements, and runbooks to current code, and update health examples to the real response schema.
- **Expected impact:** Runbooks become trustworthy during launch and incident handling.
- **Effort estimate:** S

#### DO-M2 The documented migration validation path is broken
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** docs/runbooks/migrations.md:21, docs/runbooks/migrations.md:38, docs/runbooks/migrations.md:70, scripts/validate-migrations.ts:1, package.json:5
- **What's happening:** The migrations runbook instructs operators to run `pnpm tsx scripts/validate-migrations.ts`, but the repo does not define a `tsx` dependency or supported script for that command.
- **Why it matters:** Manual schema changes are already high-risk. If the documented guardrail is not runnable as written, migration safety depends on operator improvisation at exactly the wrong moment.
- **Recommendation:** Make migration validation executable through the repo’s supported commands and reference that exact command in the runbook and release checklist.
- **Expected impact:** Schema-change prep becomes repeatable and less error-prone.
- **Effort estimate:** S

## 8. Security / Privacy Findings (Security Reviewer)
#### SE-M1 Cookie security depends on a public env var instead of a fail-secure default
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/auth/github.ts:44, apps/web/app/api/auth/login/route.ts:10, apps/web/app/api/auth/callback/route.ts:19, apps/web/lib/auth/bitbucket.ts:73, apps/web/lib/auth/codeberg.ts:60
- **What's happening:** Auth-related cookies only get the `Secure` flag when `NEXT_PUBLIC_BASE_URL` starts with `https://`. If that env var is unset, stale, or mis-set, cookies are still issued but without `Secure`.
- **Why it matters:** Cookie transport protection depends on a public-facing config string rather than a fail-secure server decision. A deployment mistake silently weakens every authenticated flow at once.
- **Recommendation:** Default auth cookies to `Secure` everywhere except explicit localhost development, and derive the exception from request/runtime context rather than `NEXT_PUBLIC_BASE_URL`.
- **Expected impact:** Auth cookies become fail-secure under misconfiguration, reducing the chance of accidental downgrade.
- **Effort estimate:** S

#### SE-M2 Third-party bearer tokens are stored in the client session cookie
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/auth/github.ts:323, apps/web/lib/auth/github.ts:360, apps/web/app/api/auth/callback/route.ts:128
- **What's happening:** After OAuth callback, the GitHub access token is placed directly into the session payload and sent back to the browser inside the encrypted `chapa_session` cookie.
- **Why it matters:** The GitHub bearer token leaves the server trust boundary and rides on every authenticated request. Even with encryption and `HttpOnly`, this increases exposure and complicates revocation semantics.
- **Recommendation:** Move provider access tokens to a server-side session store keyed by an opaque session ID and keep only minimal metadata client-side.
- **Expected impact:** Lower token exposure surface and cleaner revocation behavior.
- **Effort estimate:** M

#### SE-L1 Third-party license inventory is stale and incomplete
- **Severity:** low
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** LICENSE-THIRD-PARTY.md:10, LICENSE-THIRD-PARTY.md:37, apps/web/package.json:15, docs/accepted-risks.md:60, docs/accepted-risks.md:89
- **What's happening:** `LICENSE-THIRD-PARTY.md` is out of sync with the actual dependency graph and accepted-risks record.
- **Why it matters:** Launch-time license posture needs one accurate source of truth. Drift between manifest, inventory, and risk docs creates needless compliance uncertainty.
- **Recommendation:** Regenerate third-party license inventory from the lockfile in CI and publish the generated output as the canonical release artifact.
- **Expected impact:** Cleaner legal/compliance review and fewer false alarms during launch readiness checks.
- **Effort estimate:** S

#### SE-L2 Resend webhook handling has no replay/idempotency guard
- **Severity:** low
- **Time horizon:** Before launch
- **Evidence type:** [inference]
- **Files:** apps/web/app/api/webhooks/resend/route.ts:36, apps/web/app/api/webhooks/resend/route.ts:125, apps/web/lib/email/resend.ts:63
- **What's happening:** The webhook path validates Svix signatures and immediately fetches/forwards the email, but it does not record or reject previously seen `svix-id` values and does not enforce idempotency on `email_id`.
- **Why it matters:** Valid delivery replay or duplicate provider delivery can trigger repeated forwarding of the same message.
- **Recommendation:** Persist a short-TTL dedupe key on `svix-id` or `email_id` before forwarding and treat repeats as already processed.
- **Expected impact:** Safer webhook processing with duplicate forwards suppressed during retries or replay attempts.
- **Effort estimate:** S

## 9. Code Quality / Maintainability Findings (Principal Architect)
#### AR-M1 Core Profile Retrieval Has Become a God Module
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/github/client.ts:1, apps/web/lib/github/client.ts:50, apps/web/lib/github/client.ts:142, apps/web/lib/github/client.ts:167, apps/web/lib/github/client.ts:204, apps/web/lib/profile/materialize-profile.ts:71, apps/web/app/studio/page.tsx:68
- **What's happening:** `getStats()` now owns cache lookup, in-flight deduplication, stale fallback, linked-platform discovery, token refresh/unlink behavior, multi-provider merge policy, supplemental merge policy, and user upsert side effects.
- **Why it matters:** This concentrates multiple failure domains behind one core dependency used by badge, studio, and profile paths. Small changes in provider auth, cache semantics, or merge rules can destabilize the entire profile pipeline.
- **Recommendation:** Split `lib/github/client.ts` into narrower services: provider adapters, merge/orchestration, cache policy, and profile-facing read APIs.
- **Expected impact:** Lower blast radius for provider changes and clearer ownership/testability.
- **Effort estimate:** L

#### AR-M2 Route-Owned Modules Leak Upward Into Shared Layers
- **Severity:** medium
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/agents/report-parser.ts:8, apps/web/app/admin/agents-types.ts:17, apps/web/components/ShareBadgePreview.tsx:4, apps/web/app/studio/BadgePreviewCard.tsx:46, apps/web/app/studio/StudioClient.tsx:261
- **What's happening:** Reusable layers depend on route-owned `app/*` modules. Shared code imports types and preview components from admin/studio route folders.
- **Why it matters:** The directory boundary no longer reflects dependency direction. Refactoring route-local UI can break code that is supposed to be reusable.
- **Recommendation:** Move cross-route types and reusable preview components into neutral shared locations and leave `app/*` as composition/entrypoint code only.
- **Expected impact:** Cleaner module boundaries and safer route refactors.
- **Effort estimate:** M

#### AR-M3 Verification Reads Have Two Sources of Truth
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/verification/store.ts:63, apps/web/lib/verification/store.ts:105, apps/web/lib/db/verification.ts:35, apps/web/lib/db/verification.ts:146, apps/web/app/api/verify/[hash]/route.ts:38, apps/web/app/verify/[hash]/page.tsx:39
- **What's happening:** `lib/verification/store.ts` re-queries Supabase and redefines row parsing/mapping even though `lib/db/verification.ts` already contains the same mapping and exports `dbGetVerification()`.
- **Why it matters:** Public verification behavior depends on duplicated data-access logic, so schema or mapping changes can drift and break the API/page inconsistently.
- **Recommendation:** Collapse reads onto one repository function and keep `lib/verification/store.ts` as a thin wrapper or remove it.
- **Expected impact:** One authoritative verification read path and lower schema-drift risk.
- **Effort estimate:** S

#### AR-M4 OAuth Cookie and Base-URL Policy Is Copy-Pasted Across Providers
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/lib/auth/github.ts:44, apps/web/lib/auth/bitbucket.ts:73, apps/web/lib/auth/codeberg.ts:60, apps/web/app/api/auth/login/route.ts:10, apps/web/app/api/auth/callback/route.ts:19, apps/web/lib/auth/platform-oauth.ts:110
- **What's happening:** Security-sensitive origin and cookie policy logic is duplicated across GitHub, Bitbucket, Codeberg, and route handlers.
- **Why it matters:** Future auth changes will be easy to apply unevenly. A small policy adjustment can create provider-specific auth regressions.
- **Recommendation:** Centralize auth URL and cookie-policy helpers behind one shared module and have provider-specific code depend on that.
- **Expected impact:** Consistent auth behavior across providers and a safer place to evolve cookie/origin rules.
- **Effort estimate:** M

#### AR-L1 Dead-Code Drift Is Starting to Accumulate in the Dashboard Layer
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [inference]
- **Files:** apps/web/components/dashboard/HeroScoreZone.tsx:9, apps/web/components/dashboard/RadarChartInteractive.tsx:77, apps/web/components/SharePageOwnerContent.tsx:142, apps/web/components/dashboard/ImpactDashboard.tsx:46
- **What's happening:** Some exported dashboard components appear to have no non-test imports in the current production composition.
- **Why it matters:** Unused presentation paths increase maintenance load and make future dashboard changes harder because engineers must reason about code that appears live but is not active.
- **Recommendation:** Confirm whether these components are intentionally parked. If not, remove them and their tests; if yes, fence them clearly as experimental.
- **Expected impact:** Smaller dashboard surface area and less ambiguity during future refactors.
- **Effort estimate:** S

#### AR-S1 Public Traffic, Admin Ops, Cron Work, and Campaign Sending Share One Runtime Boundary
- **Severity:** strategic
- **Time horizon:** Later
- **Evidence type:** [evidence]
- **Files:** package.json:6, package.json:7, apps/web/app/u/[handle]/badge.svg/route.ts:92, apps/web/app/api/cron/warm-cache/route.ts:58, apps/web/app/api/admin/agents-summary/route.ts:23, apps/web/app/api/admin/campaigns/[id]/send/route.ts:14
- **What's happening:** The repo builds and runs a single `@chapa/web` application containing public badge rendering, cron warming, admin agent reporting, and campaign initiation.
- **Why it matters:** Internal ops features and background work ship on the same artifact and runtime as the public badge path, so deployment risk, cold-start behavior, and dependency creep are shared whether or not end users touch those features.
- **Recommendation:** After launch, separate internal/admin/background workloads from the public badge/share runtime or at least split deployment boundaries.
- **Expected impact:** Better isolation of public availability from operational tooling and cleaner scaling/deployment decisions.
- **Effort estimate:** XL

## 10. Testing / QA Findings (QA / Reliability Lead)
#### QA-H1 Smoke coverage explicitly allows broken badge and login paths to pass
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/e2e/smoke.spec.ts:19, apps/web/e2e/smoke.spec.ts:27, apps/web/e2e/smoke.spec.ts:49, apps/web/e2e/smoke.spec.ts:55, .github/workflows/ci.yml:137
- **What's happening:** The smoke suite accepts `/u/torvalds/badge.svg` returning non-2xx and `/api/auth/login` returning `500`, and the CI E2E job uses dummy integration secrets.
- **Why it matters:** The highest-value public journeys can be broken while smoke/E2E still report success, which undermines launch confidence even with a green pipeline.
- **Recommendation:** Add one protected deployment-shaped smoke suite with real non-prod secrets and strict expectations for login, badge rendering, and health semantics.
- **Expected impact:** Green CI would begin to mean launch-critical user journeys actually work.
- **Effort estimate:** M

#### QA-L1 Passing tests emit expected-error noise that weakens CI signal quality
- **Severity:** low
- **Time horizon:** After launch
- **Evidence type:** [evidence]
- **Files:** apps/web/components/GlobalCommandBar.render.test.tsx:226, scripts/lib/agent-utils.test.ts:60
- **What's happening:** The local `pnpm run test` pass emitted `Not implemented: navigation to another Document` and shell-style `[ERROR]` lines while still passing. The source shows tests intentionally exercising jsdom navigation traps and stderr-based error cases.
- **Why it matters:** Green runs with noisy error output make real regressions harder to spot in CI logs and train reviewers to ignore red-looking output.
- **Recommendation:** Stub navigation/error logging in those tests so expected-failure assertions do not leak misleading runtime noise into passing test output.
- **Expected impact:** Cleaner CI logs and higher confidence that visible errors represent real failures.
- **Effort estimate:** S

## 11. UX Cohesion / Design System Findings (Product Designer / UX Lead)
#### UX-B1 Public share pages hide the product’s core explanation from the actual public audience
- **Severity:** launch-blocker
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** CLAUDE.md:168, apps/web/app/u/[handle]/page.tsx:103, apps/web/components/SharePageOwnerContent.tsx:19, apps/web/components/SharePageOwnerContent.tsx:100, apps/web/components/SharePageOwnerContent.tsx:128, apps/web/components/SharePageOwnerContent.tsx:149
- **What's happening:** The route already materializes public profile data server-side, but `SharePageOwnerContent` only shows breakdown/data sources/embed snippets to the owner and replaces them with an acquisition CTA for every visitor.
- **Why it matters:** `/u/:handle` is a core launch surface and the spec explicitly says it should show “badge + breakdown + embed snippet.” Right now the public page behaves more like a lead-gen landing page than a share artifact, which weakens trust, social proof, and the product’s main “show your impact” loop.
- **Recommendation:** Make the breakdown and embed module public by default, then layer owner-only actions on top of that public baseline.
- **Expected impact:** Public profile links become self-explanatory, more shareable, and aligned with the product promise.
- **Effort estimate:** M

#### UX-H1 The launch copy is systemically in English despite the repo’s stated Spanish requirement
- **Severity:** high
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** CLAUDE.md:191, apps/web/app/page.tsx:157, apps/web/app/page.tsx:176, apps/web/components/SharePageOwnerContent.tsx:105, apps/web/app/verify/page.tsx:6, apps/web/app/generating/[handle]/GeneratingProgress.tsx:12
- **What's happening:** The primary acquisition, sharing, verification, and generation flows all present English UI copy, while the project instructions say all user-facing content must be in Spanish unless explicitly stated otherwise.
- **Why it matters:** This creates a product-voice mismatch at launch, especially in the highest-traffic screens. It reads like the interface has not been localized or editorially finalized.
- **Recommendation:** Decide the launch locale explicitly, then move the public funnel copy into a centralized message layer and translate the core routes in one pass instead of page-by-page patches.
- **Expected impact:** Clearer brand positioning, less editorial drift, and a more coherent first-run experience.
- **Effort estimate:** M

#### UX-M1 Status semantics are inconsistent across errors and verification, so users cannot rely on color or layout cues
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** docs/design-system.md:72, docs/design-system.md:73, apps/web/app/error.tsx:16, apps/web/app/u/[handle]/error.tsx:16, apps/web/app/verify/page.tsx:27, apps/web/app/verify/[hash]/page.tsx:99, apps/web/app/verify/[hash]/page.tsx:111, apps/web/app/verify/[hash]/page.tsx:241, apps/web/app/verify/[hash]/page.tsx:283
- **What's happening:** The design system reserves terminal-red for errors and teal/complement for verification, but generic error screens use amber as the main error color, and verification results switch between green, red, yellow, and even a red verification code on the verified state.
- **Why it matters:** Status colors stop carrying dependable meaning. In trust-sensitive flows like verification, that undermines scanability and makes the UI feel improvised rather than intentionally designed.
- **Recommendation:** Create shared semantic state primitives for `success`, `error`, `warning`, and `verification`, then refactor route-level pages to consume those primitives instead of choosing colors ad hoc.
- **Expected impact:** More consistent mental models, stronger trust signals, and cleaner design-system reuse.
- **Effort estimate:** M

#### UX-M2 Reduced-motion support is partial, so accessibility behavior changes unpredictably from screen to screen
- **Severity:** medium
- **Time horizon:** Before launch
- **Evidence type:** [evidence]
- **Files:** apps/web/app/studio/StudioClient.tsx:30, apps/web/app/studio/StudioClient.tsx:266, apps/web/app/loading.tsx:31, apps/web/app/page.tsx:151, apps/web/app/u/[handle]/page.tsx:185, apps/web/app/generating/[handle]/GeneratingProgress.tsx:96, apps/web/components/dashboard/ImpactDashboard.tsx:36
- **What's happening:** Studio and the root loading shell explicitly account for `prefers-reduced-motion`, but the landing page, share page, generating flow, and dashboard content still use entrance/pulse/shimmer animation classes without the same guardrail.
- **Why it matters:** Users who opt out of motion get inconsistent behavior depending on which route they land on. That is both an accessibility gap and a polish issue in a product that leans heavily on animated presentation.
- **Recommendation:** Promote reduced-motion handling into a shared utility/pattern and apply it to all route-level entrance, shimmer, pulse, and progress animations.
- **Expected impact:** More accessible defaults and a more coherent perceived-performance strategy across the product.
- **Effort estimate:** M

## 12. Prioritized Action Plan
| ID | Domain | Title | Severity | Time Horizon | Effort | Impact |
|---|---|---|---|---|---|---|
| UX-B1 | UX | Public share pages hide the product’s core explanation from the actual public audience | launch-blocker | Before launch | M | Restores the core public share artifact promised by the product |
| DO-H1 | DO | CI can go green without proving launch-critical runtime integrations work | high | Before launch | M | Prevents green-but-broken releases |
| DO-H2 | DO | Runtime detection is still mostly passive; there is no evidence of an active alerting path | high | Before launch | M | Improves incident detection before users report issues |
| FE-H1 | FE | Shared global client shell is inflating the baseline JS cost of nearly every route | high | Before launch | L | Improves startup cost across the whole public surface |
| FE-H2 | FE | The public share page is coupled to the Studio preview runtime for customized badges | high | Before launch | L | Shrinks the heaviest public route |
| BE-H1 | BE | Public profile side effects fail closed when Redis is unavailable | high | Before launch | M | Preserves correctness during cache outages |
| PE-H1 | PE | Public routes carry an oversized client baseline before page-specific UI is added | high | Before launch | M | Improves LCP/INP and mobile responsiveness |
| PE-H2 | PE | The share page ships owner-only dashboard and preview code to every visitor | high | Before launch | M | Reduces share-page hydration cost |
| PE-H3 | PE | The badge render lock collapses after 300ms, so cache-miss bursts can still fan out expensive renders | high | Before launch | M | Reduces origin amplification and p95/p99 risk |
| QA-H1 | QA | Smoke coverage explicitly allows broken badge and login paths to pass | high | Before launch | M | Turns green CI into meaningful launch evidence |
| BE-H2 | BE | Campaign sending has no claim/lease boundary, so concurrent invocations can send duplicate emails | high | Before launch | L | Prevents duplicate user emails |
| AR-M3 | AR | Verification reads have two sources of truth | medium | Before launch | S | Lowers schema-drift and correctness risk |
| DO-M1 | DO | Operational documentation has drifted from actual auth, health, and secret requirements | medium | Before launch | S | Makes runbooks trustworthy during incidents |
| DO-M2 | DO | The documented migration validation path is broken | medium | Before launch | S | Restores a critical schema-safety guardrail |
| SE-M1 | SE | Cookie security depends on a public env var instead of a fail-secure default | medium | Before launch | S | Reduces accidental auth downgrade risk |
| BE-M3 | BE | Resend webhook forwarding is not idempotent | medium | Before launch | S | Prevents duplicate forwarded email noise |
| BE-M1 | BE | Snapshot-mutating endpoints do not maintain a coherent cache invalidation sequence | medium | Before launch | M | Improves read-after-write correctness |
| BE-M2 | BE | Campaign admin APIs validate campaign rows on read, but not campaign payloads on write | medium | Before launch | M | Prevents latent bad campaign data |
| FE-M1 | FE | Studio availability is determined inconsistently between server routing and client navigation | medium | Before launch | M | Prevents split-brain routing |
| FE-M2 | FE | Admin summary cards are computed from paginated rows but presented as whole-dataset KPIs | medium | Before launch | M | Fixes misleading internal KPIs |
| FE-M3 | FE | Admin table requests can race and overwrite newer state with stale responses | medium | Before launch | M | Stabilizes admin UI under interaction |
| SE-M2 | SE | Third-party bearer tokens are stored in the client session cookie | medium | Before launch | M | Reduces token exposure blast radius |
| AR-M1 | AR | Core Profile Retrieval Has Become a God Module | medium | Before launch | L | Lowers blast radius of profile changes |
| PE-M2 | PE | Cache operations on hot paths have error handling but no latency budget | medium | Before launch | M | Improves resilience to slow Redis |
| UX-H1 | UX | The launch copy is systemically in English despite the repo’s stated Spanish requirement | high | Before launch | M | Fixes launch-editorial drift on core public flows |
| UX-M1 | UX | Status semantics are inconsistent across errors and verification, so users cannot rely on color or layout cues | medium | Before launch | M | Strengthens trust and design-system consistency |
| UX-M2 | UX | Reduced-motion support is partial, so accessibility behavior changes unpredictably from screen to screen | medium | Before launch | M | Improves accessibility and polish on animated routes |
| PE-M1 | PE | The public share/badge hot path still blocks TTFB on several synchronous remote operations | medium | Before launch | L | Lowers cold-path response variance |
| AR-M2 | AR | Route-Owned Modules Leak Upward Into Shared Layers | medium | After launch | M | Cleans dependency direction |
| AR-L1 | AR | Dead-Code Drift Is Starting to Accumulate in the Dashboard Layer | low | After launch | S | Reduces maintenance ambiguity |
| QA-L1 | QA | Passing tests emit expected-error noise that weakens CI signal quality | low | After launch | S | Improves CI readability |
| FE-L1 | FE | Owner visits to the share page trigger an automatic second refresh cycle after the initial render | low | After launch | M | Reduces duplicate owner-side work |
| SE-L1 | SE | Third-party license inventory is stale and incomplete | low | Before launch | S | Improves release/compliance clarity |
| SE-L2 | SE | Resend webhook handling has no replay/idempotency guard | low | Before launch | S | Suppresses duplicate webhook forwards |
| AR-S1 | AR | Public Traffic, Admin Ops, Cron Work, and Campaign Sending Share One Runtime Boundary | strategic | Later | XL | Reduces long-term blast radius |

## 13. Top 10 Highest-ROI Improvements
1. `UX-B1` Make the public share page actually show the public breakdown and embed artifact promised by the product spec.
2. `DO-H1` Tighten CI so it proves real login, badge, and health behavior in a deployment-shaped environment.
3. `QA-H1` Stop accepting broken badge/login paths in smoke coverage; otherwise the pipeline cannot validate launch readiness.
4. `PE-H3` Fix the badge lock collapse so burst traffic does not fan out expensive duplicate renders.
5. `BE-H1` Make public-profile side effects fail open under Redis outages instead of silently dropping correctness-critical writes.
6. `BE-H2` Add lease/idempotency controls to campaign sending before any public email-driven launch.
7. `FE-H1` Move non-essential client runtime out of the root shell to lower JS cost across the entire public site.
8. `FE-H2` Split the Studio preview stack away from the public share page so custom badges do not penalize the main route.
9. `DO-M1` Reconcile docs and code for health/auth/required secrets so operators are not using stale procedures during launch.
10. `SE-M1` Make auth cookies fail-secure by default instead of depending on a public base URL string.

## 14. Before Launch / After Launch / Later Strategic
### Before launch (Wave 1)
- `UX-B1`: Public share pages hide the product’s core explanation from the actual public audience
- `DO-H1`: CI can go green without proving launch-critical runtime integrations work
- `DO-H2`: Runtime detection is still mostly passive; there is no evidence of an active alerting path
- `FE-H1`: Shared global client shell is inflating the baseline JS cost of nearly every route
- `FE-H2`: The public share page is coupled to the Studio preview runtime for customized badges
- `BE-H1`: Public profile side effects fail closed when Redis is unavailable
- `PE-H1`: Public routes carry an oversized client baseline before page-specific UI is added
- `PE-H2`: The share page ships owner-only dashboard and preview code to every visitor
- `PE-H3`: The badge render lock collapses after 300ms, so cache-miss bursts can still fan out expensive renders
- `QA-H1`: Smoke coverage explicitly allows broken badge and login paths to pass
- `BE-H2`: Campaign sending has no claim/lease boundary, so concurrent invocations can send duplicate emails
- `AR-M3`: Verification reads have two sources of truth
- `DO-M1`: Operational documentation has drifted from actual auth, health, and secret requirements
- `DO-M2`: The documented migration validation path is broken
- `SE-M1`: Cookie security depends on a public env var instead of a fail-secure default
- `BE-M3`: Resend webhook forwarding is not idempotent
- `BE-M1`: Snapshot-mutating endpoints do not maintain a coherent cache invalidation sequence
- `BE-M2`: Campaign admin APIs validate campaign rows on read, but not campaign payloads on write
- `FE-M1`: Studio availability is determined inconsistently between server routing and client navigation
- `FE-M2`: Admin summary cards are computed from paginated rows but presented as whole-dataset KPIs
- `FE-M3`: Admin table requests can race and overwrite newer state with stale responses
- `SE-M2`: Third-party bearer tokens are stored in the client session cookie
- `AR-M1`: Core Profile Retrieval Has Become a God Module
- `PE-M2`: Cache operations on hot paths have error handling but no latency budget
- `UX-H1`: The launch copy is systemically in English despite the repo’s stated Spanish requirement
- `UX-M1`: Status semantics are inconsistent across errors and verification, so users cannot rely on color or layout cues
- `UX-M2`: Reduced-motion support is partial, so accessibility behavior changes unpredictably from screen to screen
- `PE-M1`: The public share/badge hot path still blocks TTFB on several synchronous remote operations
- `SE-L1`: Third-party license inventory is stale and incomplete
- `SE-L2`: Resend webhook handling has no replay/idempotency guard

### After launch (Wave 2)
- `AR-M2`: Route-Owned Modules Leak Upward Into Shared Layers
- `AR-L1`: Dead-Code Drift Is Starting to Accumulate in the Dashboard Layer
- `QA-L1`: Passing tests emit expected-error noise that weakens CI signal quality
- `FE-L1`: Owner visits to the share page trigger an automatic second refresh cycle after the initial render

### Later / strategic (Wave 3)
- `AR-S1`: Public Traffic, Admin Ops, Cron Work, and Campaign Sending Share One Runtime Boundary

## 15. Open Questions / Assumptions
- This audit used 8 domain tracks, but the harness capped parallel subagents at 6. QA synthesis was completed locally; the final UX section was replaced once the delayed UX specialist output arrived.
- Specialist outputs were partial-by-design after forced stop instructions; the findings here are high-signal, not exhaustive.
- No deployed preview with real non-prod secrets was validated during this pass. The strongest unresolved question is still whether OAuth, badge generation, and dependency-backed health behave correctly in a deployment-shaped environment.
- The current GitHub Actions run on `develop` (`24841255535`) had `Lint & Typecheck`, `Test`, and `Build` green during the audit, while `E2E Tests` were still in progress.
- `pnpm outdated` showed only modest dependency drift in the local workspace, but no full upgrade-risk analysis was done in this report.

## 16. Final Verdict
- Verdict (repeat from §1 for parser): NOT READY
- What would most worry you about shipping today?
  The product’s core public artifact is not actually public enough: share pages are withholding the breakdown and embed explanation promised by the repo’s own contract, while CI would still tell the team “green” even if login or badge rendering were broken in deployment. The next biggest worry is duplicate user-facing email sends and a share/badge path that is heavier and more fragile than it should be.
- What gives you confidence?
  The repo is already disciplined: core verification passed locally, automated coverage is broad, circular dependencies were not found, and the major issues are understandable engineering problems rather than chaotic unknowns.
- Next 5 actions (ordered)
  1. Fix `UX-B1` so public share pages expose the public breakdown and embed artifact promised by the product contract.
  2. Fix `DO-H1` and `QA-H1` so the pipeline proves launch-critical runtime behavior in a deployed non-prod environment.
  3. Fix `PE-H3` and `BE-H1` so public badge/profile traffic behaves sanely under cache misses and Redis degradation.
  4. Fix `BE-H2`, `BE-M3`, and `SE-L2` so email sends and webhooks are concurrency-safe and idempotent.
  5. Reduce public-route JS and hydration cost by addressing `FE-H1`, `FE-H2`, `PE-H1`, and `PE-H2`.
