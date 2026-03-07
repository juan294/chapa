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

<!-- ENTRY:START agent=cost-analyst timestamp=2026-03-07T06:00:00Z -->
## Cost Analyst — 2026-03-07
- **Status**: GREEN
- Estimated monthly cost at 10K users: ~$56 (Vercel $26, Redis $20, Resend $10, Supabase free).
- Redis TTL coverage: 100% per-user keys. 3 global keys without TTL — intentional, combined <16 KB.
- Per-user Redis: ~60–210 KB (with avatar) / ~8–15 KB (without). Avatar cache is #1 per-user cost driver.
- GitHub API headroom: 35x over estimated usage (100K calls/month vs 3.6M limit). Request dedup reduces concurrent calls 40–60%.
- CDN caching blocks ~90% of badge requests at edge (zero serverless invocations for cached).
- Resource management: zero leaks. Lazy singletons (Redis, Supabase), self-cleaning `_inflight` Map, `Promise.allSettled` in `after()` hooks, fire-and-forget with `void`.
- Supabase: 6 tables + 2 views, singleton client, zero N+1 queries, batch snapshots (50/query), RLS on all tables.
- **RECURRING: Share pages still lack ISR** (`/u/[handle]/page.tsx`) — 3rd consecutive audit. `revalidate=3600` would cut invocations 80–90%.
- **RECURRING: 9 OAuth fetch calls lack `AbortSignal.timeout()`** — BB/CB auth routes can hang to Vercel 31s max.
- **RECURRING: Sequential platform fetches** — `lib/github/client.ts` BB then CB (worst-case 60s). Should `Promise.all()`.
- **RECURRING: `merge_operations` write-only** — no cleanup, unbounded growth. Needs retention policy.
- `svgToPng()` in `og-image/route.ts` still has no timeout guard.

**Cross-agent recommendations:**
- [Performance]: Share page ISR is #1 optimization — 3rd audit confirming. Sequential platform fetches add 60s worst-case. Avatar base64 embedding inflates SVG ~33%.
- [Security]: Fail-open rate limiting intact. 9 OAuth fetches without timeout risk connection leak. Token encryption verified. RLS policies correct on all 6 tables.
- [Coverage]: `merge_operations` cleanup needs tests once implemented. OAuth timeout behavior untested. Share page ISR integration test needed once added.
- [QA]: `merge_operations` needs retention policy. Platform fetch parallelization would benefit from integration test coverage.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=performance timestamp=2026-03-05T09:05:00Z -->
## Performance Engineer — 2026-03-05
- **Status**: GREEN
- Build: Next.js 16.1.6 (Turbopack), compiles in 2.3s, 0 TypeScript errors
- Total static JS: 1,376 KB (1.3 MB) across 52 chunks. No chunk exceeds 500 KB.
- Largest chunk: 219 KB (Next.js framework). Largest third-party: `posthog-js` at 173 KB (lazy-loaded on interaction).
- Knip: clean — 0 unused exports, 0 unused dependencies.
- Font loading: optimal (`next/font/google` with `display: "swap"`, no external requests).
- CLS risks: none detected (images have dimensions, animations use CSS classes).
- Badge SVG caching: `s-maxage=21600, stale-while-revalidate=604800` — well-configured.
- **WARNING**: Share pages (`/u/[handle]/page.tsx`) lack ISR — full SSR on every request. Adding `revalidate=3600` would cut invocations 80–90%.
- `"use client"` audit: 34 files, 30 legitimate, 3 removable (marginal impact).
- Dynamic imports: all heavy components properly code-split (`next/dynamic`, `ssr: false`).

**Cross-agent recommendations:**
- [Coverage]: Share page ISR behavior should have an integration test once `revalidate=3600` is added. `ParticleBackground.tsx` (113 stmts, 0.9% coverage) is canvas-heavy — smoke test recommended.
- [Security]: No performance-related security concerns. PostHog CSP `connect-src` is correctly scoped. Rate limiting is fail-open by design.
- [QA]: `ActivityHeatmap.tsx` hardcodes dimension colors (confirmed by QA agent) — no performance impact but theme inconsistency.
- [Cost Analyst]: Share page ISR is the #1 actionable optimization — confirmed from both cost and performance perspectives. PostHog at 173 KB (not 100 KB as previously estimated) — lazy-loading mitigates LCP impact.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=documentation timestamp=2026-03-06T09:00:00Z -->
## Documentation Agent — 2026-03-06
- **Status**: YELLOW
- Route coverage: 11/78 routes documented in CLAUDE.md (14%). All 11 documented routes exist and are accurate except `/api/studio/config` (docs say POST, code exports GET + PUT).
- Design system drift: 15 color tokens undocumented (8 dimension + 6 archetype + 1 track), 9 animations undocumented. `--color-complement` documented but missing from code.
- Env vars: 29/29 documented vars match code usage — zero mismatches.
- JSDoc coverage: 71/89 exported functions documented (80%). 18 complex functions lack JSDoc — most critical: auth encryption/decryption, confidence scoring, stats merging.
- All required docs exist and are non-empty: `impact-v4.md`, `svg-design.md`, `shared-context.md`, `README.md`.
- 1 outstanding TODO: badge reference PNG in `badge-svg-spec-v1.2.md:905`.
- Possible archetype naming drift: CLAUDE.md lists "Quality Champion" but codebase has `/archetypes/guardian`.

**Cross-agent recommendations:**
- [QA]: `/api/studio/config` method mismatch (POST vs GET+PUT) may affect integration tests asserting POST. Verify archetype naming consistency ("Quality Champion" vs "Guardian") across UI.
- [Security]: Auth functions `encryptToken()`, `decryptToken()`, `validateState()`, `readSessionCookie()` in `lib/auth/github.ts` lack JSDoc — the crypto format (iv:authTag:ciphertext) and timing-safe comparison logic are undocumented. No security vulnerability, but increases risk of misuse.
- [Coverage]: 18 complex functions without JSDoc overlap with files that have lower coverage (`lib/validation.ts`, `lib/keyboard/shortcuts.ts`). Adding tests would naturally force documentation of expected behavior.
- [Performance]: 15 undocumented dimension/archetype color tokens in design-system.md match the hardcoded hex values flagged by QA in `ActivityHeatmap.tsx` — documenting these tokens would help resolve the theme inconsistency.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=security timestamp=2026-03-02T18:00:00Z -->
## Security Scanner — 2026-03-02
- **Status**: GREEN
- Vulnerabilities: 0 critical, 2 high (minimatch ReDoS — dev-only, via eslint), 0 medium, 0 low
- Secret leaks: none — all 10 server secrets isolated, 7 NEXT_PUBLIC_ vars are non-sensitive
- License issues: 1 LGPL-3.0 (`@img/sharp-libvips-darwin-arm64`) — dynamically linked, no compliance action needed
- XSS: all 7 user-input entry points in SVG pipeline escaped via `escapeXml()`, explicit XSS tests exist
- CORS: only `/api/verify/[hash]` allows `*` (intentional, rate-limited, read-only)
- RLS: all 6 Supabase tables RLS-enabled with explicit `anon` deny policies
- Knip: clean — no unused dependencies detected
- Hardcoded secrets: none found in source

**Cross-agent recommendations:**
- [Coverage]: All security-critical paths have 88%+ coverage (confirmed). XSS tests exist at `BadgeSvg.test.tsx:553-577`. No gaps found.
- [QA]: `minimatch` ReDoS is dev-only (eslint transitive) — low urgency but update when convenient to reduce audit noise.
- [Cost Analyst]: `badge:notified:*` keys grow indefinitely (1 byte each). Consider TTL or periodic cleanup at scale.
- [Performance]: No security-related performance concerns. Rate limiting is fail-open by design (documented).
<!-- ENTRY:END -->

<!-- ENTRY:START agent=qa timestamp=2026-03-04T09:00:00Z -->
## QA Agent — 2026-03-04
- **Status**: GREEN
- Tests: 4,238/4,238 passed across 272 files, 0 failed, 0 skipped, 0 flaky
- Type errors: 0
- Lint issues: 0
- A11y issues: 0 — comprehensive ARIA, focus indicators, keyboard nav, semantic HTML
- Error handling: error boundaries at root + scoped routes, loading states with `role="status"`, 404 page, consistent API try/catch, SVG fallback rendering
- Design system: 2 minor violations — hardcoded hex in `ActivityHeatmap.tsx:30-33` and `hexmap/page.tsx:31-35` (dimension colors should use CSS vars)
- All other design system areas clean: semantic tokens, no forbidden fonts, no icon libraries, `rounded-full` only on icon-only buttons

**Cross-agent recommendations:**
- [Coverage]: Priority test additions per coverage agent (StudioClient, BadgeToolbar, AuthorTypewriter) confirmed — these are UI-heavy, non-critical paths. No quality gaps in critical paths.
- [Security]: `minimatch` ReDoS (dev-only, eslint transitive) still present — low urgency, update when convenient.
- [Cost Analyst]: Cache key mismatch bug confirmed still present. CLAUDE.md documentation drift on Redis sorted sets noted.
- [Performance]: `ActivityHeatmap.tsx` hardcodes dimension colors — should use CSS vars for theme consistency.
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage timestamp=2026-03-07T09:10:00Z -->
## Coverage Agent — 2026-03-07
- **Status**: GREEN
- Overall coverage: 78.5% stmts (5,111/6,514), 74.4% branch, 70.4% funcs, 79.7% lines
- Test suite: 272 files, 4,238 tests, 100% pass rate, 0 flaky (3 consecutive runs)
- Critical paths: all 8 critical modules at 88–100% stmts — `lib/render` 100%, `lib/impact` 99.4%, `lib/history` 97.8%, `lib/github` 97.1%, `app/api` 95.5%, `lib/auth` 94.1%, `lib/db` 93.0%, `lib/cache` 88.9%
- Coverage STABLE vs 2026-03-06: identical percentages, same test count, zero regressions
- Largest untested: `hexmap/page.tsx` (132 stmts, 0%), `StudioClient.tsx` (119 stmts, 0%), `ParticleBackground.tsx` (112 stmts, 0.9%)
- RED modules: `app/studio` 27.1%, `app/admin` 56.5%, `app/experiments` 57.4% — all UI-heavy, non-critical paths
- Only critical-path file below 80%: `app/api/auth/login/route.ts` at 76.9% (6 uncovered stmts — OAuth redirect edge cases)
- Stderr noise from 3 error-handling tests (generate, verify, refresh routes) is intentional — not flaky

**Cross-agent recommendations:**
- [Security]: No security-relevant test gaps. All auth routes, OAuth callbacks, session handling at 88%+. SVG XSS tests in `lib/render/escape.test.ts`. HMAC verification at 100%. `login/route.ts` at 76.9% — OAuth redirect edge cases, low security risk.
- [QA]: Priority test additions remain unchanged: `StudioClient.tsx` (119 stmts, 0%), `BadgeToolbar.tsx` (72 uncovered stmts), `AuthorTypewriter.tsx` (67 uncovered stmts). These are UI-heavy, non-critical. `UserMenu.tsx` (54.9%) is user-facing and worth prioritizing.
- [Performance]: `ParticleBackground.tsx` (112 stmts, 0.9%) still canvas-heavy and untested — smoke test recommended.
- [Cost Analyst]: Feature flag caching (`lib/feature-flags.ts`) at 100% coverage. `merge_operations` cleanup needs tests once retention policy is implemented. OAuth timeout behavior untested.
- [DevOps]: All API routes at 95.5% coverage. No CI-affecting issues. node_modules.nosync contamination remains fixed.
<!-- ENTRY:END -->
