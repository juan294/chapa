# Pre-Launch Audit Report (v39)

> Generated on 2026-03-27 | Branch: `develop` | Commit: `2848ef3`
> 6,354 tests | 372 test files | 83 routes | Next.js 16.2.1 (Turbopack)
> CI: ALL GREEN (last 5 runs) | 6 parallel specialists

## Verdict: CONDITIONAL

No blockers. 8 warnings — flaky test (W1), unpushed commits (W2), missing docs for new endpoint (W3), minor a11y (W4-W5), dev dependency vulns (W6), history API leaks confidence data (W7), MPL-2.0 license not in stated policy (W8). Release is safe once W1-W3 are addressed.

## Blockers

None.

## Warnings

| # | Issue | Severity | Found by | Risk |
|---|-------|----------|----------|------|
| W1 | Flaky test: `BadgeToolbar.render.test.tsx` "strips @keyframes..." — timing race in mock Image src setter | Medium | qa-lead | Spurious CI failures on release branch |
| W2 | 4 commits on local `develop` not pushed to `origin/develop` (includes new profile endpoint) | Medium | devops | CI has not validated latest code |
| W3 | New `/api/profile/[handle]` route not documented in CLAUDE.md Key Routes section | Low | devops | External devs/agents may not discover it |
| W4 | `<tr onClick>` in campaigns dashboard lacks `tabIndex`, `role`, and `onKeyDown` | Medium | ux-reviewer | Keyboard users can't activate campaign rows (admin-only) |
| W5 | Unsubscribe route HTML missing `lang="en"` and viewport meta | Low | ux-reviewer | Screen reader language detection, mobile rendering |
| W6 | 5 dev-only dependency vulns: picomatch ReDoS (2 high, 2 moderate), brace-expansion DoS (1 moderate) | Low | security-reviewer | Dev-only — not in production bundle |
| W7 | `/api/history/:handle` exposes `confidence` and `confidencePenalties` — CLAUDE.md says confidence is internal-only | Medium | security-reviewer | Penalty flags like `burst_activity` could be perceived as accusatory |
| W8 | `lightningcss` is MPL-2.0 — stated policy allows MIT/Apache/BSD/ISC only | Low | security-reviewer | Weak copyleft, build-only dep — low real risk |

## Recommendations

| # | Recommendation | Found by | Priority |
|---|---------------|----------|----------|
| R1 | Migrate 4 admin routes to use `adminAuth()` helper (users, feature-flags, engagement-flags, agents-summary) | architect | Low |
| R2 | Bump vitest 4.1.1 → 4.1.2 (patch) | architect | Low |
| R3 | Improve share page test coverage (84% stmts → target 90%+) | qa-lead | Low |
| R4 | Exclude `**/fonts/**` from coverage config to reduce noise | qa-lead | Low |
| R5 | Run `ANALYZE=true pnpm build` periodically — Turbopack no longer shows per-route sizes | performance-eng | Low |
| R6 | Add MPL-2.0 to accepted licenses in CLAUDE.md or document in accepted-risks.md | security-reviewer | Low |

## Detailed Findings

### 1. Quality Assurance (qa-lead) — YELLOW

- **6,354 tests pass** across 372 test files (1 flaky failure in initial run, passed on retry)
- TypeScript strict mode: clean
- ESLint: clean
- **Coverage:** 92.36% statements, 93.76% lines, 88.15% branches, 87.69% functions
- Critical path coverage:
  - Scoring pipeline (`lib/impact/`): 99.46% stmts, 100% lines
  - SVG rendering (`lib/render/`): 100% stmts, 100% lines
  - Database access (`lib/db/`): 96.86% stmts, 99.38% lines
  - Authentication (`lib/auth/`): 96.27% stmts, 98.87% lines
  - Profile endpoint: 100% across all metrics
- **Flaky test** (W1): `BadgeToolbar.render.test.tsx` — async race in mock Image `src` setter
- All external service failures have fail-open behavior with tests
- Every critical API route has a corresponding test file

### 2. Security (security-reviewer) — GREEN

- `pnpm audit`: 5 vulnerabilities (all dev-only — picomatch, brace-expansion)
- No hardcoded secrets in source
- No secrets in `NEXT_PUBLIC_*` env vars
- OAuth: AES-256-GCM encrypted cookies, CSRF via `crypto.timingSafeEqual`, safe redirect validation
- SVG XSS: all user input escaped via `escapeXml()` (5 XML special chars)
- CSP headers: strict, no `unsafe-eval` in production
- HSTS: 2-year with preload + subdomains
- CORS: wildcard only on public read-only endpoints (profile, verify) — rate-limited
- New profile endpoint: verified clean — does NOT expose confidence or penalties
- Licenses: MIT/BSD/Apache/ISC dominant. MPL-2.0 only on lightningcss (build-only)
- Webhook HMAC (Svix), error telemetry sanitization, security.txt all present

### 3. Infrastructure (devops) — GREEN

- **Build:** succeeds (83 routes, 63 static pages, 0 errors, 7.2s compile)
- **CI:** all 5 recent runs passed (CI, Bundle Size, Dead Code, Security Scan, Secret Scanning)
- **Env vars:** all 32 project vars documented and `.trim()`'d — code and docs fully aligned
- **Error pages:** not-found.tsx, error.tsx, global-error.tsx all exist
- **Health endpoint:** checks actual data access (Redis ping + Supabase query), returns "degraded" on failure
- **Vercel config:** 3 crons with `verifyCronSecret()` auth + `maxDuration: 300`
- **Git state:** clean working tree, no stale worktrees, 4 unpushed commits (W2)
- **New profile endpoint:** confirmed present with 18 test cases

### 4. Architecture (architect) — GREEN

- TypeScript: strict mode, clean across all workspaces
- Dependencies: only vitest patch behind (4.1.1 → 4.1.2)
- Dead code (knip): 0 findings
- Circular dependencies (madge): 0 across 695 files
- Code duplication: minor — 5 admin routes inline auth instead of using `adminAuth()` helper (R1)
- DB access properly centralized through `getSupabase()`
- Platform OAuth properly factored via shared handler factories

### 5. Performance (performance-eng) — GREEN

- **Bundle:** largest client chunk 228 KB — all well under 500 KB threshold
- **Client JS total:** 2.0 MB across all chunks
- **"use client":** no directives on layouts; only on interactive leaf components
- **Root layout:** server component — ThemeProvider/PostHog/Keyboard properly isolated as children
- **Parallel I/O:** profile endpoint uses `Promise.all`; badge route uses `Promise.allSettled`
- **Fonts:** `display: "swap"`, preconnect hints for GitHub/PostHog
- **`after()` deferred work:** badge route defers snapshot insert, verification, analytics to post-response
- **Reduced motion:** 2 CSS global blocks + 14+ JS component checks
- **Dynamic imports:** PostHog, canvas-confetti, heavy components all lazy-loaded

### 6. UX/Accessibility (ux-reviewer) — GREEN

- **Headings:** proper h1 → h2 → h3 hierarchy on all production pages (verified via sr-only h1/h2 pattern)
- **ARIA:** comprehensive — ThemeToggle, UserMenu, MobileNav, CopyButton, BadgeToolbar, InfoTooltip, RadarChart, AutocompleteDropdown, ConfirmDialog, DimensionCard all labeled
- **Focus:** global `:focus-visible` outline (2px amber) + skip-to-content link
- **Reduced motion:** universal catch-all at CSS level + per-component JS checks
- **Alt text:** all images/SVGs have descriptive labels; decorative icons have `aria-hidden`
- **Keyboard:** all handlers on native interactive elements; full keyboard support in autocomplete, radar chart, dimension cards
- **Error states:** 13 route-specific error.tsx + global-error.tsx
- **Loading states:** 13 loading.tsx covering all route groups
- **Design tokens:** 0 hardcoded hex colors in production components — full design system adherence
- **One gap:** campaigns `<tr onClick>` missing keyboard support (W4, admin-only)
