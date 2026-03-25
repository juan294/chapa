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

<!-- ENTRY:START agent=cost-analyst timestamp=2026-03-25T09:00:00Z -->
## Cost Analyst — 2026-03-25
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$40–60** (Vercel $20, Redis $20, Resend $0–20, Supabase free). At 50K users: ~$65–100/mo. Stable — no new cost risks.
- Redis: **17 key pattern families**. TTL coverage 100% per-user keys. 2 global singletons without TTL — intentional, combined <16 KB. OG images (~50–100 KB each, 48h TTL) remain #1 consumer.
- **Estimated Redis memory @10K users: ~535 MB** (160 MB user keys + 375 MB OG images). Well within Upstash Pro 10 GB (94.6% headroom).
- GitHub API budget: ~420 calls/hr @10K users (50% cache hit) vs 5,000/hr limit. 91.6% headroom. In-flight dedup reduces concurrent calls 40–60%.
- Supabase: 9 tables + 1 view. Singleton lazy client, PostgREST REST API. 0 N+1 patterns. RLS on all 9 tables. `dbGetCampaignStats()` JS aggregation ACCEPTED (PostgREST lacks GROUP BY).
- Fetch timeout coverage: **100% on critical path** — all `fetch()` calls have `AbortSignal.timeout()` or `Promise.race()`. 1 exception: `captureServerError` PostHog (fire-and-forget, never blocks response).
- Resource leaks: **0 critical, 0 warnings**. Badge SVG route uses `Promise.allSettled()` (re-verified at line 104). All timers properly cleaned up. All `after()` callbacks use `Promise.allSettled`.
- Rate limiting: **36 call sites** across all API routes. Comprehensive coverage. All fail-open by design. Campaign email: 95/day quota.
- ISR: 14 routes (7d archetypes, 1h content, 24h legal). 2 force-dynamic. No edge runtime. No middleware.
- Cron: 3 jobs, ~90 executions/mo, ~1.1 compute-hr/mo vs 2,160 free (0.05% usage).
- **MONITOR: `sync-audience` contact pagination** — CARRIED. Future scale only.
- **MONITOR: OG image Redis memory** — CARRIED. Future scale only.

**Cross-agent recommendations:**
- [QA]: Badge SVG `Promise.allSettled` finding from QA 2026-03-18 is RESOLVED. All `after()` callbacks verified. `/api/studio/config` docs mismatch still pending.
- [Security]: Fetch timeouts at 100% critical path. Fail-open rate limiting intact. Campaign email quota prevents abuse. No cost-security concerns.
- [Performance]: Redis memory stable at ~535 MB @10K. OG images remain #1 Redis consumer — consider blob storage at 50K+ scale. No new bundle or build regressions.
- [Coverage]: All cost-critical paths well-covered. API routes at 96.7%. `sync-audience` at 84.6% — aligns with monitor item on contact pagination.
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

<!-- ENTRY:START agent=coverage timestamp=2026-03-25T02:00:00Z -->
## Coverage Agent — 2026-03-25
- **Status**: GREEN
- Overall coverage: **90.65% stmts** (7,218/7,962), 84.85% branch, 85.57% funcs, 92.10% lines
- Test suite: 367 files, 5,926 tests, 100% pass rate, 0 flaky (3 runs)
- Delta vs 2026-03-24: **+1.96% stmts** (7,072→7,218 covered, 7,974→7,962 total). +22 test files, +203 tests, +4.93% funcs. Significant improvement.
- All thresholds pass with 15%+ margin (75% stmts threshold).
- Critical paths all GREEN: `lib/render` 100%, `lib/verification` 100%, `packages/shared` 100%, `lib/impact` 99.5%, `lib/cache` 98.4%, `lib/history` 98.2%, `lib/codeberg` 97.5%, `lib/github` 97.1%, `app/api` 96.7%, `lib/auth` 96.3%, `lib/insights` 94.9%, `lib/email` 94.9%, `lib/db` 93.7%, `lib/bitbucket` 93.1%, `components` 91.9%, `lib/effects` ~91%
- `app/admin` at 80.2% (YELLOW). `AdminDashboardClient.tsx` at 71.0%, `campaigns-dashboard.tsx` improved to 91.5%.
- `app/experiments` at 71.4% (RED) — feature-flagged, canvas/animation-heavy, V8/JSDOM limitations. Low priority.
- `HolographicOverlay.tsx` at 47.1% — DOM API gaps in JSDOM. Accepted limitation.
- Previous critical-path gaps partially resolved: `user-platforms.ts` improved to 96.1%, `campaigns/[id]/test/route.ts` improved to 100%. Remaining: `sync-audience/route.ts` (84.6%), `lib/db/campaigns.ts` (89.0%), `lib/insights/validation.ts` (85.2%), `lib/bitbucket/queries.ts` (89.7%, 67.9% branch).
- 0 flaky tests across 3 consecutive runs (avg ~35s per run).

**Cross-agent recommendations:**
- [Security]: All security-critical paths at 93%+. XSS tests comprehensive. HMAC verification at 100%. No new security-coverage gaps.
- [QA]: Priority test additions: (1) `AdminDashboardClient.tsx` at 71.0% (needs interaction tests), (2) `admin/agents/agent-card.tsx` and `agent-status-grid.tsx` at 0% (new components needing tests), (3) `lib/bitbucket/queries.ts` at 67.9% branch coverage.
- [Performance]: All critical rendering and API paths at 91%+. Experiment pages remain low priority. `hexmap/page.tsx` (0%, 132 stmts) is canvas-heavy.
- [Cost Analyst]: All module coverages stable or improving. API routes aggregate at 96.7%. `sync-audience` route at 84.6% — aligns with cost-analyst's monitor item on contact pagination.
- [DevOps]: All thresholds pass with 15%+ margin. Test suite runs in ~31-39s with coverage.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-03-25T15:00:00Z -->
## Triage — 2026-03-25
- **Reports processed**: 4 (coverage, cost-analyst, cc-rpi-update, pre-launch v38)
- **Action items resolved**: 9 of 9 — all implemented
- **Summary**: All reports GREEN, pre-launch v38 warnings all RESOLVED. Added 106 tests covering 9 files: agent-card (0%→covered), agent-status-grid (0%→covered), AdminDashboardClient (71%→improved), insights/validation (85.2%→improved), bitbucket/queries branch (67.9%→improved), use-animated-counter (79.5%→improved), audience.ts (87.5%→improved), campaigns.ts (89.0%→improved), sync-audience route (84.6%→improved).
- **Tests**: 6,032 passing (369 files), 0 type errors, 0 lint issues
- **Coverage delta**: +106 tests, +2 test files. All Priority 1 and Priority 2 coverage items addressed.
**Cross-agent recommendations:**
- [Coverage]: All Priority 1 items (AdminDashboardClient, agent-card, agent-status-grid, insights/validation, bitbucket/queries) and Priority 2 items (animated-counter, audience, campaigns, sync-audience) now covered. Remaining gaps are accepted limitations (experiments, HolographicOverlay, server pages).
- [QA]: `/api/studio/config` docs mismatch still pending from QA 2026-03-18.
- [Cost Analyst]: All stable. No new cost concerns. Monitor items carried (OG image blob, sync-audience pagination).
- [Security]: All GREEN, 0 vulnerabilities, knip clean. No action needed.
<!-- ENTRY:END -->
