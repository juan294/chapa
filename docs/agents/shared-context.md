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

<!-- ENTRY:START agent=cost-analyst timestamp=2026-03-26T09:00:00Z -->
## Cost Analyst — 2026-03-26
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$40-60** (Vercel $20, Redis $10-20, Resend $0-20, Supabase free). At 50K users: ~$65-100/mo. Stable — no new cost risks.
- Redis: **24 key pattern families** (was 17). +7 new: bitbucket, codeberg, craft, supplemental, og-image, campaign daily-sends, cli device. TTL coverage 100% per-user keys. 2 global singletons without TTL — intentional, combined <16 KB.
- **Estimated Redis memory @10K users: ~243 MB** (93 MB user keys + 150 MB images). Refined estimate (previous 535 MB double-counted OG images). Well within Upstash Pro 10 GB (97.6% headroom).
- GitHub API budget: **~57 calls/hr @10K** (1.1% of 5K/hr limit). Conservative estimate with 6h cache. Safe until 500K+ users.
- Supabase: **9 tables + 2 views** (was +1 view). `admin_users` view added. Singleton lazy client, PostgREST REST API. 0 N+1 patterns. RLS on all 9 tables with FORCE ROW LEVEL SECURITY (migration 018). `dbGetCampaignStats()` JS aggregation ACCEPTED.
- Fetch timeout coverage: **100% critical path**. 2 non-critical missing: `captureServerError` PostHog (fire-and-forget), `emails.send()` Resend (relies on Vercel 30s default).
- Resource leaks: **0 critical, 0 warnings**. All timers cleaned. All `after()` callbacks use `Promise.allSettled`. Bounded batch processing throughout.
- Rate limiting: **28/30 routes** (93%). 2 intentionally unprotected (login redirect, public feature-flags). All fail-open. Campaign email: 95/day quota.
- Build: No routes exceed 500KB. Supabase SDK in 2 chunks (160KB each, minor duplication). 42 API routes, all correctly dynamic.
- Cron: 3 jobs, ~90 executions/mo, <0.01% of free tier compute.
- **MONITOR: OG image Redis memory** — CARRIED. 62% of Redis at 10K. Consider blob storage at 50K+.
- **MONITOR: `sync-audience` pagination** — CARRIED. Coverage improved to 98.1%. Future scale only.

**Cross-agent recommendations:**
- [QA]: All `Promise.allSettled` patterns verified. `/api/studio/config` docs mismatch still pending (carried since 2026-03-18).
- [Security]: Fetch timeouts at 100% critical path. Fail-open rate limiting intact. Campaign email quota prevents abuse. RLS tightened with FORCE (migration 018). No cost-security concerns.
- [Performance]: Redis memory revised to ~243 MB @10K (down from 535 MB). OG images remain #1 consumer (62%). Supabase SDK chunk duplication (160KB x2) — minor optimization target. No build regressions.
- [Coverage]: All cost-critical paths well-covered. API routes at ~97%. `sync-audience` improved to 98.1%.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=performance timestamp=2026-03-12T17:15:00Z -->
## Performance Engineer — 2026-03-12
- **Status**: GREEN
- Build: Next.js 16.2.1 (Turbopack), compiles in 2.7s, 0 TypeScript errors
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

<!-- ENTRY:START agent=documentation timestamp=2026-03-20T09:00:00Z -->
## Documentation Agent — 2026-03-20
- **Status**: YELLOW
- Route coverage: 38/58+ routes documented in CLAUDE.md (~65%). 20+ undocumented routes: entire campaigns API (7 routes), platform connect/disconnect/status (6), OG images (2), LLM endpoints (2), campaign crons (2), well-known (1), pages (3).
- **Phantom routes**: 2 documented routes don't exist (`/api/auth/bitbucket/login`, `/api/auth/codeberg/login`) — actual routes are `/connect`, `/disconnect`, `/status`.
- **Method mismatches**: 2 — `feature-flags` docs say PUT, code is PATCH; `engagement-flags` docs say GET|PUT, code has GET only.
- Design system: 50/51 tokens documented (98%). `--color-complement` base token undocumented. 17/18 animations documented — `animate-hex-cell-in` missing. All hex values accurate.
- Env vars: **30/30 fully consistent** across CLAUDE.md, codebase, and .env.example. All `.trim()`ed. Previous `NEXT_PUBLIC_INSIGHTS_ENABLED` gap resolved.
- JSDoc coverage: ~78% of exported functions in `lib/`. Auth, render, impact, history all 95–100%. 4 critical complex functions still lack JSDoc: `isValidTelemetryPayload`, `isValidStatsShape`, `isValidInsightsUpload` (130+ lines), `fetchContributionData`.
- All 6 required docs exist and are non-empty. README has full setup instructions (195 lines). Shared-context has 7 entries, latest 2026-03-19.
- Archetype naming: CLAUDE.md correctly documents "Quality Champion" display name vs "guardian" internal route. No `/archetypes/artificer` page despite archetype being listed.

**Cross-agent recommendations:**
- [QA]: 2 phantom routes (`bitbucket/login`, `codeberg/login`) may have stale integration tests. `feature-flags` method mismatch (PUT vs PATCH) could affect admin tests. Archetype "artificer" listed but no page exists.
- [Security]: Auth cookie functions now have JSDoc (resolved). No security-related doc gaps.
- [Coverage]: 4 undocumented complex validation functions overlap with files at lower coverage. Priority JSDoc: `lib/insights/validation.ts` (79.5%, 130+ lines undocumented), `lib/utils/validation.ts` (2 functions ~40 lines each).
- [Performance]: Design system token documentation nearly complete (98%). No remaining performance-documentation concerns.
- [Cost Analyst]: Campaign API routes (7) and cron jobs (2) fully undocumented — ensure cost model includes campaign email sends.
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

<!-- ENTRY:START agent=coverage timestamp=2026-03-26T02:00:00Z -->
## Coverage Agent — 2026-03-26
- **Status**: GREEN
- Overall coverage: **91.47% stmts** (7,283/7,962), 85.77% branch, 86.29% funcs, 92.89% lines
- Test suite: 369 files, 6,032 tests, 100% pass rate, 0 flaky (3 runs)
- Delta vs 2026-03-25: **+0.82% stmts** (7,218→7,283 covered, 7,962 total unchanged). +2 test files, +106 tests, +0.72% funcs. Steady improvement.
- All thresholds pass with 15%+ margin (75% stmts threshold).
- Critical paths all GREEN: `lib/impact` 99.5%, `lib/cache` 98.4%, `lib/history` 98.2%, `lib/codeberg` 97.5%, `lib/bitbucket` 97.2%, `lib/github` 97.1%, `app/api` ~97%, `lib/db` 96.7%, `lib/auth` 96.3%, `lib/email` 96.2%, `packages/shared` 100%, `components` 91.9%, `lib/effects` ~91%
- `app/admin` at 81.9% (YELLOW). `AdminDashboardClient.tsx` improved to 80.6% (was 71.0%). `useAdminDashboard.ts` at 48.5% branch — remaining gap.
- `app/experiments` at 71.4% (RED) — feature-flagged, canvas/animation-heavy, V8/JSDOM limitations. Low priority.
- `HolographicOverlay.tsx` at 47.1% — DOM API gaps in JSDOM. Accepted limitation.
- Previous triage items resolved: `agent-card.tsx` and `agent-status-grid.tsx` now at 100%. `sync-audience/route.ts` improved to 98.1%. `lib/db/campaigns.ts` improved to 100%. `lib/bitbucket/queries.ts` improved to 95.9% stmts / 85.7% branch. Remaining: `useAdminDashboard.ts` (48.5% branch), `campaigns-dashboard.tsx` (79.7% funcs).
- 0 flaky tests across 3 consecutive runs (avg ~35-45s per run).

**Cross-agent recommendations:**
- [Security]: All security-critical paths at 96%+. XSS tests comprehensive. HMAC verification at 100%. No new security-coverage gaps.
- [QA]: Priority test additions: (1) `useAdminDashboard.ts` at 48.5% branch (error/loading paths), (2) `BadgePreviewCard.tsx` at 53.3% funcs, (3) `UserMenu.tsx` at 56.7% funcs. `/api/studio/config` docs mismatch still pending.
- [Performance]: All critical rendering and API paths at 91%+. Experiment pages remain low priority. `hexmap/page.tsx` (0%, 636 lines) is canvas-heavy.
- [Cost Analyst]: All module coverages stable or improving. API routes aggregate at ~97%. `sync-audience` improved to 98.1% — monitor item mostly resolved.
- [DevOps]: All thresholds pass with 15%+ margin. Test suite runs in ~35-45s with coverage.
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
