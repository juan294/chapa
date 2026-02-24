# Pre-Launch Audit Report (v23)

> Generated on 2026-02-24 | Branch: `develop` | 6 parallel specialists

## Verdict: CONDITIONAL

Zero blockers. 4 of 6 specialists report GREEN, 2 report YELLOW (Security, DevOps). The codebase is healthy, well-tested (3,400 tests across 199 files), and architecturally clean. 24 non-blocking warnings remain. The delta since v22 includes the full Bitbucket integration (5 phases, 36 files changed, +4,322 lines).

**Conditions:**
1. Push the 10 unpushed commits on `develop` and verify CI green before creating the release PR.
2. Document the 3 new Bitbucket environment variables in `CLAUDE.md`.

---

## Summary

| Specialist | Status | Key Finding |
|------------|--------|-------------|
| Architect | **GREEN** | Clean typecheck, zero circular deps, zero dead code (knip), strict TS everywhere |
| QA Lead | **GREEN** | 3,400 tests pass (100%) across 199 files, all critical paths covered including Bitbucket |
| Security | **YELLOW** | Zero production vulns, OAuth AES-256-GCM, XSS escaped; `renderMarkdown()` in admin uses `dangerouslySetInnerHTML` without sanitization |
| Performance | **YELLOW** | Build succeeds, all pages exceed 500KB First Load JS (579KB baseline = Next.js runtime + core-js polyfills). App-specific code is minimal |
| UX/A11y | **GREEN** | 108 ARIA attributes across 31 components, comprehensive reduced motion support, skip-to-content, focus indicators |
| DevOps | **YELLOW** | Build succeeds, CI green on last 5 runs, but 10 unpushed commits on develop, 3 undocumented Bitbucket env vars |

---

## Changes Since v22

| Area | v22 | v23 | Delta |
|------|-----|-----|-------|
| Tests | 3,258 across 190 files | 3,400 across 199 files | +142 tests, +9 files |
| Bitbucket integration | Not present | Full 5-phase implementation | 36 files changed, +4,322 lines |
| New API routes | — | `/api/auth/bitbucket/{connect,callback,disconnect,status}` | 4 new endpoints |
| New DB layer | — | `lib/db/user-platforms.ts` (linked platforms CRUD) | AES-256-GCM token encryption |
| New stats fetcher | — | `lib/bitbucket/stats.ts` (Bitbucket API client) | StatsData-compatible output |
| Cache keys | `stats:v2:{handle}` | `stats:v2:merged:{handle}`, `stats:v2:github:{handle}`, `stats:v2:bitbucket:{handle}` | Backward-compatible migration |
| UserMenu | GitHub only | Bitbucket link/unlink integration | Feature-flagged |
| Share page | GitHub only | Platform indicator when Bitbucket data merged | Subtle `+ Bitbucket` label |
| Unpushed commits | 0 | 10 | Must push before release |
| Undocumented env vars | 0 | 3 (Bitbucket) | Must document |

---

## Blockers

None.

---

## Warnings

| # | Issue | Severity | Found By | Category |
|---|-------|----------|----------|----------|
| W1 | CSP `unsafe-inline` for scripts (Next.js requirement) | Low | Security | Accepted risk (#396) |
| W2 | CSP `unsafe-eval` in dev only | Info | Security | No action (#397) |
| W3 | Rate limiter fail-open when Redis down | Low | Security | Accepted design (#398) |
| W4 | IP extraction trusts proxy headers | Low | Security | Accepted for Vercel (#399) |
| W5 | CSP `unsafe-inline` for styles (Tailwind v4) | Low | Security | Accepted risk (#400) |
| W6 | HMAC verification hash truncated to 64 bits | Info | Security | Acceptable for use case (#401) |
| W7 | No edge middleware for admin | Info | Security | Component-level protection sufficient (#402) |
| W8 | MPL-2.0/LGPL-3.0 dependency (sharp/libvips) | Info | Security | Accepted risk (#450) |
| W9 | `renderMarkdown()` uses `dangerouslySetInnerHTML` without sanitization | Low | Security | Admin-only, auth-gated |
| W10 | 3 dev-only audit vulns (eslint toolchain) | Low | Architect | Not in production bundle |
| W11 | 5 packages slightly behind patch/minor versions | Low | Architect | `pnpm update` would resolve |
| W12 | ESLint 10 available (major, held back) | Info | Architect | Waiting for ecosystem support |
| W13 | 4 lint warnings in `AdminUserTable.render.test.tsx` | Info | QA | Unused mock destructured variables |
| W14 | `archetypeDemoData.ts` has no dedicated test file | Low | QA | Data-only module, low risk |
| W15 | Confidence value in JSON-LD structured data | Info | QA | Not visible UI, but discoverable |
| W16 | All pages exceed 500KB First Load JS (579KB baseline) | Medium | Performance | Next.js runtime (469KB) + core-js (110KB) |
| W17 | No `<Suspense>` boundaries in page components | Medium | Performance | Share page blocks on async calls |
| W18 | `archetypeDemoData.ts` ships 12 large constants | Low | Performance | Not tree-shaken per-archetype |
| W19 | PostHog preconnect but library lazy-loaded | Low | Performance | Wasted connection |
| W20 | Low contrast on `text-terminal-dim` (dark: 2.5:1, light: 2.9:1) | Low | UX | Decorative elements only |
| W21 | Low contrast on `text-text-secondary/50` in ImpactBreakdown | Low | UX | Supplementary labels |
| W22 | BadgeToolbar status changes not announced to screen readers | Low | UX | Missing `aria-live` region |
| W23 | GlobalCommandBar auto-clears output after 5s | Low | UX | Screen readers may miss content |
| W24 | 10 unpushed commits on `develop` | Medium | DevOps | CI hasn't run against Bitbucket integration |
| W25 | 3 undocumented env vars (BITBUCKET_CLIENT_ID, BITBUCKET_CLIENT_SECRET, NEXT_PUBLIC_BITBUCKET_ENABLED) | Medium | DevOps | Must add to CLAUDE.md |
| W26 | Admin dashboard double h1 issue | Low | UX | Minor heading hierarchy issue |

---

## Detailed Findings

### 1. Architecture (architect) — GREEN

**TypeScript:** `strict: true` + `noUncheckedIndexedAccess: true` across all 3 workspace configs (root, `apps/web`, `packages/shared`). Zero type errors.

**Circular Dependencies:** None — madge processed all files cleanly.

**Dependencies:**
- 5 packages slightly behind (Supabase, Tailwind, PostHog, @types/node) — all within semver range
- ESLint 10 available but held back (ecosystem compatibility)
- 3 dev-only vulnerabilities in ESLint toolchain — not exploitable in production
- No duplicate packages. React single-versioned at 19.2.4. TypeScript at 5.9.3.

**Dead Code:** Knip reports zero unused files, exports, or dependencies. New Bitbucket files all have consumers.

**Lint:** 4 warnings (unused vars in one test file). Zero errors.

---

### 2. Quality Assurance (qa-lead) — GREEN

**Test Suite:** 3,400 tests across 199 files — all passing (100%).

**Type Check:** PASS across both workspaces. Zero errors.

**Lint:** 4 warnings, 0 errors.

**Critical Path Coverage:**

| Area | Test Files | Tests | Assessment |
|------|-----------|-------|------------|
| Scoring pipeline (`lib/impact/`) | 6 files | 215+ | Full — all source files covered |
| SVG rendering (`lib/render/`) | 10 files | 172+ | Full — XSS escape verified |
| OAuth auth (`lib/auth/` + `api/auth/`) | 9+ files | 116+ | Full — includes Bitbucket OAuth |
| Badge route (`u/[handle]/badge.svg/`) | 1 file | 31+ | Full — happy path, fallback, headers |
| Cache layer (`lib/cache/`) | 2 files | 39+ | Full — fail-open tested |
| History pipeline (`lib/history/`) | 5 files | 66+ | Full — snapshot, diff, trend |
| Share page (`u/[handle]/`) | 3 files | 44+ | Full — includes Bitbucket indicator |
| GitHub data (`lib/github/`) | 4 files | 62+ | Full — stale fallback, Bitbucket merge |
| Studio (`app/studio/`) | 7 files | 132+ | Full — including responsive |
| Admin (`app/admin/`) | 18+ files | 300+ | Full — render + integration |
| Bitbucket integration (NEW) | 9+ files | 142+ | Full — OAuth, stats, merge, UI |
| Shared package | 5 files | 80+ | Full |

**New Bitbucket Test Coverage:**
- `lib/auth/bitbucket.test.ts` — Token exchange, refresh, expiry, error handling
- `lib/bitbucket/stats.test.ts` — API fetch, normalization, error cases
- `lib/db/user-platforms.test.ts` — CRUD operations, token encryption/decryption
- `api/auth/bitbucket/connect/route.test.ts` — OAuth initiation, CSRF state
- `api/auth/bitbucket/callback/route.test.ts` — Token exchange, user creation, redirect
- `api/auth/bitbucket/disconnect/route.test.ts` — Unlinking, cache invalidation
- `api/auth/bitbucket/status/route.test.ts` — Feature flag gating, link status
- `components/UserMenu.test.tsx` — Bitbucket link/unlink UI integration
- `app/u/[handle]/page.test.ts` — Platform indicator rendering

**Graceful Degradation:** All existing degradation patterns verified. Bitbucket adds: feature flag disabled (menu item hidden), token refresh failure (auto-unlink + skip), API failure (GitHub-only badge still renders).

---

### 3. Security (security-reviewer) — YELLOW

**Dependency Audit:** 3 dev-only vulnerabilities. Zero production vulnerabilities.

**Hardcoded Secrets:** None. All test files use obvious fake values. `.env.example` has blank placeholders. `.env.local` is gitignored.

**OAuth Security (GitHub + Bitbucket):**
- Token storage: AES-256-GCM with random IV + auth tag (both GitHub session and Bitbucket platform tokens)
- CSRF: 16-byte random state with `timingSafeEqual`, 10-min expiry, cleared after use
- Callback: Rate-limited, redirect validated via `isSafeRedirect()`, `//` prefix blocked
- Session endpoint: Never returns OAuth token to client
- Bitbucket tokens: Encrypted at rest in Supabase via `encryptToken()`/`decryptToken()`
- Bitbucket token refresh: Automatic when expired, auto-unlink on refresh failure (token revoked)

**SVG XSS Prevention:** `escapeXml()` covers all 5 XML entities. Applied to all user-controlled text.

**Environment Variables:** No secrets leak to `NEXT_PUBLIC_*`. All env vars `.trim()`'d.

**Warning:** `renderMarkdown()` in admin panel uses `dangerouslySetInnerHTML` without sanitization library (e.g., DOMPurify). Risk is low because the admin panel is auth-gated and admin-handle restricted, but any stored XSS in agent report content could execute in admin context.

**CORS:** `Access-Control-Allow-Origin: *` only on public verification endpoint (read-only, rate-limited).

**RLS:** Enabled on all tables. Explicit deny-all policies for anon role.

**License Compliance:** No copyleft violations. MIT, Apache-2.0, BSD, ISC only (production deps).

---

### 4. Performance (performance-eng) — YELLOW

**Build:** Success. Next.js with Turbopack.

**Bundle Size:** All pages exceed 500KB First Load JS. Breakdown:
- Next.js runtime: ~469KB (framework baseline, unavoidable)
- core-js polyfills: ~110KB (loaded eagerly despite PostHog being lazy)
- App-specific code: minimal additional overhead

**Code Splitting:** Excellent.
- Effects library dynamically imported with `ssr: false`
- PostHog lazy-loaded on interaction/5s timeout
- Admin sub-dashboards code-split
- `canvas-confetti` async imported

**PostHog:** Properly deferred loading. However, core-js polyfills are loaded eagerly in the main bundle despite PostHog (the primary consumer) being lazy-loaded. This accounts for ~110KB of the baseline.

**Concerns:**
- No `<Suspense>` boundaries — share page blocks on 2 async calls
- `archetypeDemoData.ts` ships 12 large constants (not tree-shaken per-archetype)
- 579KB baseline is framework overhead — app code adds minimal additional weight

---

### 5. UX/Accessibility (ux-reviewer) — GREEN

**Heading Hierarchy:** Correct across all pages. Minor: admin dashboard has a double h1 issue.

**ARIA Labels & Roles:** 108 ARIA attributes across 31 components. Comprehensive coverage:
- Navigation: `aria-label="Main navigation"`
- Menus: Full `role="menu"` / `role="menuitem"` pattern
- Tabs (Admin): `role="tablist"` / `role="tab"` / `role="tabpanel"`
- Live regions: TerminalOutput, GeneratingProgress, ErrorBanner
- Tooltips: InfoTooltip with `aria-describedby`

**Focus Indicators:** Global `*:focus-visible` with amber outline. Skip-to-content link present.

**Reduced Motion:** Global `@media (prefers-reduced-motion: reduce)` disables all CSS animations (40+ files). AuthorTypewriter checks via JS.

**Alt Text:** All images have proper alt text.

**Keyboard Navigation:** No `onClick` on non-interactive elements without proper roles. Focus traps in MobileNav and ShortcutCheatSheet. Escape key handling on all overlays.

**Bitbucket UI Integration:** Inline SVG with `aria-hidden="true"` (decorative). Link/unlink actions use native interactive elements (`<a>`, `<button>`). Feature-flag gated — no UI when disabled.

**Contrast Concerns:**
- `text-terminal-dim` on `bg-bg` dark mode: 2.5:1 (decorative only, `aria-hidden`)
- `text-terminal-dim` on `bg-bg` light mode: 2.9:1 (decorative elements)

---

### 6. Infrastructure (devops) — YELLOW

**Production Build:** SUCCESS.

**CI Workflows:** All green on last 5 runs.

**Critical Issue:** 10 unpushed commits on `develop`. These contain the entire Bitbucket integration (Phases 1-5). CI has not run against this code yet. Must push and verify CI green before release.

**Undocumented Environment Variables:** 3 new Bitbucket env vars not yet in `CLAUDE.md`:
- `BITBUCKET_CLIENT_ID` — Bitbucket OAuth consumer key
- `BITBUCKET_CLIENT_SECRET` — Bitbucket OAuth consumer secret
- `NEXT_PUBLIC_BITBUCKET_ENABLED` — Feature flag for Bitbucket UI

**Health Endpoint:** Checks Redis + Supabase in parallel. Returns `"ok"` (200) or `"degraded"` (503).

**Error Pages:** `not-found.tsx`, `error.tsx`, `global-error.tsx` all present.

**Badge Headers:** Match spec exactly.

**Git State:** Working tree has untracked files (docs/plans, docs/research). No uncommitted changes to tracked files.

---

## Recommendation

**Ship to production after resolving conditions.** The codebase is well-tested (3,400 tests, +142 since v22), comprehensively secured, and architecturally clean. The Bitbucket integration follows existing patterns (feature-flagged, encrypted tokens, graceful degradation).

**Before release (must do):**
1. Push the 10 unpushed commits to `develop` and verify all 6 CI workflows pass
2. Add the 3 Bitbucket env vars to the `CLAUDE.md` Environment Variables section

**Post-release improvements (non-blocking):**
- Add `<Suspense>` boundaries to share page for streaming SSR (W17)
- Split `archetypeDemoData.ts` per-archetype for better tree-shaking (W18)
- Add DOMPurify to `renderMarkdown()` in admin panel (W9)
- Raise `text-terminal-dim` contrast to ~3.5:1 (W20)
- Add `aria-live` region to BadgeToolbar for status announcements (W22)
