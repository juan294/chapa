# Pre-Launch Audit Report (v2)
> Generated on 2026-02-10 | Branch: `develop` | 6 parallel specialists

## Verdict: CONDITIONAL — 1 blocker, 15 warnings

Previous blockers B1 (OAuth URL mismatch), B2 (CSRF state validation), and B3 (focus indicators) are **all resolved**.

One new blocker found. 15 warnings catalogued as accepted risks or recommended improvements.

---

## Blockers (must fix before submission)

### B1. HIGH — OAuth error flow is silent
**Found by:** ux-reviewer
**Severity:** User-facing — demo failure risk

The callback route redirects to `/?error=no_code`, `/?error=invalid_state`, `/?error=config`, `/?error=token_exchange`, or `/?error=user_fetch` on failure. **The landing page never reads or displays these error parameters.** Users who fail OAuth land back on the homepage with zero feedback.

**Fix:** Read `searchParams.error` in the landing page and display a user-friendly toast/banner (e.g., "Sign-in failed. Please try again.").

---

## Warnings

| # | Issue | Severity | Found by | Risk |
|---|-------|----------|----------|------|
| W1 | In-memory cache stub — won't persist across Vercel cold starts | HIGH | devops, architect, perf-eng, qa-lead, security | Effectively no caching in production; CDN `Cache-Control` headers compensate partially |
| W2 | No custom error pages (404, error, global-error) | HIGH | devops, ux-reviewer | Users see unstyled Next.js defaults on errors |
| W3 | No loading states (`loading.tsx`, Suspense) for share page | HIGH | ux-reviewer | Blank screen during data fetch on slow connections |
| W4 | No skip-to-content link | HIGH | ux-reviewer | WCAG 2.4.1 Level A violation for keyboard/screen reader users |
| W5 | `NEXT_PUBLIC_BASE_URL` undocumented but used in OAuth login | MEDIUM | devops | OAuth redirect breaks in production if not set |
| W6 | No tests for SVG rendering (`BadgeSvg.tsx`, `heatmap.ts`, `escapeXml`) | MEDIUM | qa-lead | Most visible output has zero test coverage |
| W7 | No input validation on `handle` parameter | MEDIUM | security | Cache key injection risk when migrating to Redis |
| W8 | Share page doesn't pass auth token to `getStats90d()` | MEDIUM | architect | Always uses unauthenticated rate limit (60/hr) |
| W9 | Duplicate `escapeXml` in `BadgeSvg.tsx` and `badge.svg/route.ts` | MEDIUM | architect, perf-eng, security | DRY violation, divergence risk for XSS protection |
| W10 | Duplicate scoring weights in `v3.ts` and `ImpactBreakdown.tsx` | MEDIUM | architect | Silent inconsistency if formula changes |
| W11 | Dead code: `BadgePreview.tsx`, `posthog.ts` stubs, `cacheDel`, `HEATMAP_WIDTH/HEIGHT` | LOW | architect, perf-eng | Violates "no dead code" rule |
| W12 | Unnecessary `"use client"` on `ImpactBreakdown.tsx` and `ShareButton.tsx` | LOW | perf-eng | ~1-2 kB avoidable client JS |
| W13 | CopyButton lacks `aria-label` and `aria-live` for state change | LOW | ux-reviewer | Screen readers can't announce "Copied!" feedback |
| W14 | Progress bars in ImpactBreakdown lack `role="progressbar"` and ARIA attrs | LOW | ux-reviewer | Screen readers can't interpret score breakdown bars |
| W15 | Low-opacity text elements (`/20`, `/30`, `/40`) fail WCAG contrast | LOW | ux-reviewer | Decorative but some contain meaningful info |

---

## Detailed Findings

### 1. Quality Assurance (qa-lead) — YELLOW

| Metric | Value |
|--------|-------|
| Tests | **68 passed, 0 failed** |
| Test files | 4 (impact, auth, theme, stats) |
| Typecheck | Clean (0 errors) |
| Lint | Clean (4 warnings in PostHog stubs only) |

**Acceptance criteria:**

| # | Criterion | Status |
|---|-----------|--------|
| 1 | User can log in with GitHub (OAuth) | **MET** |
| 2 | `/u/:handle/badge.svg` loads publicly without auth | **MET** |
| 3 | Badge shows heatmap, commits, PRs, reviews, tier, score, confidence | **MET** |
| 4 | `/u/:handle` shows badge + breakdown + embed snippet | **MET** |
| 5 | Caching prevents repeated API calls within 24h | **PARTIAL** (in-memory stub + CDN headers) |
| 6 | Confidence messaging is non-accusatory | **MET** |
| 7 | Docs: `impact-v3.md` and `svg-design.md` exist | **MET** |

**Coverage gaps:**
- HIGH: `BadgeSvg.tsx`, `heatmap.ts` (core rendering) — zero tests
- MEDIUM: Badge route handler, cache layer, GitHub client wrapper — untested
- LOW: `escapeXml()` function — critical for XSS prevention but untested

**Graceful degradation:** GREEN — badge returns fallback SVG on failure, share page shows error message, GitHub rate limits handled.

---

### 2. Security (security-reviewer) — YELLOW

| Area | Status |
|------|--------|
| `pnpm audit` | GREEN — 0 vulnerabilities |
| Hardcoded secrets | GREEN — only test mocks |
| Token encryption | GREEN — AES-256-GCM with random IV |
| Cookie flags | GREEN — HttpOnly, Secure, SameSite=Lax |
| CSRF state validation | **GREEN** — state cookie created, validated, cleared |
| SVG XSS | GREEN — `escapeXml()` on all user input |
| Env var leakage | GREEN — no secrets in `NEXT_PUBLIC_*` |
| Licenses | GREEN — all MIT/Apache-2.0 |
| GraphQL injection | GREEN — typed variable, not interpolated |
| Handle validation | YELLOW — no regex validation before cache/API (W7) |
| Cache size limit | YELLOW — unbounded in-memory Map (DoS vector) |
| Security headers | YELLOW — no CSP, HSTS, X-Frame-Options configured |
| State comparison | INFO — uses `===` not `timingSafeEqual` (theoretical only) |

---

### 3. Infrastructure (devops) — YELLOW

| Area | Status |
|------|--------|
| Build | GREEN — succeeds cleanly |
| CI | GREEN — all 3 workflows passing (CI, Security Scan, Secret Scanning) |
| Bundle sizes | GREEN — max 107 kB First Load JS |
| Cache headers | GREEN — match CLAUDE.md spec exactly |
| Health endpoint | GREEN — returns valid JSON |
| Error pages | YELLOW — no custom 404/error/global-error (W2) |
| Env var docs | YELLOW — `NEXT_PUBLIC_BASE_URL` missing from docs (W5) |
| Git hygiene | YELLOW — stale local branch `feature/variant-1-landing` |

**Bundle sizes:**

| Route | Size | First Load JS |
|-------|------|---------------|
| `/` (landing) | 161 B | 106 kB |
| `/u/[handle]` (share page) | 1.32 kB | 107 kB |
| `/u/[handle]/badge.svg` | 139 B | 102 kB |
| `/api/auth/*` (4 routes) | 139 B each | 102 kB |
| `/api/health` | 139 B | 102 kB |

10 commits on `develop` not in `main`, ready for release when blocker is fixed.

---

### 4. Architecture (architect) — YELLOW

| Area | Status |
|------|--------|
| Circular deps | GREEN — zero (verified by madge) |
| TypeScript strict | GREEN — `strict: true` everywhere |
| Module boundaries | GREEN — agent team file ownership respected |
| Pure functions | GREEN — scoring and rendering are side-effect-free |
| Shared types | GREEN — `@chapa/shared` properly used across codebase |
| Dependencies | GREEN — minimal production deps (next, react, react-dom) |
| `noUncheckedIndexedAccess` | YELLOW — not enabled |
| Dead code | YELLOW — unused exports and files (W11) |
| Duplicate code | YELLOW — `escapeXml` and weights duplicated (W9, W10) |
| Data flow consistency | YELLOW — share page doesn't pass auth token (W8) |

**Data flow:** Landing → `/api/auth/login` (state cookie) → GitHub → `/api/auth/callback` (validate state, exchange token, create session) → `/u/[handle]` (share page) → badge SVG. Flow is complete and correct.

---

### 5. Performance (performance-eng) — YELLOW

| Metric | Value | Status |
|--------|-------|--------|
| Largest First Load JS | 107 kB | GREEN (4.7x under 500 kB) |
| Shared JS | 102 kB | GREEN |
| Production deps | 3 | GREEN (lean) |
| `useEffect` calls | 0 | GREEN (no hydration risk) |
| Font loading | `display: swap` + subset | GREEN |
| N+1 queries | None (single GraphQL) | GREEN |
| Client components | 2 unnecessary (W12) | YELLOW |
| In-memory cache | Useless on serverless (W1) | YELLOW |

**OG image note:** Share page OG image points to the badge SVG endpoint. Some social platforms (Twitter/X, LinkedIn) may not render SVGs in card previews.

---

### 6. UX/Accessibility (ux-reviewer) — YELLOW

| Area | Status |
|------|--------|
| Focus indicators | **GREEN** — `*:focus-visible` with amber outline (fixed in latest commit) |
| Reduced motion | **GREEN** — `prefers-reduced-motion` media query (fixed in latest commit) |
| Heading hierarchy | GREEN — correct h1→h2→h3, no skipped levels |
| Alt text | GREEN — all images have meaningful alt |
| ARIA labels | GREEN — decorative icons hidden, footer links labeled |
| Color contrast | GREEN — amber on dark ≈ 7.0:1, text-primary ≈ 15:1 |
| Responsive (landing) | GREEN — thorough breakpoints |
| Language attr | GREEN — `<html lang="en">` set |
| OAuth error display | **RED** — silent failures (B1) |
| Skip-to-content | YELLOW — missing (W4) |
| Error/404 pages | YELLOW — no custom pages (W2) |
| Loading states | YELLOW — no loading.tsx (W3) |
| Responsive (share page) | YELLOW — no breakpoint classes |
| CopyButton a11y | YELLOW — no aria-label/aria-live (W13) |
| Progress bars a11y | YELLOW — no role="progressbar" (W14) |
| Low-opacity contrast | YELLOW — decorative text below WCAG AA (W15) |

---

## Changes Since Last Audit (v1)

| Previous Blocker | Status | Resolution |
|-----------------|--------|------------|
| B1: OAuth CTA URL mismatch (`/api/auth/github` → `/api/auth/login`) | **FIXED** | All 3 CTA hrefs corrected in `page.tsx` |
| B2: CSRF state parameter never validated | **FIXED** | `createStateCookie`, `validateState`, `clearStateCookie` added; login sets state, callback validates + clears |
| B3: No visible focus indicators | **FIXED** | `*:focus-visible` + `prefers-reduced-motion` added to `globals.css` |

**New finding:** B1 (OAuth error display) was not caught in v1 because the previous audit focused on whether the OAuth *success* flow worked, not the *failure* path.

---

## Recommendation

Fix B1 (OAuth error display) before submission. The remaining 15 warnings are acceptable risks for a hackathon build, with W1 (in-memory cache) being the most impactful limitation to document.
