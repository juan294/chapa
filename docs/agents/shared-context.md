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

<!-- ENTRY:START agent=cost-analyst timestamp=2026-03-22T06:00:00Z -->
## Cost Analyst — 2026-03-22
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$40–60** (Vercel $20, Redis $20, Resend $0–20, Supabase free). At 50K users: ~$65–95/mo. Stable — no new cost risks.
- Redis: 15 key pattern families. TTL coverage 100% per-user keys. 3 global singletons without TTL — intentional, combined <16 KB. OG images (~30–60 KB each, 48h TTL) remain #1 consumer.
- **Estimated Redis memory @10K users: ~535 MB** (160 MB user keys + 375 MB OG images). Well within Upstash Pro 10 GB.
- GitHub API budget: ~420 calls/hr @10K users (50% cache hit) vs 5,000/hr limit. 91.6% headroom. In-flight dedup reduces concurrent calls 40–60%.
- Supabase: 9 tables + 2 views. Singleton lazy client, PostgREST REST API. 0 N+1 patterns. Batch queries correct. RLS on all 9 tables. 14 indexes cover all hot paths.
- Fetch timeout coverage: **100%** — all `fetch()` calls have `AbortSignal.timeout()` or `Promise.race()`. `listAllContacts()` timer now cleared via `.finally()`.
- Resource leaks: **0 critical**. Badge SVG route uses `Promise.allSettled()` (verified line 104). All timers properly cleaned up.
- **ALL previously carried items RESOLVED**: `listAllContacts()` timer ✅ (`.finally(() => clearTimeout(timer))` at line 38), badge SVG `allSettled` ✅ (verified at `route.ts:104`), campaign admin rate limiting ✅ (confirmed present via `adminAuth()`).
- **CARRIED: `dbGetCampaignStats()` JS aggregation** (`campaigns.ts:350-376`) — fetches all status rows, counts in JS. Should use SQL `GROUP BY` at scale. Comment at line 357 now accurate. Negligible currently (<100 sends/campaign). (Since 2026-03-18.)
- **MONITOR: `sync-audience` contact pagination** — fetches all Resend contacts from page 1 every run. At 10K+ contacts, consider cursor caching for incremental sync.
- **MONITOR: OG image Redis memory** — at 50K+ users could approach Upstash Pro limits. Consider blob storage (Vercel Blob, R2).
- Vercel: ISR on all public pages, ~3 dynamic, 41+ API routes. No edge runtime. 3 cron jobs (90 executions/mo, ~45 compute-min/mo vs 2,160 free).

**Cross-agent recommendations:**
- [Performance]: Redis memory stable at ~535 MB @10K. OG images remain #1 Redis consumer — consider blob storage at 50K+ scale. `dbGetCampaignStats()` JS aggregation won't scale past ~1K sends/campaign.
- [Security]: Fail-open rate limiting intact. Fetch timeouts at 100% coverage. Campaign email quota (95/day) prevents abuse. All admin routes confirmed rate-limited via `adminAuth()`.
- [Coverage]: All cost-critical paths well-tested. API routes aggregate at 97%+ for admin, 98.6% for auth. No new gaps.
- [QA]: All previously carried items now verified resolved. 1 minor item carried forward (JS aggregation, LOW priority). 2 monitor items (pagination, OG memory) for future scale.
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

<!-- ENTRY:START agent=coverage timestamp=2026-03-22T02:15:00Z -->
## Coverage Agent — 2026-03-22
- **Status**: GREEN
- Overall coverage: **87.72% stmts** (6,853/7,812), 82.45% branch, 79.14% funcs, 88.96% lines
- Test suite: 321 files, 5,548 tests, 100% pass rate, 0 flaky (3 runs)
- Delta vs 2026-03-21: **+0.32% stmts** (6,758→6,853 covered, 7,732→7,812 total). Positive trend — 95 newly covered stmts vs 80 new total.
- macOS duplicate files cleaned up by triage — no longer inflating denominator.
- Critical paths all GREEN: `lib/render` 100%, `lib/verification` 100%, `packages/shared` 100%, `lib/impact` 99.5%, `lib/cache` 98.1%, `lib/history` 98.2%, `app/api/auth` 98.6%, `lib/codeberg` 97.5%, `lib/github` 97.1%, `app/api/admin` 97.0%, `lib/db` 94.7%, `lib/auth` 94.7%, `lib/email` 94.7%, `lib/insights` 94.9%, `lib/bitbucket` 93.1%, `components` 90.7%, `lib/effects` 88.8%
- `lib/crypto`, `lib/async`, `lib/analytics`, `lib/dashboard`, `lib/utils` all at 100%
- `app/admin` pages at 79.1% (YELLOW) — `AdminDashboardClient.tsx` (0%, 31 stmts) and agent admin pages are the gap
- `app/experiments` at 56.2% — unchanged, feature-flagged, V8 instrumentation issues
- `PostHogProvider.tsx` still lowest-coverage production component (render tests added by triage but SDK init hard to test)
- `HolographicOverlay.tsx` at 47.1% — DOM API gaps in JSDOM
- 0 flaky tests across 3 consecutive runs. Previous `BadgeToolbar.render.test.tsx` flaky: resolved.
- 1 Vitest warning: `UserMenu.render.test.tsx` nested `vi.mock()` still present (triage noted as hoisted but warning persists)

**Cross-agent recommendations:**
- [Security]: All security-critical paths at 93%+. XSS tests comprehensive. HMAC verification at 100%. No new security-coverage gaps.
- [QA]: Priority test additions: (1) `app/verify/VerifyForm.tsx` (0%, 13 stmts — client interaction), (2) `HolographicOverlay.tsx` (47.1%), (3) `app/admin/AdminDashboardClient.tsx` (0%, 31 stmts). Nested `vi.mock()` warning in UserMenu still present.
- [Performance]: All critical rendering and API paths at 90%+. Experiment pages remain low priority. `hexmap/page.tsx` (0%, 132 stmts) is canvas-heavy.
- [Cost Analyst]: All module coverages stable or improving. API routes aggregate at 97%+ for admin, 98.6% for auth. No new gaps.
- [DevOps]: All thresholds pass with 12%+ margin. Duplicate file cleanup complete.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-03-22T07:30:00Z -->
## Triage — 2026-03-22
- **Reports processed**: 3 (coverage, cost-analyst, cc-rpi-update)
- **Action items resolved**: 10 of 11 (1 already resolved: Vitest warning in UserMenu was fixed in prior triage)
- **Summary**: Added render tests for 9 Priority 1 untested components (VerifyForm, verify/[hash]/page, AdminDashboardClient, OverallHealthBanner, AgentTogglesTable, Navbar, NavbarClient, CopyButton, cli/authorize/page). Updated `dbGetCampaignStats()` comment to document PostgREST GROUP BY limitation. All reports GREEN, no agent failures.
- **Tests**: 5,671 passing (+123 new, 330 files), 0 type errors, 0 lint issues
- **Coverage delta**: 87.72% stmts (+0.32% vs previous). All critical paths GREEN (90%+).
**Cross-agent recommendations:**
- [Coverage]: 9 Priority 1 components now have render tests. Remaining gaps are Priority 2-4 (experiments, static pages, framework files).
- [QA]: Vitest `vi.mock()` warning no longer reproducible — remove from carried items.
- [Cost Analyst]: `dbGetCampaignStats` JS aggregation confirmed as correct approach — PostgREST lacks GROUP BY. Remove from carried items.
- [Performance]: No new performance concerns. Test suite runs in ~18s.
<!-- ENTRY:END -->
