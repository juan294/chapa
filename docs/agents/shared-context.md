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

<!-- ENTRY:START agent=cost-analyst timestamp=2026-03-15T06:00:00Z -->
## Cost Analyst — 2026-03-15
- **Status**: GREEN
- Estimated monthly cost at 10K users: ~$56 (Vercel $26, Redis $20, Resend $10, Supabase free). At 50K users: ~$176/mo.
- Redis: 20 key pattern families audited. TTL coverage 100% per-user keys. 3 global keys without TTL — intentional singletons, combined <16 KB.
- **Estimated Redis memory @10K users: ~590 MB** — OG image cache reduced to ~400 MB (48h TTL, down from ~3-5 GB at 7d). Well within Upstash Pro 10 GB.
- GitHub API budget: ~690 calls/hr peak vs 5,000/hr limit. 86% headroom. In-flight dedup reduces concurrent calls 40–60%.
- Supabase: 7 tables + 2 views. Singleton client, PostgREST REST API. No N+1 patterns. Batch queries correct. RLS on all tables with `deny_anon_all`. Views use `security_invoker = true`. Runtime validation via `parseRow()` on all queries.
- Fetch timeout coverage: **100%** — all external fetch calls have `AbortSignal.timeout()` or `AbortController`.
- **RESOLVED: `dbCleanOldSnapshots()` now wired to cron** — called at `warm-cache/route.ts:174`. 365d retention, 1000-row batches.
- **RESOLVED: OG image TTL 7d → 48h** — `OG_CACHE_TTL=172800` at `og-image/route.ts:42`. Redis memory drops ~85%.
- **RESOLVED: `/privacy` and `/terms` ISR** — both have `revalidate=86400`.
- **NEW: Bitbucket/Codeberg per-user API volume** — up to ~1,025 API calls per user per fetch (50 repos × per-repo calls). Bounded by 30s timeout + MAX_REPOS=50/MAX_PRS=100/MAX_PAGES=5. Low risk now, high risk if 10+ linked platform users.
- **NEW: Admin routes missing Supabase timeout** — 5 admin + 1 feature-flags route call Supabase without explicit timeout. Resilience gap (low traffic, low urgency).
- **CARRIED: `tool_insights` table missing from migration system** — not reproducible on rebuild.
- Vercel: ~5 static, 12 ISR, ~30 dynamic API, 1 force-dynamic (experiments). No edge runtime. 1 cron job.

**Cross-agent recommendations:**
- [Performance]: OG image Redis concern resolved (48h TTL = ~400 MB @10K). Avatar fetches are uncached (~10 KB base64/request) — consider Redis cache (`avatar:<handle>`, 24h TTL) if badge traffic exceeds 100 req/s. Bitbucket/Codeberg fetch volume (~1K calls/user) is the next scaling bottleneck — add per-platform concurrency cap in warm-cache if >10 linked users.
- [Security]: Fail-open rate limiting intact. All fetch timeouts in place (100% coverage). Bitbucket/Codeberg 30s timeout prevents runaway fetches. No cost-security concerns.
- [Coverage]: `user-platforms.ts` still at 81.8% — multi-platform token edge cases untested. Bitbucket/Codeberg pagination cap behavior has test assertions (`queries.test.ts`). Admin Supabase timeout gap is untested but low risk.
- [QA]: All previously carried items resolved. `/api/studio/config` docs mismatch (POST vs GET+PUT) still pending per documentation agent.
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

<!-- ENTRY:START agent=coverage timestamp=2026-03-15T02:05:00Z -->
## Coverage Agent — 2026-03-15
- **Status**: GREEN
- Overall coverage: **80.10% stmts** (5,690/7,103), 76.05% branch, 72.17% funcs, 81.28% lines
- Test suite: 294 files, 4,713 tests, 100% pass rate, 0 flaky (4 consecutive runs)
- Delta vs 2026-03-14: **+1.44% stmts** (+149 newly covered stmts, +59 new source stmts). All thresholds pass. Strong positive trajectory.
- Critical paths: all modules at 89–100% stmts — `lib/render` 100%, `lib/verification` 100%, `lib/utils` 100%, `lib/impact` 99.5%, `lib/email` 98.3%, `lib/history` 98.2%, `lib/codeberg` 97.5%, `lib/github` 97.1%, `lib/keyboard` 96.5%, `lib` root 95.7%, `lib/auth` 94.5%, `lib/db` 93.5%, `lib/bitbucket` 93.1%, `lib/insights` 93.0%, `lib/cache` 89.2%, `packages/shared` 100%
- **RESOLVED: `login/route.ts` now at 100% stmts** (was 76.9% — previous only critical-path file <80%)
- Largest untested: `hexmap/page.tsx` (0%), `BadgePreviewCard.tsx` (0%), `ParticleBackground.tsx` (0.9%), `AuthorTypewriter.tsx` (20.23%)
- RED modules: `app/studio` 50.6% (up from 27%), `app/verify` 0%, `app/archetypes` 0%, `app/cli` 0%, `app/about` 0%
- Component coverage: `UserMenu.tsx` 39.8%, `StudioClient.tsx` 47.9%, `BadgeToolbar.tsx` 54.9% — all still below 80%
- Previous flaky `window is not defined` — NOT reproduced in 10+ days, considered resolved

**Cross-agent recommendations:**
- [Security]: All security-critical paths at 89%+. XSS tests at `BadgeSvg.test.tsx:600-626`. HMAC verification at 100%. `login/route.ts` now at 100%. No security-coverage concerns.
- [QA]: Priority test additions: (1) `UserMenu.tsx` (39.8%, 576 lines — largest low-coverage component), (2) `BadgeToolbar.tsx` (54.9%, 349 lines), (3) `StudioClient.tsx` (47.9%, 314 lines), (4) `BadgePreviewCard.tsx` (0%, 197 lines). +132 tests, +5 test files since last report. `login/route.ts` now fully covered.
- [Performance]: `ParticleBackground.tsx` (112 stmts, 0.9%) and `hexmap/page.tsx` (0%) still canvas-heavy and untested — smoke tests recommended.
- [Cost Analyst]: `lib/db` stable at 93.5%. `user-platforms.ts` at 81.8% — multi-platform token edge cases still untested. Feature flag caching at 100%.
- [DevOps]: All API routes at 94.7%+ aggregate. All critical-path API routes at 80%+. No CI-affecting issues.
<!-- ENTRY:END -->
