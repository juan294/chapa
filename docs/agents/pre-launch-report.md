# Pre-Launch Audit Report (v38)

> Generated on 2026-03-24 | Branch: `develop` | Commit: `4b484da`
> 5,787 tests | 347 test files | 42 API routes | Next.js 16.2.1 (Turbopack)
> CI: ALL GREEN | 6 parallel specialists

## Verdict: CONDITIONAL

No blockers. 5 warnings — all operational (unpushed commits, untracked migration, stale worktrees, minor a11y). Release is safe once warnings are addressed.

## Blockers

None.

## Warnings

| # | Issue | Severity | Found by | Risk |
|---|-------|----------|----------|------|
| W1 | 6 commits on local `develop` not pushed to `origin/develop` | WARNING | devops | Release PR would miss these changes |
| W2 | Untracked `supabase/migrations/018_fix_tool_insights_rls.sql` not committed | WARNING | architect, devops | RLS security fix not in version control |
| W3 | 9 stale worktree directories in `.worktrees/` (Mar 8-10, branches already deleted) | WARNING | devops | Disk waste, potential confusion |
| W4 | vitest/coverage/jsdom lockfile behind wanted versions (patch/minor) | WARNING | architect | Stale lockfile |
| W5 | Range input in number-counters experiment not associated with label element | WARNING | ux-reviewer | Screen reader accessibility |

## Recommendations

| # | Recommendation | Found by | Priority |
|---|---------------|----------|----------|
| R1 | Extract generic platform OAuth handler to reduce Bitbucket/Codeberg duplication | architect | Low |
| R2 | Extract shared test fixtures for platform auth tests | architect | Low |
| R3 | Extract `adminAuthSetup()` helper for campaign route tests | architect | Low |
| R4 | Improve function coverage above 85% (currently 81.25%) | qa-lead | Low |
| R5 | Add render test for `BadgeSkeleton.tsx` | qa-lead | Low |
| R6 | Investigate Turbopack NFT trace warning in `agents-summary/route.ts` | performance-eng, devops | Low |
| R7 | Add `priority` prop to avatar `next/image` on share page for LCP hint | performance-eng | Low |
| R8 | Dynamically import Vercel Analytics/SpeedInsights in root layout | performance-eng | Low |
| R9 | Consider increasing HMAC verification hash from 64 to 128 bits | security-reviewer | Low |
| R10 | Add `type="button"` to UserMenu trigger and unlink buttons | ux-reviewer | Low |
| R11 | Add `htmlFor`/`id` pairing on number-counters experiment slider | ux-reviewer | Low |

## Detailed Findings

### 1. Quality Assurance (qa-lead) — GREEN

- **5,787 tests pass** across 347 test files (0 failures, 0 flaky)
- TypeScript strict mode: clean
- ESLint: clean
- **Coverage:** 89.2% statements, 90.5% lines, 84.7% branches, 81.3% functions
- Critical path coverage:
  - Scoring pipeline: 240 tests
  - SVG rendering: 235 tests
  - OAuth: 152 tests
  - Badge route: 39 tests
  - Cache layer: 70 tests
- All external service failures have fail-open behavior with tests
- Every API route (42) has a corresponding test file
- Public release readiness validated by 23-assertion acceptance test

### 2. Security (security-reviewer) — GREEN

- `pnpm audit`: 0 vulnerabilities
- No hardcoded secrets in source (test fixtures only)
- No secrets in `NEXT_PUBLIC_*` env vars
- OAuth: AES-256-GCM encrypted cookies, CSRF via timing-safe state tokens, open redirect protection
- SVG XSS: all user input escaped via `escapeXml()`
- Avatar URLs: hostname whitelist (GitHub only), content-type validation
- Supabase: parameterized queries only, RLS + FORCE on all tables, deny-all anon policies
- Security headers: HSTS (2yr + preload), CSP, X-Frame-Options DENY, nosniff, strict referrer
- CORS: wildcard only on public verify endpoint (accepted risk #596)
- Licenses: MIT/BSD/Apache/ISC — no GPL/AGPL. MPL-2.0 on resvg-js (accepted risk #464)
- All accepted risks documented in `docs/accepted-risks.md`

### 3. Infrastructure (devops) — YELLOW

- **Build:** succeeds (63 routes, 0 errors)
- **CI:** all 5 recent runs passed (CI, Bundle Size, Security Scan, Dead Code, Secret Scanning)
- **Env vars:** code and docs fully aligned, all vars `.trim()`'d
- **Error pages:** 404, error, global-error all exist
- **Health endpoint:** `{"status":"ok"}` with Redis + Supabase healthy
- **Vercel config:** 3 crons correctly configured with auth + maxDuration
- **GitHub Actions:** 7 workflows (CI, Security, Secrets, Bundle, Dead Code, Claude Review, Lighthouse)
- **Git state:** 6 unpushed commits, 1 untracked migration, 9 stale worktrees

### 4. Architecture (architect) — GREEN

- TypeScript: strict mode, clean across all workspaces
- Dependencies: 3 dev deps slightly behind lockfile (patch/minor)
- Dead code (knip): 0 findings
- Circular dependencies: 0 (223 lib files, 319 app files scanned)
- Code duplication: 4.2% (within acceptable range). Concentrated in Bitbucket/Codeberg OAuth routes (structural similarity)

### 5. Performance (performance-eng) — GREEN

- **Bundle:** largest chunk ~227KB (React runtime), no route exceeds 500KB
- **"use client":** no client directives on layouts or pages (main routes)
- **Dynamic imports:** heavy components properly lazy-loaded (canvas-confetti, posthog-js, ShareBadgePreview, GlobalCommandBar)
- **useEffect:** 122 occurrences across 47 files, all appropriate
- **Fonts:** `display: "swap"`, self-hosted via `next/font/google`, latin subset
- **Images:** `next/image` with explicit dimensions, no raw `<img>` in UI
- **Loading states:** 13 loading.tsx files covering all routes
- **Reduced motion:** 33 files respect `prefers-reduced-motion`
- **Resource hints:** preconnect + dns-prefetch for GitHub API and PostHog
- **Deps:** 12 production deps, all heavy libs dynamically imported

### 6. UX/Accessibility (ux-reviewer) — GREEN

- **Headings:** proper h1 → h2 → h3 hierarchy on all pages
- **ARIA:** comprehensive labeling (nav, toggles, inputs, dialogs, badges, menus)
- **Focus:** global `:focus-visible` outline + skip-to-content link
- **Reduced motion:** universal catch-all + specific animation overrides
- **Alt text:** all images/SVGs have descriptive labels, decorative icons have `aria-hidden`
- **Keyboard:** all handlers on native interactive elements, focus traps in modals
- **Error states:** 12 route-specific error boundaries + global error/not-found
- **Loading states:** 13 loading boundaries covering every route group
- **Design tokens:** 0 hardcoded hex colors in production pages — full design system adherence
- **Empty states:** handled in admin table, heatmap, coaching insights, sparkline, autocomplete
