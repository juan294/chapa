# Pre-Launch Audit Report (v30)

> Generated on 2026-02-26 | Branch: `develop` | Commit: `32150c0`
> 3,671 tests | 211 test files | 58 routes (11 static, 47 dynamic) | Next.js 16.1.6 (Turbopack)
> CI: ALL GREEN (5/5 workflows passed) | 6 parallel specialists

## Verdict: CONDITIONAL

No blockers. 12 warnings across all specialists. 5 unpushed commits on develop.

---

## Blockers (must fix before release)

None.

---

## Warnings

| # | Issue | Severity | Found by | Risk |
|---|-------|----------|----------|------|
| W1 | 5 unpushed commits on `develop` (badge branding changes) | Medium | devops | Code not on remote; blocks release PR |
| W2 | 2 untracked plan files in `docs/plans/` | Low | devops | Should be committed or confirmed local-only |
| W3 | ESLint 10.0.2 available (current: 9.39.2) — major version bump | Low | architect | No security issue; plan migration separately |
| W4 | `sharp` native dep uses LGPL-3.0 (dynamic linking — compliant) | Low | security | Acceptable per LGPL terms; document in accepted risks |
| W5 | Bitbucket/Codeberg status/connect/disconnect routes lack explicit rate limiting | Low | security | Auth-gated; low abuse risk |
| W6 | Function coverage at 46.81% (line coverage 61.15%) | Medium | qa-lead | Some utility functions untested |
| W7 | API routes `/api/refresh`, `/api/generate`, `/api/history/[handle]`, `/api/verify/[hash]` lack top-level try/catch | Low | qa-lead | Next.js error boundaries catch these; API callers get generic 500 |
| W8 | Coverage reporter is summary-only (no per-file breakdown) | Low | qa-lead | Harder to spot undertested files |
| W9 | Missing `loading.tsx` for `/generating/[handle]` | Low | performance, ux | Potential blank flash; mitigated by client-side loading state |
| W10 | No per-route bundle size data from Turbopack build | Low | performance | Run `ANALYZE=true pnpm run build` periodically |
| W11 | `/u/[handle]` (most public route) has no dedicated `error.tsx` | Low | ux | Falls to global error boundary; lacks route-specific context |
| W12 | Two experiment pages have h2 before h1 in DOM order | Low | ux | Behind feature flag; not user-facing |

---

## Detailed Findings

### 1. Quality Assurance (qa-lead) — GREEN

| Metric | Result |
|--------|--------|
| Tests | 3,671 passed / 0 failed (100%) |
| Test files | 211 |
| Duration | 6.20s |
| TypeScript | PASS (zero errors, strict mode) |
| Lint | PASS (zero errors, zero warnings) |

**Coverage:**

| Metric | Covered | Total | % |
|--------|---------|-------|---|
| Statements | 3,435 | 5,657 | 60.72% |
| Branches | 1,784 | 3,034 | 58.80% |
| Functions | 566 | 1,209 | 46.81% |
| Lines | 3,111 | 5,087 | 61.15% |

**Critical path coverage:**

| File | Tests | Level |
|------|-------|-------|
| `lib/impact/v4.ts` | 88 | HIGH |
| `lib/render/BadgeSvg.tsx` | 67 | HIGH |
| `app/u/[handle]/badge.svg/route.ts` | 31 | GOOD |
| `lib/cache/redis.ts` | 30 | GOOD |
| `app/api/auth/callback/route.ts` | 17 | GOOD |
| `lib/render/BadgeBranding.tsx` | 11 | MODERATE |

**Graceful degradation:** Well-implemented. Cache-first pattern with stale fallbacks. Badge route returns branded fallback SVG on failure. Rate limiter is fail-open (documented design decision). Auth callback redirects to `/?error=<code>` on failure.

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
| Security headers | HSTS, CSP, X-Content-Type-Options, Permissions-Policy |
| `.env` gitignored | YES |
| License compliance | CLEAN (one LGPL-3.0 native binary via dynamic linking — compliant) |

---

### 3. Infrastructure (devops) — GREEN

| Check | Result |
|-------|--------|
| Build | PASS — compiled in 2.2s, 58 routes generated |
| CI (last 5 runs) | ALL GREEN (Secret Scan, Security Scan, Dead Code, Code Review, Bundle Size) |
| Git state | 5 unpushed commits, 2 untracked plan files |
| Worktrees | Clean (none stale) |
| Branches | Clean (`develop` + `main` only) |
| Env vars | 29 documented = 29 used. All `.trim()`'d. All gitignored. |
| Error pages | All 4 present (`error.tsx`, `global-error.tsx`, `not-found.tsx`, `loading.tsx`) |
| Health endpoint | `/api/health` — checks Redis + Supabase, returns 503 on degraded |
| Badge cache headers | `s-maxage=21600, stale-while-revalidate=604800` (matches spec) |
| Cron | `warm-cache` daily at 06:00 UTC |

---

### 4. Architecture (architect) — GREEN

| Check | Result |
|-------|--------|
| TypeScript | PASS — zero errors, strict mode + `noUncheckedIndexedAccess` |
| Dependencies | 0 vulnerabilities, consistent React 19.2.4 + TS 5.9.3 |
| Dead code (knip) | CLEAN — no unused files, exports, or dependencies |
| Circular deps | CLEAN — 0 cycles found (450 files scanned) |
| License compliance | CLEAN — no copyleft violations |

**Outdated packages (non-urgent):**

| Package | Current | Latest | Type |
|---------|---------|--------|------|
| `eslint` (dev) | 9.39.2 | 10.0.2 | Major |
| `@types/node` (dev) | 25.3.0 | 25.3.1 | Patch |
| `@supabase/supabase-js` | 2.97.0 | 2.98.0 | Minor |
| `posthog-js` | 1.353.1 | 1.354.4 | Patch |

---

### 5. Performance (performance-eng) — GREEN

| Check | Result |
|-------|--------|
| Build | PASS — 4.5s with Turbopack |
| `"use client"` placement | Correct — leaf components only, no pages/layouts |
| Heavy deps server-isolated | `@resvg/resvg-js`, `@supabase`, `resend`, `svix` server-only |
| Client deps lazy-loaded | `posthog-js` (interaction-triggered), `canvas-confetti` (call-site import) |
| Code splitting | 8 dynamic imports with loading states |
| `prefers-reduced-motion` | Comprehensive (global CSS + component-level JS checks) |
| Image optimization | All rendered images use `next/image` |
| Loading boundaries | 4/8 key routes have `loading.tsx` |

---

### 6. UX/Accessibility (ux-reviewer) — GREEN

| Check | Result |
|-------|--------|
| Heading hierarchy | Correct on all production pages (2 experiment pages have minor issues) |
| ARIA labels | Excellent — all interactive elements labeled, roles on menus/tabs/dialogs |
| `aria-live` regions | Present on terminal output, copy button, progress, admin loading |
| Focus indicators | Global `*:focus-visible` rule + component-level styles |
| Skip-to-content | Present and functional (`sr-only` → `focus:not-sr-only`) |
| `prefers-reduced-motion` | Global CSS catch-all + JS `matchMedia` checks in animated components |
| Alt text | All images have descriptive alt text; decorative SVGs use `aria-hidden` |
| Keyboard navigation | No onClick-only violations; all interactive elements are semantic HTML |
| Error/loading states | Global boundaries present; `/generating/[handle]` and `/u/[handle]` could use dedicated ones |
| Design token consistency | All production components use semantic tokens; no hardcoded colors |
| `lang="en"` | Set on `<html>` element |

---

## Recommendations (non-blocking)

1. **Push 5 local commits to `origin/develop`** before creating release PR.
2. **Decide on untracked plan files** — commit or add to `.gitignore`.
3. **Add `error.tsx` for `/u/[handle]`** — the most public route deserves a context-specific error page.
4. **Add `loading.tsx` for `/generating/[handle]`** — avoid potential blank flash.
5. **Add try/catch to 4 API routes** (`/api/refresh`, `/api/generate`, `/api/history/[handle]`, `/api/verify/[hash]`) for structured error JSON.
6. **Plan ESLint 10 migration** as a separate task (not pre-release).
7. **Add explicit rate limiting** to Bitbucket/Codeberg connect/status/disconnect routes.
8. **Add per-file coverage reporter** (`"text"` or `"lcov"`) to vitest config.
9. **Document `sharp` LGPL-3.0** in `docs/accepted-risks.md`.
10. **Run `ANALYZE=true pnpm run build`** periodically to track bundle size trends.
