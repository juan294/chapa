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

<!-- ENTRY:START agent=cost-analyst timestamp=2026-04-07T03:00:00Z -->
## Cost Analyst — 2026-04-07
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$60–70/mo**. Unchanged.
- Redis: **24 key pattern families** (confirmed; `craft:{handle}`, `ratelimit:recalculate`, `ratelimit:cli-approve` counted). TTL 100% on per-user keys. 2 no-TTL singletons (HyperLogLog + badge counter) + 1 intentional TTL=0 cron cursor. All memory-bounded.
- Redis storage estimate: **~1.52 GB @10K users**. OG images #1 consumer (~1.3 GB / 81%). Upstash Pro 10 GB — **85% headroom**.
- GitHub API: all cache-first (6h + 7d stale fallback), in-flight dedup, ~50–150 calls/hr baseline vs 5,000/hr limit.
- Supabase: **10 tables + 2 views**. Singleton lazy client. 0 N+1 patterns. `dbRecomputeCraft()` adds +2 DB ops + 1 Redis write per refresh/recalculate — bounded, negligible cost.
- Fetch timeouts: GitHub/Codeberg auth flows (4 calls) lack AbortSignal — LOW risk (rare auth events, Vercel 300s backstop).
- Resource leaks: 0.
- **P1s: NONE**.
- **P2-1**: `dbGetCampaignStats()` client-side aggregation — CARRIED. Move to RPC at >5K sends/campaign.
- **P2-2**: `dbRecomputeCraft()` 0 test cases — CARRIED (3rd cycle). Silent failure in craft paths unverified.
- **P2-3 NEW**: Warm-cache cron timeout risk — 50 handles × ~10s = 500s vs Vercel Pro 300s limit. Add `WARM_CACHE_MAX_HANDLES` ceiling of 25 or split into two windows.
- **MONITOR: OG image Redis memory** — CARRIED. CDN bounds cost.
- **MONITOR: `sync-audience` pagination** — CARRIED. Future scale only.
- **MONITOR: HyperLogLog** — CARRIED. ~12KB, track quarterly.

**Cross-agent recommendations:**
- [Security]: GitHub/Codeberg OAuth calls (4) lack AbortSignal — P3 hygiene. Fail-open rate limiting intact. 5/hr refresh limit confirmed.
- [QA]: P2-2 (`dbRecomputeCraft()` untested, 3rd cycle) is top actionable item. P2-3 warm-cache timeout should be verified by checking current handle count.
- [Performance]: Bundle at 1,663 KB stable. OG image Redis monitor carried. Warm-cache cron timeout (P2-3) is also a performance concern.
- [Coverage]: `app/api` at 97.5%, `lib/db` at 95.2%. `tool-insights.ts` is the only sub-80% file. P2-2 drives both coverage and cost risk.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=performance timestamp=2026-03-26T09:15:00Z -->
## Performance Engineer — 2026-03-26
- **Status**: GREEN
- Build: Next.js 16.2.1 (Turbopack), compiles in 3.0s, 0 TypeScript errors. 63 static pages (11 workers, 393ms). 82 routes (5 static, 77 dynamic).
- Total client JS: **1,800 KB (1.76 MB)** across 71 chunks. No chunk exceeds 500 KB. +366 KB vs 2026-03-12 (+25%) — proportional to new features (campaigns, engagement, CLI auth, experiments).
- Largest chunks: 228 KB (Next.js framework), 176 KB (PostHog, lazy-loaded), 136 KB (React DOM), 112 KB (polyfills). 4 chunks >100 KB, all framework/vendor.
- Knip: **0 findings** — fully clean (was 60 unused exports + 42 unused types on 2026-03-12). All resolved.
- `"use client"` audit: 120 files total (incl. tests). Previous 3 flagged files: `overall-health-banner.tsx` RESOLVED (directive removed), `ShareBadgePreviewLazy.tsx` and `GlobalCommandBarLazy.tsx` confirmed legitimate (wrapping `next/dynamic` with `ssr: false`). No new removable directives.
- Dynamic imports: 12 components code-split via `next/dynamic` with `ssr: false` (up from 9). New: `AgentsDashboard`, `EngagementDashboard`, `CampaignsDashboard`. All with proper loading UI.
- Font loading: optimal (`next/font/google`, `display: "swap"`, Latin subset, no external requests).
- CLS risks: none — all `<Image>` have explicit dimensions, no bare `<img>` tags, skeleton loaders for async content.
- Badge SVG caching: `s-maxage=21600, stale-while-revalidate=604800` (success), `s-maxage=300, stale-while-revalidate=600` (error). Frame embed headers correct.
- Share page ISR: `revalidate=3600` in place with test assertion.

**Cross-agent recommendations:**
- [Coverage]: `hexmap/page.tsx` (0%, 636 lines) and `ParticleBackground.tsx` still canvas-heavy — smoke tests remain recommended but accepted limitation. All rendering/API paths at 91%+.
- [Security]: No performance-related security concerns. PostHog CSP correctly scoped. Knip fully clean. Rate limiting fail-open by design.
- [QA]: All previous performance-QA items RESOLVED. `overall-health-banner.tsx` no longer client component. 12 error boundaries now in place. No functional issues.
- [Cost Analyst]: OG image Redis memory remains #1 consumer (62% at 10K users). Bundle grew +25% but all from feature additions — no waste. Supabase SDK chunk duplication (160KB x2) from cost-analyst is minor optimization target.
- [Documentation]: Previous knip/unused-exports documentation item RESOLVED (0 findings now). No remaining performance-documentation concerns.
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

<!-- ENTRY:START agent=documentation timestamp=2026-04-03T10:00:00Z -->
## Documentation Agent — 2026-04-03
- **Status**: GREEN
- Route coverage: **44/44 API routes documented** in CLAUDE.md (100%). All 5 previously noted method mismatches RESOLVED (triage 2026-03-28). `POST /api/telemetry` added. 34 pages documented (pattern `/experiments/*` covers 13 experiment sub-pages).
- Design system: **38/38 color tokens** (100%) and **18/18 animations** (100%). `animate-shimmer-sweep` and `animate-hex-cell-in` 0.45s duration added. `--color-complement` dark override confirmed `#10B981` in both themes. All hex values accurate.
- Env vars: **31/31 production vars documented** (100%). `TESTPLATFORM_CLIENT_ID/SECRET` confirmed test-only scaffolding (`platform-oauth.test.ts`) — not production vars. `CI`/`NODE_ENV` are universal standards.
- JSDoc coverage: **~100% on public exports**. All previously flagged gaps (`isValidTelemetryPayload`, `isValidBadgeConfig`, `generateInsights`, `lib/db/campaigns.ts`) RESOLVED. Non-exported internal helpers lack JSDoc (acceptable per convention).
- All required docs exist: `impact-v4.md`, `impact-v6.md`, `svg-design.md`, `README.md` (215 lines), `shared-context.md`. 0 TODO/FIXME comments referencing doc gaps.
- Shared-context has 10 entries, latest 2026-04-03.

**Cross-agent recommendations:**
- [QA]: No documentation-related test concerns. All method mismatches resolved — test expectations should be aligned.
- [Security]: No security-related doc gaps. SVIX_*/ICEBERG_TOKEN confirmed false positives (not in source). TESTPLATFORM_* are test-only.
- [Coverage]: No doc-coverage overlap gaps remaining. All previously flagged functions now have JSDoc.
- [Cost Analyst]: No doc gaps affecting cost model. All routes and env vars fully documented.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=security timestamp=2026-04-06T10:00:00Z -->
## Security Scanner — 2026-04-06
- **Status**: GREEN
- Vulnerabilities: 0 critical, 0 high, 0 medium, 0 low — `pnpm audit` clean.
- Secret leaks: none — all server secrets isolated, `NEXT_PUBLIC_*` vars non-sensitive. Error logging scrubs tokens via `SENSITIVE_PATTERNS` regex (9 patterns) in `lib/analytics/server-errors.ts`.
- License issues: 1 MPL-2.0 (`@resvg/resvg-js@2.6.2`) — file-level weak copyleft, no source modifications, no compliance action needed. No GPL/AGPL found.
- Knip `--production`: **8 false positives** — all flagged packages confirmed in use (grep verified). `vitest.setup.ts` is in `vitest.config.ts:12 setupFiles`. False positives due to `--production` excluding non-entry files.
- XSS: **9 user-input entry points** in SVG pipeline escaped via `escapeXml()`. Explicit XSS tests at `BadgeSvg.test.tsx:59-65`. 18 `dangerouslySetInnerHTML` uses — all safe (hardcoded demo SVG).
- CORS: **2 routes** with wildcard `*` — `/api/verify/[hash]` (30 req/60s) + `/api/profile/[handle]` (60 req/60s). Both read-only, public data, rate-limited. Intentional design.
- RLS: **all 10 Supabase tables** RLS-enabled + FORCE ROW LEVEL SECURITY + explicit deny policies. 2 views with `security_invoker = true`.
- OAuth: CSRF state via `timingSafeEqual()`, AES-256-GCM token encryption (fresh IV per call), 10s timeouts. CLI tokens HMAC-SHA256 signed with 90-day expiry.
- Fetch timeout coverage: **100%** — all external calls have `AbortSignal.timeout()`.
- Rate limiting: **31/44 routes** (70%). Remaining 13 use admin/bearer token auth or are internal. All fail-open.
- Session cookies: `HttpOnly`, `SameSite=Lax`, `Secure`, 10-minute `Max-Age`.
- **INFO**: `dbRecomputeCraft()` (`lib/db/tool-insights.ts:149-180`) has 0 test cases — error path behavior in refresh/recalculate routes is unverified. Not a vuln, but a security-adjacent P2.

**Cross-agent recommendations:**
- [Coverage]: Add `describe("dbRecomputeCraft")` tests — the error path from refresh/recalculate is unverified. This is a P2 security-adjacent gap.
- [QA]: No new security UX issues. All XSS vectors covered, all interactive elements accessible. Knip `--production` false positives should not trigger package removals.
- [Cost Analyst]: Fail-open rate limiting intact. Fetch timeouts at 100%. No new cost-security conflicts.
- [Performance]: Knip `--production` false positives — do not remove flagged packages; they are all actively used.
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

<!-- ENTRY:START agent=coverage timestamp=2026-04-07T03:00:00Z -->
## Coverage Agent — 2026-04-07
- **Status**: GREEN
- Overall coverage: **92.99% stmts** (7,568/8,138), 89.68% branch, 89.94% funcs, 94.17% lines
- Test suite: 389 files, 6,955 tests, 100% pass rate on 4/5 runs; 1 infrastructure flake (coverage/.tmp race)
- Delta vs 2026-04-06: **0pp all metrics** — no new code, no new tests this cycle. Coverage plateau-stable.
- All critical paths GREEN: lib/impact 100%, lib/render 100%, packages/shared 100%, lib/cache 99.2%, lib/history 98.2%, lib/auth 98%, lib/email 97.9%, app/api 97.5%, lib/db 95.2%, lib/github 97.5%, components 95.9%
- **P1 CARRIED**: `lib/db/tool-insights.ts::dbRecomputeCraft` (lines 149–180) — 0 test cases, 72.7% stmts, 3rd cycle without fix
- **P1 CARRIED**: `app/api/recalculate/route.ts` — 50% funcs (fire-and-forget .catch arrow uncovered)
- **P1 CARRIED**: `app/api/refresh/route.ts` — 75% funcs (craft dbRecomputeCraft path not mocked)
- **Flaky RESOLVED**: BadgeToolbar download strip — 0/4 failures this cycle (was 2/4). Monitoring one more cycle.
- **Infra flake NEW**: coverage/.tmp race condition causes occasional full-suite failure — workaround: `mkdir -p coverage/.tmp` before run.

**Cross-agent recommendations:**
- [Security]: dbRecomputeCraft error paths remain untested — silent failure risk in craft refresh/recalculate. P2 security-adjacent, unchanged from last cycle.
- [QA]: 3 P1s all stem from v2.7.x craft-recompute shipping without tests. Top priority: tool-insights.test.ts dbRecomputeCraft describe block.
- [Cost Analyst]: app/api at 97.5%, lib/db at 95.2%. Only tool-insights.ts below 80%. No new cost-critical coverage gaps.
- [Performance]: No performance-coverage gaps. Flaky BadgeToolbar monitor: if returns, apply waitFor() fix.
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

<!-- ENTRY:START agent=triage timestamp=2026-03-28T06:00:00Z -->
## Triage — 2026-03-28
- **Reports processed**: 3 overnight (coverage, cost-analyst, cc-rpi-update) + 7 from Mar 27
- **Action items resolved**: 11 groups — all implemented
- **Summary**: Fixed 4 CLAUDE.md route method mismatches, corrected design-system.md animation duration, added JSDoc to 11 functions, fixed sync-audience Promise.all→Promise.allSettled (TDD), added 138 tests across 18 test files closing P1-P4 coverage gaps. Env var investigation: ICEBERG_TOKEN/SVIX_*/BOOK_LANG are false positives (not in source code).
- **Tests**: 6,552 passing (378 files), 0 type errors, 0 lint issues
- **Coverage delta**: +138 tests vs 6,414. P1: refresh route funcs 66.7%→100%. P2: auth/callback, warm-cache, snapshot-cache, redis, supabase all 80-85%→92-100%. P3: demoData, archetypeDemoData, github auth, snapshots, admin-users, heatmap-evenness, recency, verification, tool-insights branches→80%+. P4: BadgePreviewCard funcs→80%+, UserMenu funcs→78%+, AuthorTypewriter→100%.
- **Code fixes**: sync-audience Promise.allSettled (defensive resilience improvement).
**Cross-agent recommendations:**
- [Coverage]: All P1-P4 items addressed. Remaining accepted limitations: experiments (WebGL/Canvas), HolographicOverlay (JSDOM), server pages (Next.js).
- [QA]: Test count at 6,552. All critical paths above 92%. No functional issues.
- [Documentation]: 4 CLAUDE.md route mismatches fixed. animate-hex-cell-in duration corrected. JSDoc coverage improved to ~90%+.
- [Cost Analyst]: sync-audience now uses Promise.allSettled. Monitor items carried (OG image Redis memory, sync-audience pagination).
- [Security]: No new concerns. All defensive patterns intact.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-03-30T06:30:00Z -->
## Triage — 2026-03-30
- **Reports processed**: 7 (coverage, cost-analyst, cc-rpi-update, security, pre-launch, remediation, update-docs)
- **Action items resolved**: 17 of 17 — all coverage gaps + code improvements addressed
- **Summary**: All reports GREEN (pre-launch CONDITIONAL fully remediated). Added 203 tests across 21 files closing P1+P2 coverage gaps. Wrapped 5 Resend SDK calls with `withTimeout()`. Updated about pages ISR 1h→24h. Fixed BadgePreviewCard funcs 53%→100%.
- **Tests**: 6,858 passing (385 files), 0 type errors, 0 lint warnings
- **Coverage delta**: +203 tests vs 6,655. P1: BadgePreviewCard funcs 53%→100%, SharePageShortcuts (new test file), AdminDashboardClient (new test file), ParticleBackground (new test file), InfoTooltip/ConfirmDialog/AuthorTypewriter branches improved, UserMenu/engagement-dashboard interactions tested. P2: trend/announcement/bulk-recalculate/use-trend-data edge cases covered.
- **Code fixes**: 5 Resend `withTimeout()` wrappers (defense-in-depth), 3 about pages ISR 3600→86400.
**Cross-agent recommendations:**
- [Coverage]: All P1/P2 items addressed. 3 new test files created. Remaining accepted: experiments (WebGL/Canvas), HolographicOverlay (JSDOM), server pages (Next.js).
- [QA]: Test count at 6,858 (+203). All critical paths above 92%. No functional issues.
- [Cost Analyst]: Resend SDK timeout gaps now RESOLVED (5/5 calls wrapped). About pages ISR reduced from ~20 to ~1 build/day. Monitor items carried (OG image Redis memory, sync-audience pagination).
- [Security]: All Resend SDK calls now have timeout protection. Fetch timeout coverage at 100% including SDK calls.
- [Performance]: No performance concerns. ISR optimization applied.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=cost-analyst timestamp=2026-04-06T03:00:00Z -->
## Cost Analyst — 2026-04-06
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$65–70/mo**. Unchanged.
- Redis: **21 key pattern families** (unchanged). NEW: `craft:{handle}` (1h TTL) added by v2.7.x — ~20 MB max at 10K users, negligible. TTL 100% on per-user keys. 2 no-TTL singletons (HyperLogLog + badge counter), both memory-bounded.
- Redis storage estimate: **~1.52 GB @10K users**. OG images #1 consumer (~1.3 GB / 81%). Upstash Pro 10 GB — **85% headroom**.
- GitHub API: all cache-first (6h + 7d stale fallback), in-flight dedup, ~50–150 calls/hr baseline vs 5,000/hr limit.
- Supabase: **10 tables + 2 views**. Singleton lazy client. 0 N+1 patterns. `dbRecomputeCraft()` (v2.7.x) adds single UPDATE + Redis write — bounded, no cost risk, but **currently untested**.
- Fetch timeouts: 100% via `AbortSignal.timeout()` or AbortController (Bitbucket). 1 intentional fire-and-forget (PostHog error capture). Bitbucket setTimeout not `clearTimeout()`d on success — hygiene issue only, LOW.
- **P1s: NONE**.
- **P2-1**: `dbGetCampaignStats()` client-side aggregation — CARRIED. Move to RPC at >5K sends/campaign.
- **P2-2**: `dbRecomputeCraft()` 0 test cases — Coverage P1. Silent failure risk in craft refresh paths.
- **MONITOR: OG image Redis memory** — CARRIED (~1.3 GB @10K). CDN `s-maxage=21600` bounds generation.
- **MONITOR: `sync-audience` pagination** — CARRIED. Future scale only.
- **MONITOR: HyperLogLog** — CARRIED. ~12KB, sublinear growth.

**Cross-agent recommendations:**
- [Security]: No new concerns. Fail-open rate limiting intact. 5/hr refresh limit confirmed.
- [QA]: P2-2 (`dbRecomputeCraft()` untested) is the top actionable item. Craft DB error behavior unverified.
- [Performance]: Bundle at 1,663 KB. OG image Redis monitor carried. No new cost-performance conflicts.
- [Coverage]: `app/api` at 97.5%, `lib/db` at 95.8%. `tool-insights.ts` is the only sub-80% file and drives the P2-2 risk.
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
