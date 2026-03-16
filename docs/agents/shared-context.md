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

<!-- ENTRY:START agent=cost-analyst timestamp=2026-03-16T06:00:00Z -->
## Cost Analyst — 2026-03-16
- **Status**: GREEN
- Estimated monthly cost at 10K users: ~$66 (Vercel $26, Redis $20, Resend $20, Supabase free). At 50K users: ~$191/mo. +$10 vs last report (Resend campaign volume).
- Redis: 22 key pattern families audited (up from 20). TTL coverage 100% per-user keys. 2 global keys without TTL — intentional singletons (`stats:badges_generated` counter + `stats:unique_badges` HyperLogLog), combined <16 KB.
- **Estimated Redis memory @10K users: ~590 MB** — unchanged. OG images ~400 MB (48h TTL), stats/avatars ~150 MB, misc ~40 MB. Well within Upstash Pro 10 GB.
- GitHub API budget: ~690 calls/hr peak vs 5,000/hr limit. 86% headroom. In-flight dedup reduces concurrent calls 40–60%.
- Supabase: 10 tables + 1 view (up from 7+2). **NEW: `email_campaigns` + `campaign_sends`**. Singleton client, PostgREST REST API. No N+1 patterns. Batch queries correct (upsert, `.in()` filters). RLS on all tables. Runtime validation via `parseRow()` on all queries.
- Fetch timeout coverage: **100%** — all external fetch calls have `AbortSignal.timeout()` or `AbortController`.
- Resource leaks: **0 detected** — process cleanup robust (`cleanupProcess()` destroys streams), `Promise.allSettled()` in badge route + cron + multi-platform fetch. Agent log buffer capped at 500 lines.
- **NEW: Campaign email system** — 3 cron jobs (up from 1): warm-cache, process-campaigns, sync-audience. Daily send quota at 95 emails. Batch size 50. Redis counter tracks daily sends. No runaway cost risk.
- **NEW: Avatar caching in place** — `avatar:{handle}` with 6h TTL. Resolves prior recommendation.
- **CARRIED: Admin routes missing Supabase timeout** — 5 admin + 1 feature-flags route. Low traffic, low urgency.
- **CARRIED: `tool_insights` table missing from migration system** — not reproducible on rebuild.
- **CARRIED: `/api/studio/config` docs mismatch** — POST vs GET+PUT per documentation agent.
- Vercel: ~5 static, 12 ISR, ~30 dynamic API, 1 force-dynamic. No edge runtime. 3 cron jobs.

**Cross-agent recommendations:**
- [Performance]: Redis memory stable at ~590 MB @10K. Bitbucket/Codeberg fetch volume (~1K calls/user) remains the next scaling bottleneck — add per-platform concurrency cap in warm-cache if >10 linked users. `dbGetCampaignStats()` aggregates in JS (could be SQL `GROUP BY`) — negligible at current scale.
- [Security]: Fail-open rate limiting intact. All fetch timeouts in place (100% coverage). Campaign email quota prevents abuse. No cost-security concerns.
- [Coverage]: `lib/db` at 86.6% (down from 93.5% due to new `campaigns.ts` at 66.7%). Campaign API routes at 77–78% — need error-path coverage. Admin Supabase timeout gap untested but low risk.
- [QA]: Campaign send pipeline correctly uses batch operations and daily limits. `/api/studio/config` docs mismatch still pending. Process stream leak now resolved. Resend audience sync should be monitored if contacts exceed 5K.
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

<!-- ENTRY:START agent=security timestamp=2026-03-09T09:00:00Z -->
## Security Scanner — 2026-03-09
- **Status**: GREEN
- Vulnerabilities: 0 critical, 0 high, 0 medium, 0 low — `pnpm audit` clean. Previous `minimatch` ReDoS (dev-only) resolved.
- Secret leaks: none — all 10 server secrets isolated, 7 NEXT_PUBLIC_ vars are non-sensitive
- License issues: 1 LGPL-3.0 (`@img/sharp-libvips-darwin-arm64`) — dynamically linked, no compliance action needed
- XSS: all 7 user-input entry points in SVG pipeline escaped via `escapeXml()`, explicit XSS tests exist at `BadgeSvg.test.tsx:600-626`
- CORS: only `/api/verify/[hash]` allows `*` (intentional, rate-limited 30 req/60s, read-only). CSP properly configured in `next.config.ts`.
- RLS: all 6 Supabase tables RLS-enabled with explicit `deny_anon_all` policies. Views use `security_invoker = true`.
- Knip: clean — no unused dependencies detected
- Hardcoded secrets: none found in source
- OAuth timeouts: RESOLVED — all 3 GitHub OAuth fetches now have `AbortSignal.timeout(10000)` (`lib/auth/github.ts:118,142,180`)
- Token encryption: AES-256-GCM for OAuth tokens in `user_platforms` table. Service role key server-only.

**Cross-agent recommendations:**
- [Coverage]: All security-critical paths at 88%+. XSS tests at `BadgeSvg.test.tsx:600-626`. `tool-insights.ts` (0% coverage) has no auth-sensitive logic — low security risk but coverage recommended.
- [QA]: `minimatch` ReDoS resolved — no longer in audit output. No security UX issues.
- [Cost Analyst]: `badge:notified:*` confirmed 365d TTL (not indefinite). Fail-open rate limiting intact. No new cost-security concerns.
- [Performance]: No security-related performance concerns. Rate limiting fail-open by design. CSP `connect-src` properly scoped for PostHog.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=qa timestamp=2026-03-11T09:00:00Z -->
## QA Agent — 2026-03-11
- **Status**: GREEN
- Tests: 4,541/4,541 passed across 283 files, 0 failed, 0 skipped (+303 tests, +11 files vs last QA)
- Type errors: 0
- Lint issues: 0
- A11y issues: 0 — WCAG 2.1 AA compliant. ARIA labels, focus indicators, keyboard nav, semantic HTML, prefers-reduced-motion all verified.
- Design system: **0 violations** — previous hardcoded hex in `ActivityHeatmap.tsx` and `hexmap/page.tsx` RESOLVED. All components use semantic tokens.
- Error handling: 3 error boundaries (root, admin, share page), 8 loading states with `role="status"`, 404 page, consistent API try/catch across 9 routes, SVG fallback rendering with XSS-safe escaping.
- Error gaps: `/studio`, `/about`, `/verify`, `/generating`, `/experiments` routes lack dedicated `error.tsx`. No structured error monitoring (console.error only). `ImpactBreakdown` lacks null guard.
- Confirmed cross-agent issues still present: process stream leak in admin agent route, `Promise.all()` in `/api/insights` `after()` hook, `dbCleanOldSnapshots()` not implemented, `/api/studio/config` docs mismatch (POST vs GET+PUT).

**Cross-agent recommendations:**
- [Coverage]: Priority test additions unchanged: (1) `login/route.ts` (76.9%), (2) `StudioClient.tsx` (0%), (3) `BadgeToolbar.tsx`, (4) `UserMenu.tsx` (38.9%). +303 tests since last QA — strong trajectory.
- [Security]: `minimatch` ReDoS resolved per security agent. No new security-related quality issues. Process stream leak is resource hygiene, not security.
- [Cost Analyst]: Process stream leak, `Promise.all()` → `Promise.allSettled()`, and `dbCleanOldSnapshots()` all confirmed still pending. `/api/studio/config` docs say POST, code exports GET+PUT.
- [Performance]: `ActivityHeatmap.tsx` hardcoded hex RESOLVED — no remaining design system violations. Missing error boundaries on 5 routes is a resilience gap, not a performance issue.
- [Documentation]: `/api/studio/config` method mismatch needs docs update. All 15 dimension/archetype color tokens now used correctly via semantic classes.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage timestamp=2026-03-16T02:05:00Z -->
## Coverage Agent — 2026-03-16
- **Status**: GREEN
- Overall coverage: **83.87% stmts** (6,532/7,788), 78.87% branch, 75.01% funcs, 85.42% lines
- Test suite: 313 files, 5,298 tests, 100% pass rate, 0 flaky (4 consecutive runs)
- Delta vs 2026-03-15: **+3.77% stmts** (+842 newly covered stmts, +685 new source stmts, +585 tests, +19 test files). All thresholds pass. Strong positive trajectory.
- Critical paths: all modules at 86–100% stmts — `lib/render` 100%, `lib/verification` 100%, `lib/utils` 100%, `lib/impact` 99.5%, `lib/history` 98.2%, `lib/codeberg` 97.5%, `lib/github` 97.1%, `lib/email` 94.7%, `lib/auth` 94.5%, `app/api` 94.5%, `lib/insights` 93.0%, `lib/bitbucket` 93.1%, `lib/db` 86.6%, `lib/cache` 80.6%, `packages/shared` 100%
- **IMPROVED: `UserMenu.tsx` now 87.7%** (was 39.8%), **`StudioClient` module now 87.1%** (was 50.6%), **`BadgeToolbar.tsx` now 71.4%** (was 54.9%)
- **NEW: Campaign code added** — `lib/db/campaigns.ts` at 66.7%, campaign API routes at 77–78%, `campaigns-dashboard.tsx` at 40.8%
- Remaining below-80% components: `AuthorTypewriter.tsx` (60.7%), `BadgeToolbar.tsx` (71.4%), `TerminalInput.tsx` (77.2%)
- `use-animated-counter.test.ts` throws 2 unhandled `window is not defined` errors (cosmetic, tests pass)

**Cross-agent recommendations:**
- [Security]: All security-critical paths at 86%+. XSS tests at `BadgeSvg.test.tsx:600-626`. HMAC verification at 100%. No security-coverage concerns. New campaign API routes have auth checks but need more error-path coverage.
- [QA]: Priority test additions: (1) `campaigns-dashboard.tsx` (40.8%, 120 stmts — newly added), (2) `lib/db/campaigns.ts` (66.7%, 147 stmts — data layer), (3) `AuthorTypewriter.tsx` (60.7%, 84 stmts), (4) `BadgeToolbar.tsx` (71.4%, 91 stmts). +585 tests, +19 test files since last report. Previous priorities `UserMenu.tsx` and `StudioClient` are now above 80%.
- [Performance]: `ParticleBackground.tsx` and `hexmap/page.tsx` still canvas-heavy and untested — smoke tests recommended. No new performance-coverage concerns.
- [Cost Analyst]: `lib/db` at 86.6% (down from 93.5% due to new campaigns.ts at 66.7%). New campaign code adds Supabase queries — verify timeout coverage. Feature flag caching at 100%.
- [DevOps]: All API routes at 94.5% aggregate. Campaign API routes (77–78%) are the only API routes below 80%. No CI-affecting issues.
<!-- ENTRY:END -->
