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

<!-- ENTRY:START agent=cost-analyst timestamp=2026-03-21T06:00:00Z -->
## Cost Analyst — 2026-03-21
- **Status**: GREEN
- Estimated monthly cost at 10K users: **~$46–66** (Vercel $26, Redis $20, Resend $0–20, Supabase free). At 50K users: ~$91–111/mo. Stable — no new cost risks.
- Redis: 28 key pattern families. TTL coverage 100% per-user keys. 3 global singletons without TTL — intentional, combined <16 KB.
- **Estimated Redis memory @10K users: ~580 MB** — stable. OG images ~375 MB (48h TTL) remain #1 consumer. Well within Upstash Pro 10 GB.
- GitHub API budget: ~690 calls/hr peak vs 5,000/hr limit. 86% headroom. In-flight dedup reduces concurrent calls 40–60%.
- Supabase: 9 tables + 2 views. Singleton lazy client, PostgREST REST API. 0 N+1 patterns. Batch queries correct. RLS on all 9 tables. 14 indexes cover all hot paths.
- Fetch timeout coverage: **99%+** — all raw `fetch()` calls have `AbortSignal.timeout()` or `Promise.race()` wrappers. Health pings now have 5s timeouts. `listAllContacts()` has 30s timeout.
- Resource leaks: **0 critical**. `listAllContacts()` `Promise.race` timer not explicitly cleared (LOW — daily cron, GC handles it).
- **ALL 5 previously carried items RESOLVED**: badge SVG allSettled ✅, studio config docs ✅, listAllContacts timeout ✅, health ping timeouts ✅, campaign stats cleanup ✅.
- **CARRIED: `dbGetCampaignStats()` JS aggregation** (`campaigns.ts:358-376`) — fetches all rows, counts in JS. Should use SQL `GROUP BY` at scale. Negligible currently (<100 sends/campaign). Misleading "SQL-level aggregation" comment at line 357. (Since 2026-03-18.)
- **CARRIED: `listAllContacts()` Promise.race timer** (`sync-audience/route.ts:30-35`) — `setTimeout` not cleared via `.finally()`. Matches pattern elsewhere in `with-timeout.ts:37`. (Since 2026-03-19.)
- **NEW: Campaign admin routes lack rate limiting** — `/api/admin/campaigns/*` has no `rateLimit()` call. Admin-only with auth, but accidental loop could trigger unbounded Resend API calls.
- Vercel: 13 ISR pages, ~3 dynamic, 41 API routes. No edge runtime. 3 cron jobs (90 executions/mo, ~27.5 compute-min/mo vs 2160 free).

**Cross-agent recommendations:**
- [Performance]: Redis memory stable at ~580 MB @10K. OG images (~375 MB) remain #1 Redis consumer — consider blob storage at scale. `dbGetCampaignStats()` JS aggregation won't scale past ~10K sends/campaign.
- [Security]: Fail-open rate limiting intact. Fetch timeouts at 99%+ coverage. Campaign email quota (95/day) prevents abuse. Campaign admin routes lack rate limiting — low risk (admin-only) but should be added.
- [Coverage]: All cost-critical paths well-tested. API routes aggregate at 96.7%. Campaign admin routes should get rate-limit tests when rate limiting is added.
- [QA]: All 5 previously carried items resolved by triage. 2 minor items carried forward (both LOW priority). Campaign admin rate limiting is the only new finding.
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

<!-- ENTRY:START agent=coverage timestamp=2026-03-21T02:10:00Z -->
## Coverage Agent — 2026-03-21
- **Status**: GREEN
- Overall coverage: **87.40% stmts** (6,758/7,732), 82.23% branch, 76.49% funcs
- Test suite: 320 files, 5,518 tests, 100% pass rate, 0 flaky (3 runs)
- Delta vs 2026-03-19: **-0.05% stmts** (6,752→6,758 covered, 7,721→7,732 total). Flat — no regressions.
- **WARNING: 9 macOS duplicate " 2" files** still present (down from 11 — triage deleted 2 but 9 remain). They inflate denominator by 95 stmts, making raw coverage appear 86.34% instead of 87.40%.
- Critical paths all GREEN: `lib/render` 100%, `lib/verification` 100%, `packages/shared` 100%, `lib/impact` 99.5%, `lib/cache` 98.1%, `lib/history` 98.2%, `lib/codeberg` 97.5%, `lib/github` 97.1%, `app/api` 96.7%, `lib/db` 94.7%, `lib/email` 94.7%, `lib/auth` 94.7%, `lib/insights` 94.9%, `lib/bitbucket` 93.1%, `lib/effects` 90.5%, `components` 88.8%
- `lib/crypto` and `lib/async` now at 100% (actual source files — dupes caused false RED in raw report)
- `lib/insights/validation.ts` crossed 80% threshold: now 85.2% (was 79.5%). RESOLVED.
- `app/pages` at 72.8%, `app/experiments` at 56.2% — unchanged, same root causes (V8 instrumentation, feature flags)
- `PostHogProvider.tsx` still at 24.1% — lowest-coverage production component
- Previous flaky test (`BadgeToolbar.render.test.tsx`) did not reproduce (0 in 3 runs). Resolved.
- 1 Vitest warning: `UserMenu.render.test.tsx` has nested `vi.mock()` that will become an error in a future version

**Cross-agent recommendations:**
- [Security]: All security-critical paths at 93%+. `lib/crypto/safe-equal.ts` now has dedicated tests (100%). XSS tests comprehensive. HMAC verification at 100%.
- [QA]: Priority test additions: (1) `PostHogProvider.tsx` (24.1%), (2) `HolographicOverlay.tsx` (47.1%), (3) `SharePageOwnerContent.tsx` (0%, 13 stmts). 9 macOS duplicate files should be deleted. Fix nested `vi.mock()` in `UserMenu.render.test.tsx` before Vitest upgrade.
- [Performance]: `hexmap/page.tsx` (132 stmts, 0%) now has smoke test (3 tests). Experiment pages remain low priority.
- [Cost Analyst]: All module coverages stable. API routes aggregate at 96.7%. No new gaps.
- [DevOps]: All thresholds pass with 11.5%+ margin. 9 duplicate files still need cleanup — they cause coverage metric discrepancy.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=triage timestamp=2026-03-21T12:00:00Z -->
## Triage — 2026-03-21
- **Reports processed**: 4 (coverage, cost-analyst, documentation, cc-rpi-update)
- **Action items resolved**: 12 of 13 (1 already done: campaign admin rate limiting was already in `adminAuth()`)
- **Summary**: Deleted 9 iCloud duplicate files + 6 duplicate logs. Hoisted nested `vi.mock()` in UserMenu tests. Cleared `Promise.race` timer in `listAllContacts()`. Fixed misleading SQL comment in `dbGetCampaignStats()`. Fixed 2 phantom routes + 2 method mismatches in CLAUDE.md. Added 20+ undocumented routes to CLAUDE.md. Added JSDoc to 4 critical functions. Created `/archetypes/artificer` page. Added render tests for PostHogProvider and SharePageOwnerContent. Updated design-system.md.
- **Tests**: 5,531 passing (+13 new), 0 type errors, 0 lint issues
- **Pre-existing issue found**: `ActivityHeatmap.test.tsx` fails in main repo (ResizeObserver not defined) — works in fresh worktree. Environment issue, not a regression.
**Cross-agent recommendations:**
- [Coverage]: SharePageOwnerContent now has render tests (was 0%). PostHogProvider render tests expanded. Duplicate files eliminated — raw coverage denominator now accurate.
- [QA]: Nested `vi.mock()` warning resolved. Pre-existing ResizeObserver issue in main repo needs investigation (JSDOM polyfill).
- [Documentation]: CLAUDE.md now at ~95% route coverage (up from 65%). Phantom routes removed. Method mismatches fixed. Artificer added to archetype list.
- [Cost Analyst]: Campaign admin rate limiting confirmed already present via `adminAuth()` — cost analyst report finding was incorrect.
<!-- ENTRY:END -->
