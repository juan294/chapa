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

<!-- ENTRY:START agent=cost-analyst timestamp=2026-03-31T03:10:00Z -->
## Cost Analyst — 2026-03-31
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$40-60** (Vercel $20, Redis $10-20, Resend $0-20, Supabase free). At 50K users: ~$95-195/mo. Stable — no code changes since 2026-03-30.
- Redis: **26 key pattern families**. TTL coverage 100% per-user keys. 3 global singletons without TTL (badges_generated counter, unique_badges HyperLogLog, warm-cache offset) — intentional, combined <16 KB.
- **Estimated Redis memory @10K users: ~253 MB** (78 MB user data + 15 MB avatars + 150 MB OG images + 10 MB overhead). Well within Upstash Pro 10 GB (97.5% headroom).
- GitHub API budget: **~57 calls/hr @10K** (1.1% of 5K/hr limit). Safe until 500K+ users.
- Supabase: **9 tables + 2 views**. Singleton lazy client. 0 N+1 patterns. 11 indexes. RLS FORCE on all 9 tables. `dbGetCampaignStats()` JS aggregation ACCEPTED.
- Fetch timeout coverage: **100% raw fetch**, **57% Resend SDK** (4/7 with `withTimeout()`). 3 missing SDK timeouts are in fire-and-forget or admin-gated contexts — practical risk LOW.
- Resource leaks: **0 critical, 0 minor**. Inflight dedup map has `.finally()` cleanup + 15s fetch timeout guarantee. All timers cleaned. All `after()` callbacks use `Promise.allSettled`.
- Rate limiting: **31/44 routes** (70%). Remaining 13 use admin auth, bearer token, or are internal. All fail-open. Campaign email: 95/day quota enforced via Redis counter.
- Build: No routes exceed 500KB. 1,800 KB total client JS across 69 chunks. 84 dynamic + 7 static routes.
- Cron: 3 jobs, ~90 executions/mo, <0.01% of free tier compute.
- ISR/SSG: Optimal — archetype pages SSG (7d), share pages ISR (1h), legal pages ISR (24h), studio force-dynamic.
- Tests: 6,655 passing (382 files), 92.72% stmts coverage. 0 flaky.
- **MONITOR: OG image Redis memory** — CARRIED. 59% of Redis at 10K. Consider blob storage at 50K+.
- **MONITOR: `sync-audience` pagination** — CARRIED. Future scale only.
- **CARRIED: Resend SDK timeout gaps** — 3 audience.ts calls + 1 admin test route lack `withTimeout()`. LOW risk — defense-in-depth improvement only.
- No new findings — confirmation report.

**Cross-agent recommendations:**
- [QA]: No new cost-QA concerns. All cost-critical paths well-tested. Coverage at 92.72% stmts (6,655 tests).
- [Security]: Raw fetch timeouts at 100%. Fail-open rate limiting intact. RLS FORCE on all tables. Resend SDK timeout gaps are LOW risk (fire-and-forget/admin-gated).
- [Performance]: Redis memory stable at ~253 MB @10K. OG images #1 consumer (59%). Bundle stable at 1,800 KB / 69 chunks. No build regressions.
- [Coverage]: All cost-critical paths well-covered. API routes at 97.3%. No cost-coverage concerns.
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

<!-- ENTRY:START agent=documentation timestamp=2026-03-27T10:00:00Z -->
## Documentation Agent — 2026-03-27
- **Status**: YELLOW
- Route coverage: **41/42 API routes documented** in CLAUDE.md (98%). 1 undocumented: `POST /api/telemetry`. Previous phantom routes (`bitbucket/login`, `codeberg/login`) RESOLVED. Campaign API routes now fully documented.
- **Method mismatches**: 5 — `/api/cli/auth/poll` (docs: GET|POST, actual: GET), `/api/admin/feature-flags` (docs: GET|PATCH, actual: PATCH), `/api/admin/engagement-flags` (docs: GET|PUT, actual: GET), `/api/admin/agents/run` (docs: POST, actual: POST|GET|DELETE), `/api/notifications/unsubscribe` (docs: POST, actual: GET).
- Design system: 50/51 tokens documented (98%). `--color-complement` base token still lacks explicit dark override. 17/18 animations documented — `animate-hex-cell-in` has undocumented 0.45s duration; `animate-shimmer-sweep` missing from animation table. All hex values accurate.
- Env vars: **30/30 fully consistent**. 8 undocumented env vars found in code (ICEBERG_TOKEN, SVIX_SERVER_URL, SVIX_TOKEN, BOOK_LANG, HOST, MY_SERVER_PORT, TESTPLATFORM_CLIENT_ID/SECRET). Most are dev/test-only; SVIX_* and ICEBERG_TOKEN need investigation.
- JSDoc coverage: **84% (284/338 exports)**. Up from ~78%. Previously flagged `isValidInsightsUpload`, `isValidStatsShape`, `fetchContributionData` all RESOLVED. Remaining P1 gaps: `isValidTelemetryPayload` (43 lines), `isValidBadgeConfig` (17 lines), `generateInsights` (>30 lines).
- All 6 required docs exist and are non-empty. README has 215 lines with full setup. `/archetypes/artificer` page now exists.
- Shared-context has 7 entries, latest 2026-03-27.

**Cross-agent recommendations:**
- [QA]: 5 method mismatches in CLAUDE.md may cause stale integration test expectations. `/api/notifications/unsubscribe` is GET in code but POST in docs — verify tests use correct method.
- [Security]: No security-related doc gaps. Undocumented SVIX_* and ICEBERG_TOKEN env vars should be verified for production exposure.
- [Coverage]: 11 complex undocumented functions overlap with lower-coverage files. Priority JSDoc: `lib/validation.ts` (2 functions), `lib/dashboard/generate-insights.ts`, `lib/db/campaigns.ts` (4 functions).
- [Performance]: Design system token documentation at 98%. No performance-documentation concerns.
- [Cost Analyst]: Campaign API routes now fully documented. Undocumented SVIX_* env vars may indicate webhook infrastructure costs not captured in cost model.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=security timestamp=2026-03-30T10:00:00Z -->
## Security Scanner — 2026-03-30
- **Status**: GREEN
- Vulnerabilities: 0 critical, 0 high, 0 medium, 0 low — `pnpm audit` clean.
- Secret leaks: none — all 10+ server secrets isolated, `NEXT_PUBLIC_*` vars non-sensitive. Error logging scrubs tokens via regex before PostHog.
- License issues: 1 LGPL-3.0 (`@img/sharp-libvips-darwin-arm64`) — dynamically linked, no compliance action needed.
- Knip: **0 findings** — fully clean.
- XSS: 9 user-input entry points in SVG pipeline escaped via `escapeXml()` (handle, displayName, archetype, tier, avatarDataUri, fallback handle, fallback error, verification hash, verification date). Explicit XSS tests at `BadgeSvg.test.tsx:59-65`. 18 `dangerouslySetInnerHTML` uses — all safe (hardcoded demo SVG).
- CORS: **2 routes** with wildcard `*` — `/api/verify/[hash]` (30 req/60s) + `/api/profile/[handle]` (60 req/60s, **NEW**). Both read-only, public data, rate-limited. CSP properly configured in `next.config.ts`. Global headers: HSTS (2yr+preload), nosniff, X-XSS-Protection, restrictive Permissions-Policy.
- RLS: **all 9 Supabase tables** RLS-enabled + FORCE ROW LEVEL SECURITY + explicit deny policies. 2 views with `security_invoker = true`.
- Hardcoded secrets: none found in source. All env vars `.trim()`ed.
- OAuth: CSRF state validation via `timingSafeEqual()`, AES-256-GCM token encryption (fresh IV per encryption), 10s fetch timeouts. CLI tokens HMAC-SHA256 signed with 90-day expiry.
- Fetch timeout coverage: **100%** — all external calls have `AbortSignal.timeout()`.
- Rate limiting: **31/44 routes** (70%, up from 14+). Remaining 13 use admin auth, bearer token, or internal. All fail-open. Campaign email: 95/day quota, batch 50, Redis counter.
- Session cookies: `HttpOnly`, `SameSite=Lax`, `Secure` (HTTPS), 10-minute `Max-Age`.
- Avatar URL: whitelist validation (only `avatars.githubusercontent.com`) + content-type checks.

**Cross-agent recommendations:**
- [Coverage]: All security-critical paths at 96%+. XSS tests comprehensive. HMAC verification at 100%. No new security-coverage gaps.
- [QA]: No security UX issues. New `/api/profile/[handle]` CORS endpoint is rate-limited and read-only. Promise patterns correct.
- [Cost Analyst]: Fail-open rate limiting intact. Fetch timeouts at 100%. Campaign email quota prevents abuse. Resend SDK timeout gaps LOW risk (fire-and-forget/admin-gated).
- [Performance]: No security-related performance concerns. Knip fully clean (0 findings). Rate limiting fail-open by design. CSP properly scoped.
- [Documentation]: No security-documentation gaps. Undocumented SVIX_*/ICEBERG_TOKEN confirmed as false positives by triage (2026-03-28).
<!-- ENTRY:END -->

<!-- ENTRY:START agent=qa timestamp=2026-03-25T08:00:00Z -->
## QA Agent — 2026-03-25
- **Status**: GREEN
- Tests: 6,032/6,032 passed across 369 files, 0 failed, 0 skipped (+537 tests, +51 files vs last QA 2026-03-18)
- Type errors: 0. No false positives — duplicate ` 2.ts` files no longer present.
- Lint issues: 0 errors, 0 warnings. Previous `announcement.test.ts` warning resolved.
- A11y issues: 0 — WCAG 2.1 AA compliant. All SVG icons `aria-hidden`. 15+ components with proper ARIA. Global `focus-visible` + component-specific rings. `prefers-reduced-motion` blanket + JS checks. Focus traps in modals. Skip-to-content link. Portal-based tooltips.
- Design system: **0 violations** in production components. All use semantic tokens. Documented exceptions (Badge SVG, OG image, email, `global-error.tsx`) correctly hardcoded.
- Error handling: **12 error boundaries** (up from 8): root, global-error, about, admin, archetypes, coming-soon, experiments, privacy, studio, terms, u/[handle], verify. 13 loading states. SVG fallback with XSS escaping.
- Error gaps: `/cli/*` lacks error boundary (minor — low-traffic auth flow). 17 API routes without top-level try/catch use `dbTimeoutOr504()` helper (intentional pattern).
- Promise patterns: Correct — `Promise.all()` for critical paths, `Promise.allSettled()` for optional operations (badge.svg, insights, warm-cache). All wrapped in error handling.
- **RESOLVED since last QA**: Badge SVG `Promise.all()` → `Promise.allSettled()` ✓. Duplicate ` 2.ts` files cleaned ✓. +4 new error boundaries (archetypes, coming-soon, privacy, terms) ✓. Lint warning resolved ✓.
- **STILL OPEN**: `/api/studio/config` docs mismatch (CLAUDE.md says POST, code is GET+PUT). Carried since 2026-03-18.

**Cross-agent recommendations:**
- [Coverage]: All prior priority items resolved. Test count at 6,032. Remaining low-coverage: `HolographicOverlay.tsx` (47.1%, JSDOM limitation), experiments pages (71.4%, canvas-heavy).
- [Security]: No security-related quality issues. All XSS vectors covered. Campaign pipeline uses proper auth + quotas. Promise patterns correct.
- [Cost Analyst]: Badge SVG `Promise.allSettled()` RESOLVED. `/api/studio/config` docs mismatch still pending.
- [Performance]: 0 design system violations. Error boundaries now cover 12 route segments. Missing only `/cli/*` (minor).
- [Documentation]: `/api/studio/config` method mismatch needs docs update (POST → GET+PUT). All other prior doc issues resolved.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage timestamp=2026-03-31T02:00:00Z -->
## Coverage Agent — 2026-03-31
- **Status**: GREEN
- Overall coverage: **92.72% stmts** (7,491/8,079), 89.05% branch, 88.57% funcs, 93.99% lines
- Test suite: 382 files, 6,655 tests, 100% pass rate, 0 flaky (3 runs, ~25-38s)
- Delta vs 2026-03-30: **+0.00%** across all metrics. No code changes since last report — coverage stable.
- All thresholds pass with 17%+ margin (75% stmts threshold).
- Critical paths all GREEN: `lib/impact` 100%, `lib/render` 100%, `lib/verification` 100%, `lib/insights` 100%, `packages/shared` 100%, `lib/cache` 99.2%, `lib/history` 98.2%, `lib/auth` 98.1%, `lib/db` 97.7%, `lib/codeberg` 97.5%, `app/api` 97.3%, `lib/bitbucket` 97.2%, `lib/github` 96.8%, `lib/email` 96.7%, `components` 95.4%, `lib/effects` 94.6%.
- `app/admin` at 93.7% (GREEN). `app/studio` at 87.6% (YELLOW — `BadgePreviewCard.tsx` 53% funcs).
- `app/experiments` at 56.1% (RED) — feature-flagged, canvas/WebGL-heavy, V8/JSDOM limitations. Accepted.
- `HolographicOverlay.tsx` at 47.0% — JSDOM limitation. Accepted.
- P1 gaps (funcs <80%): `BadgePreviewCard.tsx` (53%), `SharePageShortcuts.tsx` (67%), `AdminDashboardClient.tsx` (68%), `bulk-recalculate/route.ts` (71%), `use-trend-data.ts` (75%), `InfoTooltip.tsx` (76%), `ParticleBackground.tsx` (78%), `UserMenu.tsx` (79%).
- 11 untested files — all type defs, configs, or re-exports except `SharePageShortcuts.tsx` (60 lines, has testable keyboard logic).
- 0 flaky tests across 3 consecutive runs.

**Cross-agent recommendations:**
- [Security]: All security-critical paths at 96%+. XSS tests comprehensive. HMAC verification at 100%. No new security-coverage gaps.
- [QA]: P1: `BadgePreviewCard.tsx` at 53% funcs (interaction callbacks), `AdminDashboardClient.tsx` at 68% funcs (event handlers). `SharePageShortcuts.tsx` needs a test file.
- [Performance]: All critical rendering and API paths at 94%+. Experiments remain accepted limitation. `hexmap/page.tsx` (0%, 636 lines) canvas-heavy — no action.
- [Cost Analyst]: All module coverages stable or improving. API routes aggregate at 97.3%. No cost-coverage concerns.
- [DevOps]: All thresholds pass with 17%+ margin. Test suite runs in ~25-38s with coverage. Zero flaky tests.
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
