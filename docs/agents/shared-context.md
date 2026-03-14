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

<!-- ENTRY:START agent=cost-analyst timestamp=2026-03-14T06:00:00Z -->
## Cost Analyst — 2026-03-14
- **Status**: GREEN
- Estimated monthly cost at 10K users: ~$56 (Vercel $26, Redis $20, Resend $10, Supabase free). At 50K users: ~$190/mo.
- Redis: 19 key pattern families audited. TTL coverage 100% per-user keys. 3 global keys without TTL — intentional singletons, combined <13 KB.
- **Estimated Redis memory @10K users: ~3.4-5.4 GB** — OG image cache is 60-80% (~3-5 GB, 7d TTL, 150-300 KB/key base64 PNG). At 15K+ DAU will exceed Upstash Pro 10 GB limit.
- GitHub API budget: ~2,200–4,150 calls/month vs 5,000/hr limit. 35x headroom. In-flight dedup reduces concurrent calls 40–60%.
- Supabase: 7 tables + 2 views. Singleton client, PostgREST REST API. No N+1 patterns. Batch queries correct. RLS on all tables with `deny_anon_all`. Views use `security_invoker = true`.
- Fetch timeout coverage: **100%** — all external fetch calls have `AbortSignal.timeout()` or `AbortController`. Resend `forwardEmail()` uses SDK (manages own HTTP lifecycle).
- **RESOLVED: Admin agent process management** — 120s timeout, stream `.destroy()`, `SIGTERM` all in place.
- **RESOLVED: Resend API timeouts** — `fetchReceivedEmail()` now has `AbortSignal.timeout(5000)`.
- **RESOLVED: 6 archetype pages missing ISR** — all 6 now have `revalidate=604800`.
- **RESOLVED: `/api/insights` after() hook** — now uses `Promise.allSettled()`.
- **CARRIED: `metrics_snapshots` retention** — `dbCleanOldSnapshots()` exists at `snapshots.ts:397` with tests, but NOT wired to cron. 3.65M rows/year at 10K users (~1.5 GB/year).
- **CARRIED: `tool_insights` table missing from migration system** — not reproducible on rebuild.
- Vercel: 5 static, 11 ISR, ~30 dynamic API, 11 force-dynamic (experiments). No edge runtime. 1 cron job. `/privacy` and `/terms` could benefit from ISR.

**Cross-agent recommendations:**
- [Performance]: OG image cache dominates Redis at ~3-5 GB @10K users (60-80%). Plan blob storage migration before 15K DAU. Reduce OG TTL 7d → 48h as interim measure (~70% memory reduction).
- [Security]: Fail-open rate limiting intact. All fetch timeouts now in place (100% coverage). No cost-security concerns.
- [Coverage]: `user-platforms.ts` still at 81.8% — multi-platform token edge cases untested. Resend `AbortSignal.timeout(5000)` has test assertion at `resend.test.ts:168`. Process management tests recommended for admin agent route.
- [QA]: 1 carried issue: `dbCleanOldSnapshots()` not wired to cron (function + tests exist, just needs wiring). `/api/studio/config` docs mismatch (POST vs GET+PUT) still pending.
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

<!-- ENTRY:START agent=coverage timestamp=2026-03-14T07:05:00Z -->
## Coverage Agent — 2026-03-14
- **Status**: GREEN
- Overall coverage: 78.66% stmts (5,541/7,044), 74.85% branch, 70.35% funcs, 79.78% lines
- Test suite: 289 files, 4,581 tests, 100% pass rate, 0 flaky (3 consecutive runs)
- Delta vs 2026-03-13: -0.08% stmts — marginal dip from +38 new source stmts vs +24 newly covered. All thresholds pass.
- Critical paths: all 16 critical modules at 89–100% stmts — `lib/render` 100%, `lib/verification` 100%, `lib/utils` 100%, `lib/impact` 99.5%, `lib/email` 98.3%, `lib/history` 97.9%, `lib/codeberg` 97.5%, `lib/github` 97.1%, `lib/keyboard` 96.5%, `app/api` 94.7%, `lib/auth` 94.5%, `lib/db` 93.5%, `lib/bitbucket` 93.1%, `lib/insights` 93.0%, `lib/cache` 89.2%, `packages/shared` 100%
- Largest untested: `hexmap/page.tsx` (132 stmts, 0%), `StudioClient.tsx` (119 stmts, 0%), `ParticleBackground.tsx` (112 stmts, 0.9%)
- RED modules: `app/studio` 27%, `app/verify` 0%, `app/archetypes` 0%, `app/cli` 0%, `app/about` 0%
- Only critical-path file below 80%: `app/api/auth/login/route.ts` at 76.9% (6 uncovered stmts — OAuth redirect edge cases)
- Previous flaky `window is not defined` — NOT reproduced in 9 days of runs, considered resolved

**Cross-agent recommendations:**
- [Security]: All security-critical paths at 89%+. XSS tests at `BadgeSvg.test.tsx:600-626`. HMAC verification at 100%. `login/route.ts` at 76.9% — OAuth redirect edge cases, low security risk.
- [QA]: Priority test additions unchanged: (1) `login/route.ts` (76.9% — only critical file <80%), (2) `StudioClient.tsx` (119 stmts, 0%), (3) `BadgeToolbar.tsx` (72 uncovered stmts), (4) `UserMenu.tsx` (38.9%, 66 uncovered). No flaky tests detected. +40 tests, +6 test files since last report.
- [Performance]: `ParticleBackground.tsx` (112 stmts, 0.9%) still canvas-heavy and untested — smoke test recommended. `hexmap/page.tsx` (132 stmts, 0%) also canvas-heavy.
- [Cost Analyst]: `lib/db` stable at 93.5%. `user-platforms.ts` multi-platform edge cases still untested. Feature flag caching at 100%.
- [DevOps]: All API routes at 94.7% aggregate coverage. Only `login/route.ts` (76.9%) below 80%. No CI-affecting issues.
<!-- ENTRY:END -->
