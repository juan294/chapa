# Agent Shared Context
> Cross-agent intelligence — agents read this before running and write findings after finishing.
> Pruned automatically to keep the last 3 entries per agent type.
>
> **Rules:**
> 1. Read this file before starting any work
> 2. Write an entry after finishing — use the format below
> 3. Cross-agent recommendations are mandatory
> 4. Maximum 3 entries per agent type — remove the oldest when adding a new one
> 5. Be specific with findings — numbers, file paths, and actionable items

<!-- ENTRY:START agent=cost-analyst timestamp=2026-03-19T06:00:00Z -->
## Cost Analyst — 2026-03-19
- **Status**: GREEN
- Estimated monthly cost at 10K users: ~$66 (Vercel $26, Redis $20, Resend $20, Supabase free). At 50K users: ~$91–111/mo. Stable — no new cost risks.
- Redis: 26 key pattern families (up from 22 — more granular count). TTL coverage 100% per-user keys. 3 global singletons without TTL — intentional, combined <16 KB.
- **Estimated Redis memory @10K users: ~590 MB** — unchanged. OG images ~375 MB (48h TTL) remain #1 consumer. Well within Upstash Pro 10 GB.
- GitHub API budget: ~690 calls/hr peak vs 5,000/hr limit. 86% headroom. In-flight dedup reduces concurrent calls 40–60%.
- Supabase: 9 tables + 2 views. Singleton lazy client, PostgREST REST API. 0 N+1 patterns. Batch queries correct (upsert, `.in()` filters). RLS on all 9 tables. Runtime `parseRow()` validation. Index coverage: 10/10 critical queries covered. All hot paths indexed — no sequential scans.
- Fetch timeout coverage: **99%+** — all raw `fetch()` calls have `AbortSignal.timeout()`. Gaps unchanged: `listAllContacts()` paginated loop (no overall timeout), `pingRedis()`/`pingSupabase()` (no explicit timeout wrapper).
- Resource leaks: **0 critical**. OG image `Promise.race()` timer not cleared (LOW — harmless in serverless). All other cleanup verified.
- **CARRIED: `Promise.all()` in badge SVG route** (`route.ts:103`) — `dbGetToolInsights()` can throw on non-PGRST116 Supabase errors (`tool-insights.ts:127`), `getCachedLatestSnapshot()` can propagate DB errors, `getAvatarBase64()` has no try/catch. A Supabase error crashes the entire badge. Should use `Promise.allSettled()` with fallbacks. (Since 2026-03-17.)
- **CARRIED: `/api/studio/config` docs mismatch** — CLAUDE.md says POST, code exports GET+PUT. (Since 2026-03-06.)
- **CARRIED: `dbGetCampaignStats()` JS aggregation** (`campaigns.ts:350-382`) — fetches all rows, counts in JS. Should use SQL `GROUP BY` at scale. Negligible currently. (Since 2026-03-18.)
- **CARRIED: Missing fetch timeout on `listAllContacts()`** — paginated Resend SDK loop could hang until Vercel 300s limit. (Since 2026-03-18.)
- **CARRIED: `/api/health` ping lacks timeout** — `pingRedis()` (`redis.ts:255`) and `pingSupabase()` (`supabase.ts:38`) have no explicit timeout. Could stall on hung service. (Since 2026-03-18.)
- Vercel: ~12 ISR, ~3 dynamic, ~46 API routes. No edge runtime. 3 cron jobs (90 executions/mo, ~27.5 compute-min/mo vs 2160 free).

**Cross-agent recommendations:**
- [Performance]: Redis memory stable at ~590 MB @10K. OG images (~375 MB) remain #1 Redis consumer — consider blob storage at scale. `dbGetCampaignStats()` JS aggregation won't scale past ~10K sends/campaign.
- [Security]: Fail-open rate limiting intact. Fetch timeouts at 99%+ coverage. Campaign email quota (95/day) prevents abuse. No cost-security concerns.
- [Coverage]: `Promise.all()` at `badge.svg/route.ts:103` untested for partial-failure scenarios — `dbGetToolInsights` can throw on non-PGRST116 errors. Campaign API routes at 96.7% aggregate.
- [QA]: Badge SVG `Promise.all()` at line 103 needs `allSettled()` conversion — verified that all 3 functions can throw. `/api/studio/config` docs mismatch pending (13 days). `/api/health` needs timeout wrapper.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=performance timestamp=2026-03-12T17:15:00Z -->
## Performance Engineer — 2026-03-12
- **Status**: GREEN
- Build: Next.js 16.1.6 (Turbopack), compiles in 2.7s, 0 TypeScript errors
- Total client JS: 1,434 KB (1.4 MB) across 53 chunks. No chunk exceeds 500 KB. +58 KB vs last report (moderate, no action needed).
- Largest chunk: 219 KB (Next.js framework). PostHog at 175 KB (lazy-loaded on first interaction — optimal).
- **Share page ISR: RESOLVED** — `revalidate=3600` now in place with test assertion at `page.test.ts:120`.
- Knip: **60 unused exports + 42 unused types** — 19 are intentional test hooks (`_`-prefixed), 10 are effects library exports, 24 are genuinely unused and candidates for removal. 280 "unused files" are all test files (needs `knip.json` config). 3 unused devDependencies (`eslint-plugin-*`).
- Font loading: optimal (`next/font/google` with `display: "swap"`, no external requests).
- CLS risks: none — no bare `<img>` tags, all assets are inline SVG or base64 data URIs.
- Badge SVG caching: `s-maxage=21600, stale-while-revalidate=604800` — correct. Error fallback: `s-maxage=300`.
- `"use client"` audit: 82 files total (excluding tests), 79 legitimate, 3 removable (marginal impact): `ShareBadgePreviewLazy.tsx`, `GlobalCommandBarLazy.tsx`, `overall-health-banner.tsx`.
- Dynamic imports: 9 heavy components properly code-split via `next/dynamic` with `ssr: false`.
- Studio page forced dynamic (imports `headers()`) — low traffic, marginal impact.

**Cross-agent recommendations:**
- [Coverage]: `ParticleBackground.tsx` (112 stmts, 0.9%) and `hexmap/page.tsx` (132 stmts, 0%) still canvas-heavy and untested — smoke tests recommended. Share page ISR now has test assertion.
- [Security]: No performance-related security concerns. PostHog CSP correctly scoped. Rate limiting fail-open by design.
- [QA]: Previous `ActivityHeatmap.tsx` hardcoded hex issue confirmed RESOLVED by QA. 3 removable `"use client"` directives are cosmetic, not functional issues. Missing error boundaries on 5 routes (from QA report) is resilience, not performance.
- [Cost Analyst]: OG image cache (~5 GB @ 10K users) remains the #1 Redis cost concern. Consider blob storage or reduced TTL. Share page ISR is now in place — no longer a cost concern.
- [Documentation]: Create `knip.json` config and document the 24 genuinely unused exports for removal consideration.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=documentation timestamp=2026-03-13T09:00:00Z -->
## Documentation Agent — 2026-03-13
- **Status**: YELLOW
- Route coverage: 11/54 routes documented in CLAUDE.md (20%). All 11 documented routes exist and are accurate except `/api/studio/config` (docs say POST, code exports GET+PUT — **carried from 2026-03-06, still unfixed**).
- Design system: 50/51 tokens documented (98%). Previous 15-token gap resolved — only `--color-complement` (`#10B981`) remains undocumented. All 17 animations documented. All hex values accurate.
- Env vars: 29/30 vars match — **NEW: `NEXT_PUBLIC_INSIGHTS_ENABLED`** used in `lib/feature-flags.ts:33,80` but missing from CLAUDE.md and `.env.example`. Dead var `NEXT_PUBLIC_POSTHOG_PROJECT_ID` in `.env.local` (unused).
- JSDoc coverage: 71/89 exported functions documented (80%) — unchanged from last audit. 18 complex functions still lack JSDoc: 6 scoring functions in `lib/impact/v4.ts`, 3 merge functions in `lib/github/merge.ts`, 3 auth cookie functions, rendering and history helpers.
- All 7 required docs exist and are non-empty. README has full setup instructions (195 lines).
- 1 outstanding TODO: badge reference PNG in `badge-svg-spec-v1.2.md:905`.
- Archetype naming drift: CLAUDE.md lists "Quality Champion" but codebase has `/archetypes/guardian` — still unresolved.

**Cross-agent recommendations:**
- [QA]: `/api/studio/config` method mismatch (POST vs GET+PUT) still pending — verify no integration tests assert POST. Archetype naming ("Quality Champion" vs "Guardian") consistency still needs resolution across UI.
- [Security]: Auth cookie functions `createSessionCookie()`, `readSessionCookie()`, `clearSessionCookie()` in `lib/auth/github.ts` still lack JSDoc. No vulnerability, but increases risk of misuse. `NEXT_PUBLIC_INSIGHTS_ENABLED` is a boolean flag — no secret exposure risk.
- [Coverage]: 18 undocumented complex functions overlap with files at lower coverage. Priority JSDoc targets: `lib/impact/v4.ts` scoring functions, `lib/github/merge.ts` merge logic.
- [Performance]: Design system token documentation nearly complete (98%). No remaining performance-documentation concerns.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=security timestamp=2026-03-16T09:00:00Z -->
## Security Scanner — 2026-03-16
- **Status**: GREEN
- Vulnerabilities: 0 critical, 0 high, 0 medium, 0 low — `pnpm audit` clean.
- Secret leaks: none — all 10 server secrets isolated, 7 NEXT_PUBLIC_ vars are non-sensitive. Error logging scrubs tokens via regex before PostHog.
- License issues: 1 LGPL-3.0 (`@img/sharp-libvips-darwin-arm64`) — dynamically linked, no compliance action needed.
- XSS: all 7 user-input entry points in SVG pipeline escaped via `escapeXml()`, explicit XSS tests at `BadgeSvg.test.tsx:600-626`. Fallback SVG also escapes.
- CORS: only `/api/verify/[hash]` allows `*` (intentional, rate-limited 30 req/60s, read-only). CSP properly configured in `next.config.ts`. Global headers: HSTS, nosniff, X-XSS-Protection.
- RLS: **all 10 Supabase tables** RLS-enabled with explicit deny policies (up from 6). NEW: `email_campaigns`, `campaign_sends` added with deny policies in migration 016. Views use `security_invoker = true`.
- Knip: clean — 1 config hint only (redundant entry pattern).
- Hardcoded secrets: none found in source. All env vars `.trim()`ed.
- OAuth: CSRF state validation, redirect URL validation, AES-256-GCM token encryption, 10s fetch timeouts.
- Fetch timeout coverage: **100%** — all external calls have `AbortSignal.timeout()`.
- Campaign email system: auth checks, daily send quota (95), batch size 50, Redis counter. Follows existing security patterns.

**Cross-agent recommendations:**
- [Coverage]: All security-critical paths at 86%+. Campaign API routes at 77–78% need error-path coverage. XSS tests comprehensive. HMAC verification at 100%.
- [QA]: No security UX issues. Campaign send pipeline uses batch operations and daily limits correctly. Process stream leak (admin agent route) is resource hygiene, not security.
- [Cost Analyst]: Fail-open rate limiting intact. All fetch timeouts in place (100%). Campaign email quota prevents abuse. No cost-security concerns.
- [Performance]: No security-related performance concerns. Rate limiting fail-open by design. CSP `connect-src` properly scoped.
- [Documentation]: Auth cookie functions still lack JSDoc — documentation gap increases misuse risk, not a vulnerability.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=qa timestamp=2026-03-18T09:00:00Z -->
## QA Agent — 2026-03-18
- **Status**: GREEN
- Tests: 5,495/5,495 passed across 318 files, 0 failed, 0 skipped (+954 tests, +35 files vs last QA 2026-03-11)
- Type errors: 0 (tracked code). 7 false positives from 11 untracked macOS duplicate ` 2.ts` files — should be deleted.
- Lint issues: 1 warning — `announcement.test.ts:92` (`_unused` variable). 3 false positives from duplicate files.
- A11y issues: 0 — WCAG 2.1 AA compliant. All images have alt text. ARIA labels comprehensive. Global + component `focus-visible` indicators. `prefers-reduced-motion` CSS blanket + JS checks. Focus traps in modals. Minor: `/experiments/number-counters/page.tsx` has h1 after h2s (gated, low priority).
- Design system: **0 violations** in production components. All use semantic tokens. Badge SVG / OG image / email templates intentionally hardcoded (per CLAUDE.md).
- Error handling: **8 error boundaries** (up from 3): root, global-error, about, admin, experiments, generating, studio, u/[handle], verify. 8 loading states. SVG fallback with XSS escaping.
- Error gaps: `/archetypes/*` (7 sub-routes), `/cli/*`, `/coming-soon`, `/privacy`, `/terms` lack error boundaries. 22 of 41 API routes lack explicit try/catch (many are thin wrappers using `dbTimeoutOr504()`).
- **RESOLVED since last QA**: `Promise.all()` → `Promise.allSettled()` in insights route. `dbCleanOldSnapshots()` implemented. Prior coverage priorities (UserMenu, StudioClient, BadgeToolbar) all above 80%.
- **STILL OPEN**: Badge SVG `Promise.all()` at `route.ts:103` needs `Promise.allSettled()`. `/api/studio/config` docs mismatch (POST vs GET+PUT).

**Cross-agent recommendations:**
- [Coverage]: Priority test additions: (1) `lib/insights/validation.ts` (79.5%), (2) `PostHogProvider.tsx` (24.1%), (3) `HolographicOverlay.tsx` (47.1%). All prior priorities resolved. +954 tests since last QA.
- [Security]: No security-related quality issues. All XSS vectors covered. Campaign pipeline uses proper auth + quotas.
- [Cost Analyst]: Badge SVG `Promise.all()` at `route.ts:103` still needs `Promise.allSettled()` — craft DB error crashes badge. `/api/studio/config` docs mismatch still pending.
- [Performance]: 0 design system violations. Error boundaries expanded to 8 routes. Missing boundaries on static/low-traffic routes only.
- [Documentation]: `/api/studio/config` method mismatch needs docs update (POST → GET+PUT). 11 duplicate ` 2.ts` files should be deleted from working directory.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage timestamp=2026-03-19T06:40:00Z -->
## Coverage Agent — 2026-03-19
- **Status**: GREEN
- Overall coverage: **87.45% stmts** (6,752/7,721), 82.19% branch, 78.79% funcs
- Test suite: 318 files, 5,495 tests, 100% pass rate, 0 flaky (5 runs)
- Delta vs 2026-03-18: **+0.00% stmts** (flat). No regressions, no new tests. Stable.
- **WARNING: 10 macOS duplicate " 2" files** inflate raw totals by 882 stmts, making raw coverage appear 78.48%. Actual coverage after excluding dupes is 87.45%. These are untracked files that should be deleted.
- Critical paths all GREEN: `lib/render` 100%, `lib/verification` 100%, `packages/shared` 100%, `lib/impact` 99.5%, `lib/cache` 99.0%, `lib/history` 98.2%, `lib/codeberg` 97.5%, `lib/github` 97.1%, `app/api` 96.7%, `lib/db` 94.9%, `lib/email` 94.7%, `lib/auth` 94.7%, `lib/insights` 93.0%, `lib/bitbucket` 93.1%, `lib/effects` 90.5%, `components` 88.8%, `lib/crypto` 85.7%
- `app/pages` at 73.6% — 46 files below 80%, nearly all are Next.js server component wrappers (0% due to V8 instrumentation, tested indirectly)
- `app/experiments` at 56.2% — 11 files below 80%, all behind feature flag
- Previous flaky test (`BadgeToolbar.render.test.tsx` canvas download) did NOT reproduce in 5 runs this session
- 2 untested production files: `lib/crypto/safe-equal.ts` (security-critical timing-safe comparison), `lib/async/process-in-batches.ts` (batch utility)
- 1 file at threshold: `lib/insights/validation.ts` (79.5% — needs ~1 test to cross 80%)

**Cross-agent recommendations:**
- [Security]: All security-critical paths at 93%+. `lib/crypto/safe-equal.ts` still lacks dedicated tests despite being security-critical (used for bearer token validation). XSS tests at `BadgeSvg.test.tsx:600-626`. HMAC verification at 100%.
- [QA]: Priority test additions unchanged: (1) `lib/crypto/safe-equal.ts` (0%, security-critical), (2) `lib/async/process-in-batches.ts` (0%, production utility), (3) `lib/insights/validation.ts` (79.5%). 10 macOS duplicate files should be deleted — they cause 7 false-positive type errors and pollute coverage. Flaky test resolved (0 in 5 runs).
- [Performance]: `hexmap/page.tsx` (132 stmts, 0%) still untested. Experiment pages low priority. No regressions.
- [Cost Analyst]: All module coverages stable. No new gaps since last report.
- [DevOps]: All thresholds pass with 12%+ margin. Duplicate file cleanup would eliminate confusing raw metric discrepancy.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-03-19T07:30:00Z -->
## Triage — 2026-03-19
- **Reports processed**: 4 (coverage, cost-analyst, qa, cc-rpi-update)
- **Action items resolved**: 14 of 15 (1 skipped: heading hierarchy was false positive)
- **Summary**: Badge SVG `Promise.all()` → `Promise.allSettled()` (carried 3 days). Deleted 11 macOS duplicate files. Added tests for `safe-equal.ts` and `process-in-batches.ts` (0% → covered). Added 5 validation tests. Added 5s timeouts to `pingRedis()`/`pingSupabase()`, 30s timeout to `listAllContacts()`. Added 4 error boundaries + 3 loading states. Fixed lint warning. Cleaned up `dbGetCampaignStats()`. JSDoc additions for scoring/merge functions in progress.
- **Tests**: 5,518 passing (+23 new), 0 type errors, 0 lint issues
**Cross-agent recommendations:**
- [Coverage]: `safe-equal.ts` and `process-in-batches.ts` now have dedicated tests. `validation.ts` should cross 80% threshold. Badge SVG allSettled has 3 new resilience tests.
- [QA]: 4 new error boundaries (archetypes, coming-soon, privacy, terms) + 3 loading states (cli/authorize, privacy, terms). Duplicate files eliminated — false typecheck/lint noise resolved.
- [Cost Analyst]: All 5 carried items resolved: badge SVG allSettled, listAllContacts timeout, health ping timeouts, studio config docs (already correct), campaigns stats cleanup.
- [Security]: Health check endpoints now have explicit 5s timeouts — won't stall on hung Redis/Supabase.
<!-- ENTRY:END -->
