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

<!-- ENTRY:START agent=cost-analyst timestamp=2026-04-20T03:00:00Z -->
## Cost Analyst — 2026-04-20
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$55–70/mo**. Unchanged.
- Redis: TTL 100% on per-user keys. 3 no-TTL keys (rotation offset + 2 HyperLogLogs — all intentional, bounded). Storage: **~300–800 MB @10K users** (~91% headroom). 12-pattern full audit confirmed. `withTimeout()` timer cleanup verified — no leaks anywhere in cache layer.
- GitHub API: cache-first (6h + 7d stale). Fetch timeouts 100%. No unconditional GitHub calls in any route. Only uncached call is `/api/health` GitHub probe (intentional, 3s timeout).
- Supabase: **9 tables + 1 view** (`admin_users`). Singleton lazy client. 0 N+1 patterns. Batch queries throughout.
- ISR: all static pages confirmed (`/about`→86400, `/archetypes/*`→604800, `/`→3600, `/u/[handle]`→3600). `/studio` + `/experiments` force-dynamic (intentional).
- Cron: **4 handlers** at maxDuration=300s — warm-cache, process-campaigns, sync-audience (all scheduled daily), bulk-recalculate (admin on-demand only).
- **P1s: NONE. P2s: 1 active.**
- **P2-1 CARRIED**: `dbGetCampaignStats()` client-side aggregation (`lib/db/campaigns.ts:439`). Move to RPC at >5K sends/campaign.
- All prior P3s resolved: P3-1 (pingRedis timer) fixed 2026-04-19 triage; P3-2 (CLI device session TTL=300) confirmed 2026-04-19 triage.
- **MONITOR M1**: Avatar cache Redis memory (~300 MB max @10K users). CARRIED.
- **MONITOR M2**: OG image Redis memory (~150 MB max @1K active/day). CARRIED.
- **MONITOR M3**: HyperLogLog ~12 KB. Track quarterly. CARRIED.
- **MONITOR M4**: `metrics_snapshots` table growth (~3.65M rows/year at 10K users). CARRIED.

**Cross-agent recommendations:**
- [Performance]: No new cost-performance tradeoffs. All ISR confirmed correct. `/studio` force-dynamic is intentional (user auth). No serverless reduction opportunities remain.
- [Security]: Fetch timeouts 100%. `withTimeout()` timer cleanup confirmed across all external calls. No cost-security conflicts.
- [Coverage]: app/api 97.5%, lib/db 97.6% — stable. No new cost-critical path coverage gaps.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=cost-analyst timestamp=2026-04-19T03:00:00Z -->
## Cost Analyst — 2026-04-19
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$55–70/mo**. Unchanged.
- Redis: TTL 100% on per-user keys. 3 no-TTL keys (all intentional, bounded). Storage: **~300–800 MB @10K users** (~91% headroom). 16-key-pattern audit confirmed. No new patterns since 2026-04-18.
- GitHub API: cache-first (6h + 7d stale + in-flight dedup). Fetch timeouts 100%. Unchanged.
- Supabase: **10 tables + 2 views**. Singleton lazy client. 0 N+1 patterns. 0 resource leaks.
- ISR audit: all static pages correctly configured (`/about`→86400, `/archetypes/*`→604800, `/`→3600, `/u/[handle]`→3600). **P3-1 from 2026-04-18 was a false positive — closed.**
- No new commits since 2026-04-18 in cache/db/api areas.
- **P1s: NONE. P2s: 1 active.**
- **P2-1 CARRIED**: `dbGetCampaignStats()` client-side aggregation (`lib/db/campaigns.ts:439`). Move to RPC at >5K sends/campaign.
- **P3-1 NEW**: `pingRedis()` raw `setTimeout` not cleared in `Promise.race()` (`lib/cache/redis.ts:262–266`). Same pattern fixed elsewhere in 2026-04-17 triage. Cosmetic — health check path only.
- **P3-2 CARRIED**: CLI device session key TTL unconfirmed (`api/cli/auth/approve/route.ts`). Pending verification.
- **MONITOR M1**: Avatar cache Redis memory (~300 MB max @10K users). CARRIED.
- **MONITOR M2**: OG image Redis memory (~150 MB max @1K active/day). CARRIED.
- **MONITOR M3**: HyperLogLog ~12 KB. Track quarterly. CARRIED.
- **MONITOR M4**: `metrics_snapshots` table growth (~3.65M rows/year at 10K users). CARRIED.

**Cross-agent recommendations:**
- [Performance]: No new cost-performance tradeoffs. ISR confirmed correct on all static pages — no serverless reduction opportunity remains. `/studio` force-dynamic is intentional.
- [Security]: No cost-security conflicts. Fetch timeouts 100% confirmed. P3-1 timer leak is health-check only — zero auth or data exposure risk.
- [Coverage]: app/api 98.9%, lib/db 97.5% — stable. P3-1 (`pingRedis` timer) is in the health-check path — low value to test.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=performance timestamp=2026-04-09T09:00:00Z -->
## Performance Engineer — 2026-04-09
- **Status**: GREEN
- Build: Next.js 16.2.2 (Turbopack), compiled 2.8s, 0 TypeScript errors. 64 static pages, 84 routes (5 static, 79 dynamic).
- Total client JS: **1,682 KB (1.64 MB)** — +19 KB (+1.1%) vs 2026-04-02. 68 chunks, no chunk >500 KB. Gzipped: ~522 KB. CSS: 103 KB raw / 15 KB gzip.
- Largest chunks: 232 KB (framework), 173 KB (PostHog lazy), 137 KB (React DOM), 113 KB (polyfills). All vendor/framework — no app code chunk >64 KB.
- Knip: **0 findings** — fully clean.
- `"use client"` audit: 98 non-test files. All appropriate (error boundaries, interactive components, canvas/WebGL experiments, hooks). No misplaced directives.
- Dynamic imports: 6 files use `next/dynamic` with `ssr: false` — `GlobalCommandBarLazy`, `ShareBadgePreviewLazy`, `AgentsDashboard`, `EngagementDashboard`, `CampaignsDashboard`, `ShortcutCheatSheet`.
- **Finding (LOW)**: Landing page imports `GlobalCommandBar` synchronously via `LandingTerminal` re-export (`app/page.tsx:10`). Admin + share pages use `GlobalCommandBarLazy` instead. Inconsistency — consider unifying or documenting.
- Font loading: optimal (`next/font/google`, `display: "swap"`, Latin subset only).
- CLS risks: **none** — all 3 `<Image>` components have explicit dimensions (`width`+`height`). Bare `<img>` in `SharePageOwnerContent.tsx:44` is embed code string, not rendered in DOM.
- Badge SVG caching: `s-maxage=21600, stale-while-revalidate=86400` (success), `s-maxage=300, stale-while-revalidate=600` (error). Correct.
- Turbopack NFT warning: **PERSISTS** despite `turbopackIgnore` comments added 2026-04-03 — `existsSync` in `svg-to-png.ts:38` also triggers full-project tracing. Cosmetic only, no functional impact.

**Cross-agent recommendations:**
- [Coverage]: No new performance-coverage gaps. All rendering/API paths at 93%+. Canvas/WebGL experiments remain untestable in JSDOM — accepted limitation.
- [Security]: No performance-related security concerns. Knip clean (0 findings). PostHog CSP correctly scoped.
- [QA]: Landing page `GlobalCommandBar` synchronous import is minor inconsistency — worth documenting or standardizing.
- [Cost Analyst]: Bundle grew only +19 KB vs last cycle — stable. OG image Redis memory monitor carried.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=performance timestamp=2026-04-02T09:00:00Z -->
## Performance Engineer — 2026-04-02
- **Status**: GREEN
- Build: Next.js 16.2.1 (Turbopack), compiled 5.4s, 0 TypeScript errors. 64 static pages, 84 routes (5 static, 79 dynamic).
- Total client JS: **1,663 KB (1.63 MB)** — down 137 KB (-8%) from 1,800 KB on 2026-03-26. No chunk exceeds 500 KB. Largest: 232 KB (framework), 179 KB (PostHog lazy), 137 KB (React DOM), 113 KB (polyfills).
- Knip: **0 production findings** — fully clean. 384 test files flagged as false positives (expected, not in entry graph).
- `"use client"` audit: 56 non-test files (41 components, 15 lib). All appropriate — error boundaries, admin dashboard, studio, experiments (canvas/WebGL), hooks. No misplaced directives.
- Dynamic imports: `ShareBadgePreviewLazy.tsx` + `GlobalCommandBarLazy.tsx` confirmed `next/dynamic` with `ssr: false`. Admin sub-dashboards (Agents, Engagement, Campaigns) code-split.
- Font loading: optimal (`next/font/google`, `display: "swap"`, Latin subset). No external font requests.
- CLS risks: **none** — all 4 `<Image>` components have explicit dimensions, no bare `<img>` tags.
- Badge SVG caching: `s-maxage=21600, stale-while-revalidate=86400` (success), `s-maxage=300, stale-while-revalidate=600` (error). Correct.
- 1 Turbopack NFT warning (LOW): `svg-to-png.ts:36-37` uses `path.join(process.cwd(), ...)` causing full-project file tracing for OG image route. Cosmetic — add `/*turbopackIgnore: true*/` to resolve.

**Cross-agent recommendations:**
- [Coverage]: No new performance-coverage gaps. All rendering/API paths at 91%+. `AdminDashboardClient.tsx` funcs at 68.4% remains the only persistent P1.
- [Security]: No performance-related security concerns. Knip fully clean (0 production findings). CSP correctly scoped.
- [QA]: All previous performance-QA items remain resolved. Bundle decreased -8% — no regressions.
- [Cost Analyst]: Bundle reduced to 1,663 KB (-137 KB). OG image Redis memory monitor unchanged — CDN `s-maxage=21600` bounds generation. Turbopack NFT warning may slightly increase Lambda size for OG image route.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=documentation timestamp=2026-04-17T10:00:00Z -->
## Documentation Agent — 2026-04-17
- **Status**: GREEN
- Route coverage: **50/50 API routes + 24 pages documented** (100%). 6 net new routes vs 2026-04-10 (Codeberg auth, campaign CRUD, telemetry, engagement-flags additions).
- Design system: **38/38 dark-theme color tokens** accurate. **3 minor gaps**: light values for `--color-dark-section` (`#1A1A2E`), `--color-dark-card` (`#252542`), and 4 terminal tokens not listed in table. All values correct in `globals.css` — docs formatting only.
- Env vars: **33/33 production vars documented** (100%). `TESTPLATFORM_*` confirmed test-only.
- JSDoc coverage: **100% on public exports**. Spot-checked `lib/impact/v6.ts` — all 8 exports have JSDoc.
- Required docs: all 6 present and non-empty. `impact-v4.md` correctly marked deprecated. No TODO/FIXME referencing doc gaps (2 false positives: agent-config template text + test mock string literal).
- Shared-context entries through 2026-04-17. Stable.

**Cross-agent recommendations:**
- [QA]: No doc changes needed for UX. Three low-severity design-system table gaps don't affect runtime behavior.
- [Security]: No security doc gaps. All `NEXT_PUBLIC_*` vars confirmed non-sensitive. `ALLOW_AGENT_RUN` documented and confirmed in use at `app/api/admin/agents/run/route.ts:75`.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=documentation timestamp=2026-04-10T10:00:00Z -->
## Documentation Agent — 2026-04-10
- **Status**: GREEN
- Route coverage: **44/44 API routes + 15 pages documented** (100%). Unchanged from 2026-04-03. No new routes added.
- Design system: **38/38 color tokens** (100%) and **18/18 animations** (100%). All hex values verified accurate in both light and dark theme variants.
- Env vars: **31/31 production vars documented** (100%). `TESTPLATFORM_*` confirmed test-only. `CI`/`NODE_ENV`/`ANALYZE` are standard build vars (intentional omissions).
- JSDoc coverage: **100% on public exports**. No gaps found across lib/impact, lib/render, lib/cache, lib/auth, lib/github, packages/shared.
- Required docs: all 6 present and non-empty (`impact-v4.md`, `impact-v6.md`, `svg-design.md`, `README.md` 215 lines, `design-system.md`, `shared-context.md`). 0 TODO/FIXME referencing doc gaps.
- Shared-context has entries up to 2026-04-10. Stable.

**Cross-agent recommendations:**
- [QA]: No documentation-related test concerns. BadgeToolbar flaky test (coverage agent P2 escalated) is not a docs issue — no doc changes needed.
- [Security]: No security-related doc gaps. All env vars correctly scoped. `NEXT_PUBLIC_*` vars confirmed non-sensitive.
- [Coverage]: No doc-coverage gaps remaining. All critical-path functions have JSDoc.
- [Cost Analyst]: No doc gaps affecting cost model. All routes and env vars fully documented.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=security timestamp=2026-04-20T09:00:00Z -->
## Security Scanner — 2026-04-20
- **Status**: GREEN
- Vulnerabilities: **0 critical, 0 high, 0 moderate, 0 low** — `pnpm audit` fully clean. Prior vite CVEs resolved by vite ≥8.0.8 bump (triage 2026-04-17).
- Secret leaks: none — all server secrets isolated. `NEXT_PUBLIC_*` vars non-sensitive. `SENSITIVE_PATTERNS` regex (9 patterns) in `lib/analytics/server-errors.ts` scrubs tokens before PostHog logging.
- License issues: 2 MPL-2.0 (`@resvg/resvg-js`, `lightningcss`) + 1 dual Apache-2.0/MPL-2.0 (`dompurify`). No GPL/AGPL/LGPL. No source modifications. No compliance action needed.
- Knip `--production`: **8 false positives** — all confirmed in use. Same 8 as prior cycle. Do not remove any.
- XSS: **9 user-input entry points** in SVG pipeline, all escaped via `escapeXml()`. Avatar URL enforces hostname + MIME whitelist + 5s timeout. 18 `dangerouslySetInnerHTML` uses — all safe.
- CORS: **2 routes** with wildcard `*` — `/api/verify/[hash]` (30 req/60s) + `/api/profile/[handle]` (60 req/60s). Read-only, rate-limited. Intentional design. All 17 mutation routes: no CORS headers.
- RLS: **9 tables** with ENABLE + FORCE ROW LEVEL SECURITY + explicit deny-all for anon. 2 views with `security_invoker = true`.
- OAuth: CSRF via `timingSafeEqual()`, AES-256-GCM (fresh IV), CLI tokens HMAC-SHA256 90-day expiry. Sessions: `HttpOnly`, `SameSite=Lax`, `Secure`, 10-min `Max-Age`.
- Fetch timeouts: **100%** — all external calls use `AbortSignal.timeout()` or `withTimeout()`.
- **P2 OPEN**: `lib/analytics/server-errors.ts` — 63.63% branch coverage. The 9 SENSITIVE_PATTERNS scrubbing branches are untested. Token-redaction guards before PostHog logging need test coverage.

**Cross-agent recommendations:**
- [Coverage]: Priority item — add tests for all 9 SENSITIVE_PATTERNS types in `lib/analytics/server-errors.ts`. These are security-critical token-scrubbing guards with no branch coverage.
- [QA]: No new security UX issues. All XSS vectors covered. Knip false positives confirmed stable — no removals.
- [Cost Analyst]: No new cost-security conflicts. Fetch timeouts at 100%. Fail-open rate limiting intact.
- [Performance]: Knip `--production` false positives unchanged — confirmed in active use via grep. No bundle changes.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=qa timestamp=2026-04-01T09:00:00Z -->
## QA Agent — 2026-04-01
- **Status**: GREEN
- Tests: 6,879/6,879 passed across 386 files, 0 failed, 0 skipped (+16 tests, +1 file vs 2026-03-30 triage)
- Type errors: 0
- Lint issues: 0
- A11y issues: 0 — all buttons labeled, focus-visible present, no bare `<img>` tags, no heading skips in production pages. 13 error boundaries, 13 loading states.
- Design system: **0 violations** in production components. Experiment pages use raw hex arrays (WebGL/Canvas requirement, accepted). Static icon assets (`apple-icon.tsx`, `icon.tsx`) correctly hardcoded.
- `debug-quality/route.ts` confirmed **deleted** — Cost Analyst/Coverage P1 resolved.
- Remaining open P1 (Cost Analyst): refresh rate limit still at 15/hr (debugging artifact, revert before next release).

**Cross-agent recommendations:**
- [Coverage]: `debug-quality/route.ts` coverage gap resolved by deletion. `AdminDashboardClient.tsx` funcs at 68.4% remains top actionable gap.
- [Security]: No new security-related quality issues. All XSS vectors covered, all interactive elements accessible.
- [Cost Analyst]: Refresh rate limit (15/hr) remains the only open P1 — revert before production release.
<!-- ENTRY:END -->


<!-- ENTRY:START agent=coverage timestamp=2026-04-20T02:00:00Z -->
## Coverage Agent — 2026-04-20
- **Status**: YELLOW
- Overall coverage: **93.07% stmts** (7800/8380), 89.56% branches, 89.83% funcs, 94.14% lines
- Test suite: 396 files, 7048 tests (+147 vs 2026-04-19 — remediation work added tests)
- All critical paths GREEN: lib/impact 100%, lib/render 100%, lib/db 97.6%, lib/cache 99.2%, lib/auth 97.7%, lib/github 97%, lib/history 98.2%, lib/email 97.9%, app/api 97.5%, lib/profile 100%
- **Flaky tests: NONE** — 3/3 runs passed 7048/7048.
- **P2 resolved from 2026-04-19**: warm-cache/route.ts funcs 100% (was 62.5%), public-profile.ts branches 88.88% (was 68.75%), UserMenu.tsx funcs 81.25% (above threshold)
- **P2 NEW**: `components/SharePageOwnerContent.tsx` — 59.09% stmts, 77.27% branches, 50% funcs. Owner-only interactive section (embed copy, refresh CTA) completely untested.
- **P2 carried**: `lib/analytics/server-errors.ts` — 63.63% branches. SENSITIVE_PATTERNS token-scrubbing branches uncovered — security-relevant.
- **P3 carried (all accepted)**: experiments 56.7% (Canvas/WebGL), HolographicOverlay 50% (Canvas), AuthorTypewriter 67.5% branches (JSDOM), demoData 50% branches (data tables), refresh/recalculate fire-and-forget arrows 33–50% funcs, lazy wrappers 25–50% funcs

**Cross-agent recommendations:**
- [Security]: `lib/analytics/server-errors.ts` branches at 63.63% — the uncovered paths include SENSITIVE_PATTERNS regex scrubbing branches. These are the token-redaction guards before error logs. Consider adding tests for all 9 pattern types to confirm scrubbing fires correctly.
- [QA]: Suite grew +147 tests (remediation cycle). All 3 runs clean, 0 flaky. SharePageOwnerContent P2 is the only new actionable item — owner UI interactive handlers have zero test coverage.
- [Cost Analyst]: app/api 97.5%, lib/db 97.6% — stable. No changes to caching path coverage.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage timestamp=2026-04-19T02:00:00Z -->
## Coverage Agent — 2026-04-19
- **Status**: YELLOW
- Overall coverage: **93% stmts** (7647/8222), 89.47% branch, 89.64% funcs, 94.06% lines
- Test suite: 394 files, 6894 tests — stable (0 change vs 2026-04-18, no regressions)
- All critical paths GREEN: lib/impact 100%, lib/render 100%, lib/db 97.5%, lib/cache 99.6%, lib/auth 98.8%, lib/github 97.6%, lib/history 99.1%, lib/email 97.9%, app/api 98.9%, app/api/admin 97.7%, components 94.2%
- **Flaky tests: NONE** — 3/3 runs passed 6894/6894.
- **P2 carried**: `app/api/cron/warm-cache/route.ts` — 62.5% funcs, 75% branches. Missing: `parsePriorityHandles` arrow callbacks (env var never set in tests), wrap-around rotation branch, `getAvatarBase64` catch handler.
- **P2 NEW**: `lib/profile/public-profile.ts` — 68.75% branches, 83.33% funcs. `runPublicProfileSideEffects` missing no-displayName/avatarUrl branch and false-insert path. Uncovered catch handler.
- **P2 carried**: `components/UserMenu.tsx` — 80% funcs (handleInsightsFile, at threshold).
- **P3 carried (all accepted)**: experiments 58.6% (Canvas/WebGL), HolographicOverlay 50% (Canvas), AuthorTypewriter 67.5% branches (JSDOM), demoData files 50% branches (data tables), refresh/recalculate fire-and-forget arrows, lazy wrappers 25–33% funcs

**Cross-agent recommendations:**
- [Security]: No new security-relevant test gaps. All critical-path coverage stable and GREEN. `public-profile.ts` side-effects (dbUpsertUser, storeVerificationRecord) have partial branch coverage — the uncovered paths are non-throwing fire-and-forget, low blast radius.
- [QA]: Suite stable at 6894 tests, 0 failures, 0 flaky for 4th consecutive cycle.
- [Cost Analyst]: app/api 98.9%, lib/db 97.5% — stable. warm-cache P2 unchanged — 3 uncovered arrow functions are in non-critical `parsePriorityHandles` and avatar-cache warming, not the snapshot/notification pipeline.
- [Performance]: No coverage-performance gaps. Experiment pages (Canvas/WebGL) remain the only persistent gap and are accepted.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-04-03T11:40:00Z -->
## Triage — 2026-04-03
- **Reports processed**: 6 (cc-rpi-update, cost-analyst, coverage, documentation, performance, qa)
- **Action items resolved**: 9 of 9 — all implemented
- **Summary**: Fixed P1 refresh rate limit 15→5/hr; removed dead `else if` branch in ConfirmDialog.tsx and null guard in AuthorTypewriter.tsx (dead code cleanup); added generateMetadata branch tests for verify page; updated AdminDashboardClient test to call dynamic loaders (6 uncovered factory functions now covered); added supplemental key cleanup on OAuth disconnect; added turbopackIgnore comments to svg-to-png.ts; added TESTPLATFORM_* clarification comment.
- **Tests**: 6,883 passing (+4 vs 6,879), 0 type errors, 0 lint issues
- **Coverage delta**: +4 tests. generateMetadata branches covered; AdminDashboardClient dynamic import functions covered; supplemental cleanup tested. Dead-code removal in ConfirmDialog/AuthorTypewriter eliminates 2 structural branch gaps.

**Cross-agent recommendations:**
- [Coverage]: AdminDashboardClient.tsx dynamic import factories now exercised in tests — should clear the 68.42% P1. verify/[hash]/page.tsx generateMetadata branches now covered — should close the 75% branch gap. Monitor next cycle for confirmation.
- [Cost Analyst]: Refresh rate limit now correctly 5/hr. Supplemental key cleanup added — P3 orphan risk resolved.
- [QA]: All previous P1 items resolved. No open P1s remain.
- [Performance]: turbopackIgnore comments added to svg-to-png.ts — NFT warning should be resolved in next build.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-04-07T08:00:00Z -->
## Triage — 2026-04-07
- **Reports processed**: 10 (cc-rpi-update, coverage, security, cost-analyst, pre-launch, remediation, performance, documentation, qa, update-docs)
- **Action items resolved**: 7 of 7 — all P1+P2 coverage gaps addressed
- **Summary**: Closed 3 coverage P1s from v2.7.x craft-recompute shipping without tests. Added `dbRecomputeCraft()` unit tests (6 cases), craft path mocks to refresh+recalculate routes (5 tests), new BadgeOverlay.test.tsx (16 tests), and AdminUserTable render tests (17 tests). Tests: 7000 (+45 vs 6955), 0 type errors, 0 lint issues.
- **Coverage delta**: `lib/db/tool-insights.ts` 72.72%→~99%+, `app/api/refresh` funcs 75%→100%, `app/api/recalculate` funcs 50%→100%, `components/BadgeOverlay` branches ~75%→~95%+, `app/admin/AdminUserTable` branches ~76%→~90%+

**Cross-agent recommendations:**
- [Coverage]: All 3 craft-recompute P1s resolved. Remaining P2: AuthorTypewriter branches 67.5% (JSDOM timing limit — accepted), UserMenu funcs 79.31% (handleInsightsFile complex — low priority). BadgeToolbar flaky test resolved — monitor one more cycle then close.
- [Security]: `dbRecomputeCraft` error paths are now tested — graceful degradation confirmed. Craft refresh/recalculate routes verified.
- [Cost Analyst]: `dbRecomputeCraft` P2-2 resolved — function now has full test coverage including error paths.
- [QA]: No open P1s. Test suite at 7000 tests. All critical paths remain 95%+.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-04-10T17:50:00Z -->
## Triage — 2026-04-10
- **Reports processed**: 4 (coverage, performance, documentation, cc-rpi-update)
- **Agent failures**: 3 (cost-analyst, cc-rpi-update, qa — all API limit/overload, no code action)
- **Action items resolved**: 4 of 4 — all implemented
- **Summary**: Fixed BadgeToolbar flaky test (2/3 failure rate) by replacing act()/setTimeout with waitFor; added mountedRef guard to prevent post-unmount setDownloadStatus rejection; added AbortSignal.timeout(5000) to PostHog captureServerError fetch + regression test; documented intentional synchronous GlobalCommandBar import in LandingTerminal. Tests: 7001 (+1 vs 7000), 0 type errors, 0 lint issues.
- **Coverage delta**: +1 test (server-errors AbortSignal). BadgeToolbar flaky test stabilized — previously 2/3 failures, now 0/3.

**Cross-agent recommendations:**
- [Coverage]: BadgeToolbar flaky test resolved — should be GREEN next cycle. server-errors.ts AbortSignal branch now covered. All critical paths stable.
- [Performance]: Documented LandingTerminal sync import divergence — no bundle change, just clarified intent.
- [Cost Analyst]: server-errors.ts PostHog fetch now has 5s timeout — P3-NEW from 2026-04-09 resolved.
- [QA]: 3 agents failed due to API limits on 2026-04-10 — no code issues, will rerun next scheduled cycle.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-04-11T00:00:00Z -->
## Triage — 2026-04-11
- **Reports processed**: 3 (cc-rpi-update, cost-analyst, coverage)
- **Agent failures**: 2 (cost-analyst, coverage — both 0-byte reports, empty logs, API limits again)
- **Action items resolved**: 0 — no code changes needed
- **Summary**: cc-rpi blueprint at v1.14.5, no sync needed. cost-analyst and coverage agents failed to produce reports for second consecutive day (API limits). All P1/P2s from prior cycles remain resolved. No new findings.

**Cross-agent recommendations:**
- [Coverage]: No new findings. Last known state YELLOW (93.14%) with BadgeToolbar fixed. Expect GREEN next successful run.
- [Cost Analyst]: No new findings. Last known state GREEN. All P1/P2s resolved. Carries: P2-1 campaigns RPC (future scale), OG image Redis monitor.
- [QA]: Recurring API limit failures on cost-analyst + coverage agents — if pattern persists a 3rd day, may warrant investigating agent scheduling/throttling.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-04-19T10:00:00Z -->
## Triage — 2026-04-19
- **Reports processed**: 3 (cc-rpi-update, cost-analyst, coverage)
- **Action items resolved**: 8 of 8 — all implemented
- **Summary**: Replaced last raw `Promise.race/setTimeout` timer pattern in `pingRedis()` with `withTimeout()` (P3-1 from cost-analyst); confirmed CLI device session TTL=300 in `api/cli/auth/approve/route.ts` (P3-2 resolved, no code change); added 3 tests for warm-cache route (parsePriorityHandles env var path, wrap-around rotation branch, getAvatarBase64 rejection); added 3 tests for public-profile (verification=null, no displayName/avatarUrl, dbUpsertUser rejection); added 1 test for UserMenu (craftScore absent → "Insights uploaded" toast). Tests: 6901 (+7 vs 6894), 0 type errors, 0 lint issues.
- **Coverage delta**: +7 tests. warm-cache and public-profile P2 branch/func gaps addressed.

**Cross-agent recommendations:**
- [Coverage]: warm-cache/route.ts and lib/profile/public-profile.ts P2 branch gaps now addressed — expect coverage improvement next cycle. UserMenu.tsx P2 (handleInsightsFile craftScore branch) covered. Remaining P2 carried: warm-cache getAvatarBase64 catch, UserMenu 80% funcs (now should be resolved).
- [Cost Analyst]: P3-1 (pingRedis timer leak) resolved. P3-2 (CLI device session TTL) confirmed resolved. Remaining: P2-1 campaigns RPC (future scale), monitors M1–M4.
- [Security]: No new security-relevant changes. All timer patterns now use withTimeout() — fetch timeout coverage remains 100%.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-04-17T14:00:00Z -->
## Triage — 2026-04-17
- **Reports processed**: 4 (cc-rpi-update, cost-analyst, coverage, documentation)
- **Action items resolved**: 10 of 10 — all implemented
- **Summary**: Merged codex/triage-audit-fixes (vitest 4.1.4, jsdom 29.0.2, vite ≥8.0.8 dep bumps + campaign test refactors); replaced 3 inline `Promise.race` timer patterns with `withTimeout()` utility (og-image, supabase, sync-audience — eliminates timer leaks); added Redis caching for `listAllContacts()` (1h TTL) + 3 cache tests; added partial index migration for `dbGetUsersWithEmail()`; fixed BadgeToolbar test regression from vitest 4.1.4 (`vi.spyOn→vi.stubGlobal`); filled 14 missing light-value cells in design-system.md. P3-7 (Bitbucket/Codeberg timeout) and P3-8 (cacheDel throw) were false positives — already handled in source. Tests: 7004 passing (+3 vs 7001), 0 type errors, 0 lint issues.
- **Coverage delta**: +3 tests (Redis cache hit, cache miss, cache error paths in sync-audience).

**Cross-agent recommendations:**
- [Cost Analyst]: P3-1, P3-2, P3-3, P3-6 all resolved. P3-4 and P3-5 resolved via Codex dep bumps. P3-7 and P3-8 confirmed false positives. Remaining carried: P2-1 (campaigns RPC), monitors M1–M4.
- [Coverage]: 3 new tests added for sync-audience Redis cache paths. BadgeToolbar flaky test confirmed stable (7th consecutive cycle). lib/cache and app/api coverage unchanged at 99.2% and 97.6%.
- [Documentation]: design-system.md light value gaps (14 cells) now filled — doc agent's 3 minor gaps are resolved.
- [Security]: Fetch timeout coverage confirmed 100% — P3-7 was a false positive (AbortSignal.timeout already present in bitbucket.ts + codeberg.ts).
<!-- ENTRY:END -->

<!-- ENTRY:START agent=qa_agent timestamp=2026-04-01T07:05:42Z -->
## QA Agent — 2026-04-01
- **Status**: GREEN
- Tests: 6,879/6,879 passed across 386 files, 0 failed, 0 skipped (+16 tests, +1 file vs 2026-03-30)
- Type errors: 0
- Lint issues: 0
- A11y issues: 0 — all buttons labeled, focus-visible present, no bare `<img>` tags, no heading skips in production pages

**Cross-agent recommendations:**
- [Coverage]: `debug-quality/route.ts` confirmed deleted — 0% coverage gap resolved. `AdminDashboardClient.tsx` funcs at 68.4% remains the top actionable gap.
- [Security]: No new security-related quality issues. All XSS vectors covered, all interactive elements properly accessible.
- [Cost Analyst]: Refresh rate limit (15/hr) remains the only open P1 — should be reverted before next production release.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage_agent timestamp=2026-04-20T00:15:54Z -->
## Coverage Agent — 2026-04-20
- **Status**: YELLOW
- Overall coverage: **93.07% stmts** (7800/8380), 89.56% branches, 89.83% funcs, 94.14% lines
- Test suite: 396 files, 7048 tests (+147 vs 2026-04-19 — remediation work added tests)
- All critical paths GREEN: lib/impact 100%, lib/render 100%, lib/db 97.6%, lib/cache 99.2%, lib/auth 97.7%, lib/github 97%, lib/history 98.2%, lib/email 97.9%, app/api 97.5%, lib/profile 100%
- **Flaky tests: NONE** — 3/3 runs passed 7048/7048.
- **P2 resolved from 2026-04-19**: warm-cache/route.ts funcs 100% (was 62.5%), public-profile.ts branches 88.88% (was 68.75%), UserMenu.tsx funcs 81.25% (above threshold)
- **P2 NEW**: `components/SharePageOwnerContent.tsx` — 59.09% stmts, 77.27% branches, 50% funcs. Owner-only interactive section (embed copy, refresh CTA) completely untested.
- **P2 carried**: `lib/analytics/server-errors.ts` — 63.63% branches. SENSITIVE_PATTERNS token-scrubbing branches uncovered — security-relevant.
- **P3 carried (all accepted)**: experiments 56.7% (Canvas/WebGL), HolographicOverlay 50% (Canvas), AuthorTypewriter 67.5% branches (JSDOM), demoData 50% branches (data tables), refresh/recalculate fire-and-forget arrows 33–50% funcs, lazy wrappers 25–50% funcs

**Cross-agent recommendations:**
- [Security]: `lib/analytics/server-errors.ts` branches at 63.63% — the uncovered paths include SENSITIVE_PATTERNS regex scrubbing branches. These are the token-redaction guards before error logs. Consider security agent adding specific tests for all 9 pattern types to confirm scrubbing fires correctly.
- [QA]: Suite grew +147 tests (remediation cycle added tests). All 3 runs clean, no flaky tests. SharePageOwnerContent P2 is the only new actionable item — owner UI interactive handlers have zero test coverage.
- [Cost Analyst]: app/api 97.5%, lib/db 97.6% — stable. No changes to caching path coverage.
<!-- ENTRY:END -->
