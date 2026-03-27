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

<!-- ENTRY:START agent=cost-analyst timestamp=2026-03-27T09:00:00Z -->
## Cost Analyst — 2026-03-27
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$40-60** (Vercel $20, Redis $10-20, Resend $0-20, Supabase free). At 50K users: ~$70-175/mo. Stable — no new cost risks.
- Redis: **24 key pattern families**. TTL coverage 100% per-user keys. 3 global singletons without TTL (badges_generated counter, unique_badges HyperLogLog, warm-cache offset) — intentional, combined <16 KB.
- **Estimated Redis memory @10K users: ~243 MB** (78 MB user data + 15 MB avatars + 150 MB OG images). Well within Upstash Pro 10 GB (97.6% headroom).
- GitHub API budget: **~57 calls/hr @10K** (1.1% of 5K/hr limit). 6h cache + 7d stale fallback + in-flight dedup. Safe until 500K+ users.
- Supabase: **9 tables + 2 views**. Singleton lazy client. 0 N+1 patterns. 11 indexes. RLS on all 9 tables with FORCE. `dbGetCampaignStats()` JS aggregation ACCEPTED (PostgREST limitation).
- Fetch timeout coverage: **100%**. Resend gap **RESOLVED** — `withTimeout(EMAIL_SEND_TIMEOUT_MS=10s)` applied to all 4 email modules (resend.ts, notifications.ts, score-bump.ts, campaigns.ts) per triage 2026-03-26.
- Resource leaks: **0 critical, 0 warnings**. All timers cleaned. All `after()` callbacks use `Promise.allSettled`. Bounded batch processing throughout. Child process streams properly destroyed.
- Rate limiting: **30/42 routes** (71%). Remaining 12 use admin auth (session + handle check), bearer token (cron), or are internal. All fail-open. Campaign email: 95/day quota.
- Build: No routes exceed 500KB. 1,800 KB total client JS across 71 chunks. Supabase SDK in 2 chunks (160KB each, minor duplication). 42 API routes, all correctly dynamic.
- Cron: 3 jobs, ~90 executions/mo, <0.01% of free tier compute.
- ISR/SSG: Optimal — archetype pages SSG (7d), share pages ISR (1h), legal pages ISR (24h), studio force-dynamic.
- **MONITOR: OG image Redis memory** — CARRIED. 62% of Redis at 10K. Consider blob storage at 50K+.
- **MONITOR: `sync-audience` pagination** — CARRIED. Future scale only.

**Cross-agent recommendations:**
- [QA]: All `Promise.allSettled` patterns verified. Resend timeouts fully resolved. No open cost-QA items.
- [Security]: Fetch timeouts at 100% (all modules). Fail-open rate limiting intact. Campaign email quota prevents abuse. RLS FORCE on all tables. No cost-security concerns.
- [Performance]: Redis memory stable at ~243 MB @10K. OG images #1 consumer (62%). Supabase SDK chunk duplication (160KB x2) — minor optimization target. No build regressions.
- [Coverage]: All cost-critical paths well-covered. API routes at ~97.1%. Coverage at 92.17% stmts. No cost-coverage concerns.
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

<!-- ENTRY:START agent=security timestamp=2026-03-23T10:00:00Z -->
## Security Scanner — 2026-03-23
- **Status**: GREEN
- Vulnerabilities: 0 critical, 0 high, 0 medium, 0 low — `pnpm audit` clean.
- Secret leaks: none — all 10 server secrets isolated, 8 NEXT_PUBLIC_ vars are non-sensitive. Error logging scrubs tokens via regex before PostHog.
- License issues: 1 LGPL-3.0 (`@img/sharp-libvips-darwin-arm64`) — dynamically linked, no compliance action needed.
- XSS: 9 user-input entry points in SVG pipeline escaped via `escapeXml()` (handle, displayName, archetype, tier, avatarDataUri, fallback handle, fallback error, verification hash, verification date). Explicit XSS tests at `BadgeSvg.test.tsx:59-65`. Fallback SVG also escapes.
- CORS: only `/api/verify/[hash]` allows `*` (intentional, rate-limited 30 req/60s, read-only). CSP properly configured in `next.config.ts`. Global headers: HSTS (2yr+preload), nosniff, X-XSS-Protection, restrictive Permissions-Policy.
- RLS: **all 9 Supabase tables** RLS-enabled with explicit deny policies. 2 views with `security_invoker = true`.
- Knip: **fully clean** — 0 findings (improved from 1 config hint in previous audit).
- Hardcoded secrets: none found in source. All env vars `.trim()`ed.
- OAuth: CSRF state validation via `timingSafeEqual()`, AES-256-GCM token encryption (fresh IV per encryption), 10s fetch timeouts. CLI tokens HMAC-SHA256 signed with 90-day expiry.
- Fetch timeout coverage: **100%** — all external calls have `AbortSignal.timeout()`.
- Rate limiting: **14+ routes**. Admin routes rate-limited via `adminAuth()` (10 req/IP/60s). Campaign email: 95/day quota, batch 50, Redis counter. All fail-open by design.
- Session cookies: `HttpOnly`, `SameSite=Lax`, `Secure` (HTTPS), 10-minute `Max-Age`.

**Cross-agent recommendations:**
- [Coverage]: All security-critical paths at 91%+. XSS tests comprehensive. HMAC verification at 100%. No new security-coverage gaps.
- [QA]: No security UX issues. Campaign pipeline uses proper auth + quotas. Badge SVG `Promise.allSettled()` re-verified by cost-analyst.
- [Cost Analyst]: Fail-open rate limiting intact. Fetch timeouts at 100%. Campaign email quota prevents abuse. No cost-security concerns.
- [Performance]: No security-related performance concerns. Knip fully clean (0 findings). Rate limiting fail-open by design. CSP properly scoped.
- [Documentation]: Auth cookie functions JSDoc resolved per documentation agent (2026-03-20). No remaining security-documentation gaps.
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

<!-- ENTRY:START agent=coverage timestamp=2026-03-27T02:00:00Z -->
## Coverage Agent — 2026-03-27
- **Status**: GREEN
- Overall coverage: **92.17% stmts** (7,341/7,964), 87.22% branch, 87.26% funcs, 93.56% lines
- Test suite: 370 files, 6,129 tests, 100% pass rate, 0 flaky (3 runs, avg ~36-46s)
- Delta vs 2026-03-26: **+0.70% stmts** (7,283→7,341 covered, +2 total). +1 test file, +97 tests, +1.45% branch, +0.97% funcs. Steady improvement from triage actions.
- All thresholds pass with 17%+ margin (75% stmts threshold).
- Critical paths all GREEN: `lib/impact` 99.5%, `lib/render` 100%, `lib/cache` 98.4%, `lib/history` 98.2%, `lib/codeberg` 97.5%, `lib/bitbucket` 97.2%, `lib/github` 97.1%, `app/api` 97.1%, `lib/db` 96.7%, `lib/email` 96.7%, `lib/auth` 96.3%, `lib/effects` 94.4%, `components` 94.5%, `packages/shared` 100%, `lib/verification` 100%, `lib/insights` 100%.
- `app/admin` at 93.7% (GREEN, was 81.9%). `useAdminDashboard.ts` branch coverage improved from 48.5% (triage target met).
- `app/experiments` at 56.1% (RED) — feature-flagged, canvas/WebGL-heavy, V8/JSDOM limitations. Accepted low priority.
- `HolographicOverlay.tsx` at 47.1% — JSDOM limitation. Accepted.
- Remaining below-target files: `api/auth/callback/route.ts` (70.0% funcs), `UserMenu.tsx` (56.7% funcs), `BadgeContent.tsx` (70.8% branch), `TerminalOutput.tsx` (50.0% branch), `SubMetricPanel.tsx` (64.5% branch), `ScoreBoldNumber.tsx` (60.0% branch).
- 0 flaky tests across 3 consecutive runs.

**Cross-agent recommendations:**
- [Security]: All security-critical paths at 96%+. XSS tests comprehensive. HMAC verification at 100%. No new security-coverage gaps.
- [QA]: Priority test additions: (1) `api/auth/callback/route.ts` (70.0% funcs — OAuth error paths), (2) `UserMenu.tsx` (56.7% funcs — disconnect callbacks), (3) `TerminalOutput.tsx` (50.0% branch — line-type mappings). `/api/studio/config` docs mismatch resolved per triage.
- [Performance]: All critical rendering and API paths at 94%+. Experiments pages remain accepted limitation. `hexmap/page.tsx` (0%, 636 lines) canvas-heavy — no action.
- [Cost Analyst]: All module coverages stable or improving. API routes aggregate at 97.1%. No cost-coverage concerns.
- [DevOps]: All thresholds pass with 17%+ margin. Test suite runs in ~36-46s with coverage. Zero flaky tests.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-03-27T04:55:00Z -->
## Triage — 2026-03-27
- **Reports processed**: 4 (coverage, cost-analyst, performance, cc-rpi-update)
- **Action items resolved**: 13 of 13 — all coverage gaps addressed
- **Summary**: All reports GREEN. Added 207 tests across 13 files closing P1+P2+P3 coverage gaps. Tests: 6,336 passing (371 files), 0 type errors, 0 lint issues.
- **Coverage delta**: +207 tests, +1 test file. Targets: auth/callback funcs→80%+, UserMenu funcs→80%+, BadgeContent branch→80%+, SubMetricPanel branch→80%+, ScoreBoldNumber branch→80%+, TerminalOutput branch→80%+, supabase.ts funcs→90%+, TierVisuals funcs→80%+, AuthorTypewriter branch→80%+, ConfirmDialog branch→80%+, AutocompleteDropdown branch→80%+, ImpactBreakdown branch→80%+, unsubscribe funcs→80%+.
- **No code fixes needed** — all reports GREEN with no regressions. Cost and performance stable. cc-rpi already at v1.13.0.
**Cross-agent recommendations:**
- [Coverage]: All P1/P2/P3 items addressed. Remaining accepted limitations: experiments (WebGL/Canvas), HolographicOverlay (JSDOM), server pages (Next.js).
- [QA]: Test count at 6,336. All critical paths well above 90%. No functional issues.
- [Cost Analyst]: No new cost concerns. Monitor items carried (OG image Redis memory, sync-audience pagination).
- [Performance]: No new performance concerns. Bundle stable. Knip clean.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-03-26T07:00:00Z -->
## Triage — 2026-03-26
- **Reports processed**: 4 (coverage, cost-analyst, qa, cc-rpi-update)
- **Action items resolved**: 10 of 10 — all implemented (2 skipped with justification: campaigns-dashboard already fully covered per analysis, CLAUDE.md studio/config already correct at GET|PUT)
- **Summary**: All reports GREEN. Added 97 tests across 10 files closing Priority 1+2 coverage gaps. Added /cli/authorize error boundary. Added 10s timeout to all Resend emails.send() calls via withTimeout helper.
- **Tests**: 6,129 passing (370 files), 0 type errors, 0 lint issues
- **Coverage delta**: +97 tests, +1 test file. Coverage targets: useAdminDashboard branch→80%+, terminal-display branch→80%+, HeatmapGrid branch→80%+, email/campaigns→95%+, BadgePreviewCard funcs→80%+, UserMenu funcs→75%+, RadarChart branch→80%+, ActivityHeatmap branch→80%+.
- **Code fixes**: withTimeout wrapper on resend.ts, notifications.ts, score-bump.ts, campaigns.ts (EMAIL_SEND_TIMEOUT_MS=10s). New error.tsx for /cli/authorize.
**Cross-agent recommendations:**
- [Coverage]: Priority 1 items addressed (useAdminDashboard, terminal-display, HeatmapGrid, campaigns, BadgePreviewCard, UserMenu, RadarChart, ActivityHeatmap). Remaining: experiments (accepted), HolographicOverlay (JSDOM), server pages.
- [QA]: `/api/studio/config` docs mismatch RESOLVED — CLAUDE.md already says GET|PUT (stale finding from QA 2026-03-18). `/cli/authorize` now has error boundary.
- [Cost Analyst]: All Resend send calls now have 10s timeout. Monitor items carried (OG image blob, sync-audience pagination).
- [Security]: Fetch timeout coverage now 100% including email sends. No new concerns.
<!-- ENTRY:END -->
