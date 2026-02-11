# Pre-Launch Audit Report (v7 — Post Creator Studio)
> Generated on 2026-02-10 | Branch: `develop` | Commit: `2be5c20` | 6 parallel specialists

## Verdict: CONDITIONAL — 0 blockers, 17 warnings (all low-medium)

The application is functionally complete with 694 tests passing, all CI green, solid security, and good accessibility. The 17 warnings are quality improvements that should be addressed before the production release.

---

## Blockers (must fix before release)

None.

---

## Warnings

| # | Issue | Severity | Found by | Area |
|---|-------|----------|----------|------|
| W1 | `eslint-config-next@15` mismatches `next@16` | Medium | Architect | infra |
| W2 | Unused production dep `@react-three/postprocessing` | Low | Architect, Perf | infra |
| W3 | Duplicated code in experiments/ (use-tilt, animations copies) | Medium | Architect | badge |
| W4 | 5 unused exports in effects library | Low | Architect | badge |
| W5 | Lint warnings: `_row` unused param, Badge3DScene useEffect dep | Low | Architect, QA | badge |
| W6 | Unused re-exports (DEFAULT_BADGE_CONFIG, identifyUser, computePrWeight) | Low | Architect, Perf | scoring |
| W7 | OAuth callback route test only covers rate limiting (4 tests) | Medium | QA | oauth |
| W8 | `getStats90d` client missing test for token pass-through | Low | QA | cache |
| W9 | `canvas-confetti` statically imported in barrel, reaches all studio routes | Medium | Perf | badge |
| W10 | `PostHogProvider` wraps entire app — posthog-js loaded on every page | Medium | Perf | ux |
| W11 | Barrel export `lib/effects/index.ts` pulls all effects into any consumer | Medium | Perf | badge |
| W12 | `<nav>` missing `aria-label` in Navbar | Low | UX | ux |
| W13 | ShareButton external link missing new-window aria-label | Low | UX | ux |
| W14 | Decorative `<canvas>` in BadgePreviewCard missing `aria-hidden` | Low | UX | ux |
| W15 | `font-mono` used instead of `font-heading` on landing page (3 places) | Low | UX | ux |
| W16 | Login route fallback URL uses port 3000 instead of 3001 | Low | DevOps | oauth |
| W17 | Package version is `0.0.0` — exposed in health endpoint | Low | DevOps | infra |

---

## Accepted Risks

| # | Risk | Rationale |
|---|------|-----------|
| AR1 | 983KB Three.js chunk (W1) | Code-split to `/experiments/3d-badge` only via `next/dynamic` with `ssr: false`. Does not load on production routes. |
| AR2 | `'unsafe-inline'` in CSP script-src (W2) | Required by Next.js App Router — no nonce-based CSP support yet. Mitigated by other CSP directives. |
| AR3 | Rate limiting fails open on Redis outage (W4) | By design for availability. Users can still access the app during Redis downtime. Low exploitation risk. |
| AR4 | sharp/libvips LGPL-3.0 license (W5) | Dynamically linked native binary — compliant with LGPL terms. Sharp itself is Apache-2.0. |
| AR5 | useReducedMotion hydration mismatch (W13) | Server returns `false`, client may return `true` for reduced-motion users. One-frame flash only. Acceptable tradeoff for responsive a11y. |

---

## Recommendations (not blocking, nice-to-have)

| # | Recommendation | From |
|---|----------------|------|
| R1 | Move experiment-only deps (three, lottie-web, etc.) to devDependencies | Perf |
| R2 | Add `Permissions-Policy` header to next.config.ts | Security, DevOps |
| R3 | Add `Cache-Control: no-store` on `/api/auth/session` | Security |
| R4 | Add `id="main-content"` to share page loading skeleton | UX |
| R5 | Add `@next/bundle-analyzer` for per-route visibility | Perf |
| R6 | Add bundle-size and knip CI triggers for `develop` push (not just PRs) | DevOps |
| R7 | Drop stale git stash from earlier merge | DevOps |
| R8 | Clean dirty working tree before release PR | DevOps |

---

## Detailed Findings

### 1. Quality Assurance (QA Lead) — GREEN

- **Tests**: 694 passed, 0 failed across 52 test files (1.15s)
- **Typecheck**: PASS — all 3 workspace packages clean
- **Lint**: PASS — 0 errors, 3 warnings (all in experimental/effects code)
- **Critical path coverage**: All critical paths tested (scoring 38, SVG 62, OAuth 44, GitHub data 39, cache 17, validation 61, Studio 104)
- **Acceptance criteria**: All met
- **Graceful degradation**: Tested for Redis down, missing env vars, GitHub API errors

### 2. Security (Security Reviewer) — GREEN

- **Vulnerabilities**: 0 (pnpm audit clean)
- **Hardcoded secrets**: None in production code
- **OAuth**: Solid — CSRF via randomBytes state, AES-256-GCM sessions, HttpOnly cookies
- **SVG XSS**: Mitigated — escapeXml() on all user text, numeric coercion on stats
- **Security headers**: Comprehensive (CSP, HSTS, X-Frame-Options, nosniff)
- **Licenses**: All MIT

### 3. Infrastructure (DevOps) — GREEN

- **Build**: SUCCESS — Next.js 16.1.6 Turbopack
- **CI**: All workflows GREEN on develop
- **Badge headers**: Correct (Cache-Control matches spec)
- **Error pages**: All exist and styled
- **Health endpoint**: Valid JSON with graceful degradation

### 4. Architecture (Architect) — YELLOW

- **TypeScript**: All strict mode
- **Circular deps**: None
- **Dead code**: 5 unused exports + 3 unused re-exports flagged by knip
- **eslint-config-next**: Major version mismatch (15 vs next@16)
- **Experiments**: Duplicated files (should import from lib/effects)

### 5. Performance (Performance Engineer) — YELLOW

- **Build**: Succeeds, no chunk > 500KB (largest: 299KB)
- **Barrel exports**: Fragile pattern pulling all effects into consumers
- **canvas-confetti**: Statically imported, should be lazy-loaded
- **PostHogProvider**: Root-level wrapper loads posthog-js on every page
- **Fonts**: Properly optimized with display: "swap"
- **CLS**: No risk — images have explicit dimensions

### 6. UX/Accessibility (UX Reviewer) — GREEN

- **Heading hierarchy**: Correct on all pages
- **ARIA labels**: Comprehensive (radiogroups, menus, alerts, progressbars)
- **Focus indicators**: Global focus-visible with amber outline
- **Reduced motion**: Comprehensive global rule + useReducedMotion hook
- **Keyboard nav**: Arrow keys in OptionPicker, accordion, UserMenu, MobileNav
- **Design system**: Consistent (minor font-mono vs font-heading in 3 places)
