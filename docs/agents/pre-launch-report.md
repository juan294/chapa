# Pre-Launch Audit Report (v32)

> Generated on 2026-02-26 | Branch: `develop` | Commit: `75b7c19`
> 3,983 tests | 248 test files | 58 routes | Next.js 16.1.6 (Turbopack)
> CI: ALL GREEN (5/5 workflows passed) | 6 parallel specialists

## Verdict: CONDITIONAL

No blockers. 13 warnings across all specialists. 5 unpushed commits on develop.

---

## Blockers (must fix before release)

None.

---

## Warnings

| # | Issue | Severity | Found by | Risk |
|---|-------|----------|----------|------|
| W1 | 5 unpushed commits on `develop` (admin Supabase migration + avatar fix) | High | devops | Code not on remote; CI ran on prior state. Must push and verify before release PR |
| W2 | Untracked plan/research files in `docs/` | Low | devops | Should be committed or confirmed local-only |
| W3 | `madge` declared but not installed locally | Low | architect | `check:circular` script broken locally; works via `pnpm dlx`. Fix: `pnpm install` |
| W4 | ESLint 10.0.2 available (current: 9.39.2) — major version bump | Low | architect | No security issue; plan migration separately |
| W5 | Functions coverage at 70.26% (line coverage 79.92%) | Medium | qa-lead | Up from 46.81%/61.15% — significant improvement but some utility functions still untested |
| W6 | Coverage tool fails to parse `experiments/README.md` | Low | qa-lead | Tooling quirk; exclude `.md` from coverage config |
| W7 | Missing `loading.tsx` for `/about`, `/archetypes`, `/verify` routes | Low | performance | Potential blank flash on dynamic routes |
| W8 | Experiment pages are large monolithic `"use client"` components | Low | performance | Behind feature flag; not user-facing |
| W9 | `UserMenu` fires redundant fetch requests on every mount | Low | performance | Bitbucket/Codeberg status checks when both enabled |
| W10 | Admin `<table>` missing `aria-label` | Low | ux | Screen readers announce it as unlabeled table |
| W11 | Admin confidence progress bar lacks `role="progressbar"` | Low | ux | Missing ARIA attributes for accessibility |
| W12 | Share dropdown and User menu missing `aria-label` | Low | ux | Menus have `role="menu"` but no descriptive label |
| W13 | Unlink buttons in UserMenu lack distinguishing `aria-label` | Low | ux | Screen reader announces "Unlink" twice without context |

---

## Detailed Findings

### 1. Quality Assurance (qa-lead) — GREEN

| Metric | Result |
|--------|--------|
| Tests | 3,983 passed / 0 failed (100%) |
| Test files | 248 |
| Duration | 9.62s |
| TypeScript | PASS (zero errors, strict mode) |
| Lint | PASS (zero errors, zero warnings) |

**Coverage:**

| Metric | Covered | Total | % |
|--------|---------|-------|---|
| Statements | 4,539 | 5,772 | 78.63% |
| Branches | 2,337 | 3,097 | 75.46% |
| Functions | 860 | 1,224 | 70.26% |
| Lines | 4,157 | 5,201 | 79.92% |

**Critical path coverage:**

| File | Tests | Level |
|------|-------|-------|
| `lib/impact/v4.ts` | 88 | HIGH |
| `lib/render/BadgeSvg.tsx` | 67 | HIGH |
| `app/u/[handle]/badge.svg/route.ts` | 35 | GOOD |
| `lib/cache/redis.ts` | 30 | GOOD |
| `app/api/auth/callback/route.ts` | 17 | GOOD |
| `lib/render/BadgeBranding.tsx` | 11 | MODERATE |

**API route coverage:** All 32 API route handlers have corresponding test files (1:1 match).

**Graceful degradation:** Well-implemented. Cache-first pattern with 7-day stale fallbacks. Badge route returns branded fallback SVG on failure with shorter cache TTL. Rate limiter is fail-open (documented design decision). Auth callback redirects to `/?error=<code>` on failure.

---

### 2. Security (security-reviewer) — GREEN

| Check | Result |
|-------|--------|
| `pnpm audit` | 0 vulnerabilities |
| Hardcoded secrets | CLEAN (test fixtures only) |
| Client env var safety | CLEAN (7 `NEXT_PUBLIC_` vars, none contain secrets) |
| SVG XSS protection | All user input escaped via `escapeXml()` |
| OAuth CSRF | `timingSafeEqual()` state validation on all 3 providers |
| Session security | AES-256-GCM encryption, HttpOnly, SameSite=Lax, 24h TTL |
| Open redirect protection | `isSafeRedirect()` validates same-origin only |
| Admin authorization | Session + `isAdminHandle()` on all admin routes |
| Security headers | HSTS (2yr+preload), CSP, X-Content-Type-Options, Permissions-Policy |
| `.env` gitignored | YES |
| License compliance | CLEAN (MPL-2.0 native binaries documented as accepted risks) |
| Rate limiting | All API endpoints rate-limited (14 endpoints verified) |
| Webhook verification | Svix HMAC signature validation on Resend webhooks |
| Input validation | Strict regex for handles, whitelist for badge configs, structural validation |

---

### 3. Infrastructure (devops) — GREEN

| Check | Result |
|-------|--------|
| Build | PASS — compiled in 2.9s, 58 routes generated |
| CI (last 5 runs) | ALL GREEN (CI, Secret Scan, Security Scan, Dead Code, Bundle Size) |
| Git state | 5 unpushed commits, untracked plan files |
| Worktrees | Clean (none stale) |
| Branches | Clean (`develop` + `main` only) |
| Env vars | All documented = all used. All `.trim()`'d. All gitignored. |
| Error pages | All 4 present (`error.tsx`, `global-error.tsx`, `not-found.tsx`, `loading.tsx`) |
| Health endpoint | `/api/health` — checks Redis + Supabase in parallel, returns 503 on degraded |
| Badge cache headers | `s-maxage=21600, stale-while-revalidate=604800` (matches spec) |
| Cron | `warm-cache` daily at 06:00 UTC with rotation |

---

### 4. Architecture (architect) — GREEN

| Check | Result |
|-------|--------|
| TypeScript | PASS — zero errors, strict mode + `noUncheckedIndexedAccess` |
| Dependencies | 0 vulnerabilities, consistent React 19.2.4 + TS 5.9.3 |
| Dead code (knip) | CLEAN — no unused files, exports, or dependencies |
| Circular deps | CLEAN — 0 cycles found (492 files scanned) |
| License compliance | CLEAN — no copyleft violations |

**Outdated packages (non-urgent):**

| Package | Current | Latest | Type |
|---------|---------|--------|------|
| `eslint` (dev) | 9.39.2 | 10.0.2 | Major |
| `@types/node` (dev) | 25.3.0 | 25.3.2 | Patch |
| `@supabase/supabase-js` | 2.97.0 | 2.98.0 | Minor |
| `posthog-js` | 1.353.1 | 1.355.0 | Minor |

---

### 5. Performance (performance-eng) — GREEN

| Check | Result |
|-------|--------|
| Build | PASS — 2.9s compile + 217ms static gen with Turbopack |
| `"use client"` placement | Correct — leaf components only, no pages/layouts |
| Heavy deps server-isolated | `@resvg/resvg-js`, `@supabase`, `resend`, `svix` server-only |
| Client deps lazy-loaded | `posthog-js` (interaction-triggered), `canvas-confetti` (call-site import) |
| Code splitting | 6+ dynamic imports with loading states |
| `prefers-reduced-motion` | Comprehensive (global CSS reset + component-level JS checks + canvas-confetti flag) |
| Image optimization | All rendered images use `next/image` |
| Parallel data fetching | `Promise.all` on share page, badge route, health route, cron |
| Font optimization | `display: "swap"`, subset weights, self-hosted via `next/font` |
| Resource hints | `preconnect` + `dns-prefetch` for GitHub API, PostHog, avatars |

---

### 6. UX/Accessibility (ux-reviewer) — GREEN

| Check | Result |
|-------|--------|
| Heading hierarchy | Correct on all production pages |
| ARIA labels | Excellent — minor gaps on admin table, share dropdown, user menu |
| `aria-live` regions | Present on terminal output, copy button, progress, admin loading, error banners |
| Focus indicators | Global `*:focus-visible` rule + component-level styles |
| Skip-to-content | Present and functional (`sr-only` → `focus:not-sr-only`, z-9999, targets #main-content) |
| `prefers-reduced-motion` | Global CSS catch-all + JS `matchMedia` checks in animated components |
| Alt text | All images have descriptive alt text; decorative SVGs use `aria-hidden` |
| Keyboard navigation | No onClick-only violations; all interactive elements are semantic HTML |
| Error/loading states | Complete coverage — error.tsx (root + admin + share), loading.tsx (5 routes), global-error.tsx, not-found.tsx |
| Design token consistency | All production components use semantic tokens; no hardcoded colors |
| `lang="en"` | Set on `<html>` element (layout.tsx + global-error.tsx) |
| Focus traps | Proper implementation in MobileNav, ShortcutCheatSheet, ConfirmDialog |

---

## Recommendations (non-blocking)

1. **Push 5 local commits to `origin/develop`** and verify CI before creating release PR.
2. **Decide on untracked plan/research files** — commit or add to `.gitignore`.
3. **Run `pnpm install`** to fix madge installation (or switch script to `pnpm dlx madge`).
4. **Add `aria-label` to admin table** and confidence progress bar for better screen reader support.
5. **Add `aria-label` to share dropdown and user menu** dropdowns.
6. **Add `loading.tsx` for `/about`, `/archetypes`, `/verify`** routes to avoid blank flashes.
7. **Add coverage thresholds** to `vitest.config.ts` to prevent regression.
8. **Exclude `.md` files** from coverage provider config.
9. **Plan ESLint 10 migration** as a separate post-release task.
10. **Run `ANALYZE=true pnpm run build`** periodically to track bundle size trends.
