# Pre-Launch Audit Report
> Generated on 2026-04-03 | Branch: `develop` | 6 parallel specialists
> 6,915 tests | 388 test files | Next.js 16.2.2 (Turbopack)

## Verdict: NOT READY

Two WCAG 2.1 AA violations (B1, B2 from ux-reviewer) are confirmed blockers. All other domains are green or conditional with no hard blockers.

---

## Blockers (must fix before release)

| # | Issue | Severity | Found by | File | Fix |
|---|-------|----------|----------|------|-----|
| B1 | `div[role="button"]` for expand/collapse toggle — must be native `<button>` | WCAG 4.1.2 AA | ux-reviewer | `DimensionCard.tsx:222` | Replace `<div role="button" tabIndex={0}>` with `<button>`, keep `aria-expanded`/`aria-controls` |
| B2 | `role="progressbar"` elements missing `aria-label` — screen readers announce "progress bar 72%" with no context | WCAG 4.1.2 AA | ux-reviewer | `ImpactBreakdown.tsx:272`, `DimensionCard.tsx:189`, `SubMetricPanel.tsx:295` | Add `aria-label="Delivery score"` (etc.) to each element with `role="progressbar"`; move `aria-label` from inner fill div to the container |

---

## Warnings

| # | Issue | Severity | Found by | Risk |
|---|-------|----------|----------|------|
| W1 | Stale worktree at `../chapa-architectural-strip` (branch `feature/architectural-strip`) | Medium | devops | Open branch/worktree; clean up or merge |
| W2 | `ADMIN_SECRET` fail-open — when env var is unset, `/api/admin/stats` and `/api/admin/bulk-recalculate` pass-through unauthenticated | Medium | security | Accidental env var omission exposes admin endpoints |
| W3 | 4 stale Dependabot remote branches targeting `main` instead of `develop` | Medium | devops | Direct `main` merges bypass release flow |
| W4 | Heatmap dots (`DotTimeline`) are mouse-only — no keyboard/focus access to tooltip data | Medium | ux-reviewer | `ActivityHeatmap.tsx:509` |
| W5 | `BadgeOverlay` desktop tooltip may not be announced by screen readers — `aria-describedby` conditionally points to a possibly non-rendered panel | Medium | ux-reviewer | `BadgeOverlay.tsx:343` |
| W6 | `aria-label` on wrong element in `ImpactBreakdown` progress bar — placed on inner fill `div`, not the `role="progressbar"` container | Medium | ux-reviewer | `ImpactBreakdown.tsx:277` (part of B2) |
| W7 | LGPL-3.0 dependency `@img/sharp-libvips-darwin-arm64` (via `sharp`) not documented in `docs/accepted-risks.md` — conflicts with project's stated "MIT/Apache/BSD/ISC only" policy | Low | security | Policy inconsistency |
| W8 | `escapeHtml` imported from `@/lib/email/resend` in unsubscribe route instead of canonical `@/lib/utils/escape` — indirect re-export | Low | architect | Fragile indirection; breaks silently if `resend.ts` stops re-exporting |
| W9 | `claude-review.yml` uses `claude-sonnet-4-5-20250929`; current model is `claude-sonnet-4-6` | Low | devops | Review bot runs older model |
| W10 | `GlobalCommandBar` on `/admin` is a static import; all other pages use `GlobalCommandBarLazy` | Low | performance-eng | Minor bundle inconsistency on internal-only page |
| W11 | CSP `img-src` allows `https://i.ytimg.com` — mild over-permission if YouTube thumbnails no longer used | Low | security | Unnecessary allowance |
| W12 | `HeatmapGrid.tsx` has no component render test — only pure-function tests in a `.ts` file | Low | qa-lead | Mouse/hover/tooltip interaction paths untested |
| W13 | `noUnusedLocals` / `noUnusedParameters` not set in any tsconfig (not covered by `strict: true`) | Low | architect | Dead code not caught by tsc |
| W14 | `DimensionCard` expand toggle missing a descriptive `aria-label` (reads inner text instead of action) | Low | ux-reviewer | `DimensionCard.tsx:222` |
| W15 | `focusable="true"` is a non-standard attribute on SVG `<polygon>` — has no effect | Low | ux-reviewer | `RadarChartInteractive.tsx:371` |
| W16 | `RadarChartInteractive` SVG text hardcodes font family string instead of CSS custom property | Low | ux-reviewer | `RadarChartInteractive.tsx:324` |
| W17 | StreakCard activity dots have no accessible description | Low | ux-reviewer | `ActivityHeatmap.tsx:251` |

---

## Detailed Findings

### 1. Quality Assurance (qa-lead) — GREEN

**6,915 tests | 388 test files | 0 failures | 0 type errors | 0 lint errors**

- All 44 API route test files confirmed present
- Critical paths tested: scoring pipeline, SVG rendering, OAuth, badge route
- Graceful degradation confirmed: Redis fail-open, Supabase null-return, GitHub rate-limit fallback SVG

**Warnings only:**
- `HeatmapGrid.tsx` has pure-function tests but no component render test (W12)
- `pipeline.test.ts` / `non-accusatory-messaging.test.ts` naming is unconventional (no matching source file) — low risk

---

### 2. Security (security-reviewer) — CONDITIONAL

**No CVEs. No hardcoded secrets. Strong auth and SVG XSS protection.**

Fully green: OAuth (AES-256-GCM session token, CSRF state, timing-safe compares), SVG XSS (`escapeXml` on all user inputs before SVG interpolation), CORS (wildcard only on public read-only routes), cache key injection (handle validated + lowercased), SSRF (avatar host allowlist + 5s timeout), webhook HMAC (Svix), SQL injection (ORM-only, no raw SQL), security headers (HSTS 2yr, CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy).

**Warnings:**
- `ADMIN_SECRET` fail-open when env var is absent (W2) — medium risk
- LGPL dependency not documented in accepted-risks.md (W7) — low risk
- CSP allows `i.ytimg.com` in `img-src` (W11) — low risk

---

### 3. Infrastructure (devops) — CONDITIONAL

**CI green on develop. Build succeeds. Error pages exist. Health endpoint correct. Badge headers correct.**

Confirmed green: last 5 CI runs all pass (Secret Scanning, Security Scan, Dead Code Detection, Bundle Size Analysis, CI all ✓), `not-found.tsx` and `error.tsx` exist, `/api/health` checks Redis + Supabase and returns 503 on degraded, badge `Cache-Control: public, s-maxage=21600, stale-while-revalidate=86400` matches spec, badge `frame-ancestors *` + `X-Frame-Options: ALLOWALL` correct for embeddable SVG, HSTS `max-age=63072000; includeSubDomains; preload` configured, 3 Vercel crons defined.

**Warnings:**
- Stale worktree `../chapa-architectural-strip` on branch `feature/architectural-strip` (W1)
- 4 Dependabot branches targeting `main` instead of `develop` (W3)
- `claude-review.yml` references outdated model (W9)

---

### 4. Architecture (architect) — GREEN

**0 type errors. 0 circular dependencies (719 files scanned). 0 CVEs.**

`strict: true` + `noUncheckedIndexedAccess: true` on all packages. Clean module boundaries (impact, github, cache, render, db, auth, email). `clampScore`/`normalize` centralized. `escapeXml` (SVG) and `escapeHtml` (HTML/email) correctly separate with rationale documented. React 19.2.4 + Next.js 16.2.2 within declared peer dependency ranges.

**Warnings:**
- TS 6.0.2 and ESLint 10.1.0 major upgrades available — deferred per existing ADR
- Minor patch updates available: `@types/node`, `posthog-js`, `@playwright/test`, `@supabase/supabase-js`, `resend`, `svix`
- `escapeHtml` indirect re-export in unsubscribe route (W8)
- `noUnusedLocals`/`noUnusedParameters` not set (W13)

Knip false positives: `producthunt/*.mjs` (orphaned launch scripts, harmless), `.next/types/validator.ts` (build artifact), IDE/agent skill assets.

---

### 5. Performance (performance-eng) — GREEN

**All routes well under 500KB threshold. Build clean.**

| Route | First Load JS (uncompressed) |
|-------|------------------------------|
| `/u/[handle]` | 236 KB |
| `/studio` | 216 KB |
| `/admin` | 200 KB |
| `/` (landing) | 180 KB |
| `/about` | 179 KB |
| Other routes | 113–174 KB |

No heavy client libraries (no lodash, moment, recharts, d3, framer-motion). Supabase and Resend never reach client bundles. Server secrets absent from all 68 client JS chunks. `canvas-confetti` correctly lazy-loaded. 8 heavy effect components use `next/dynamic` with `ssr: false`.

**Warnings:**
- Turbopack NFT warning on `svg-to-png.ts` → OG image route (build succeeds, Turbopack 16.x bug, low risk)
- `GlobalCommandBar` statically imported on `/admin` — inconsistent with lazy pattern elsewhere (W10)
- PostHog 169KB uncompressed in shared bundle; deferred-interaction load mitigates TTI impact

---

### 6. UX/Accessibility (ux-reviewer) — RED (2 blockers)

**2 WCAG 2.1 AA blockers. 8 warnings.**

Confirmed green: skip link (correct), `prefers-reduced-motion` (global + per-component — thorough), focus ring (`2px solid var(--color-amber)` on `:focus-visible`), ARIA live regions (toast, alert, terminal, copy button — all correct), icon-only button labels throughout, modal/dialog implementations (native `<dialog>`, focus traps in `ShortcutCheatSheet` and `MobileNav`).

**Blockers (B1, B2):** See top of report.

**Notable warnings:**
- Heatmap dots mouse-only — no keyboard/focus access (W4)
- `BadgeOverlay` tooltip may not be announced on desktop by screen readers (W5)
- `aria-label` misplaced on progress bar fill div (W6 — part of B2)
- `focusable="true"` non-standard SVG attribute (W15)
- Hardcoded font family in SVG text (W16)

---

## Action Plan

### Fix immediately (blockers → unblock release)
1. **B1** `DimensionCard.tsx:222` — replace `<div role="button">` with `<button>`; keep `aria-expanded`, `aria-controls`, `aria-label`
2. **B2** `ImpactBreakdown.tsx:272`, `DimensionCard.tsx:189`, `SubMetricPanel.tsx:295` — add `aria-label="X score"` to each `role="progressbar"` container; remove misplaced label from inner fill divs

### Fix before release (medium warnings)
3. **W2** `verifyAdminSecret()` — return 401/503 when `ADMIN_SECRET` is unset instead of pass-through
4. **W1** Remove stale worktree `../chapa-architectural-strip` and delete branch
5. **W3** Close 4 Dependabot PRs targeting `main`; open replacements targeting `develop` as needed

### Low priority (post-release backlog)
6. **W7** Add `@img/sharp-libvips-darwin-arm64` LGPL to `docs/accepted-risks.md`
7. **W8** Fix `escapeHtml` import in unsubscribe route → import from `@/lib/utils/escape` directly
8. **W9** Update `claude-review.yml` model to `claude-sonnet-4-6`
9. **W10** Lazy-load `GlobalCommandBar` on `/admin`
10. **W12** Add render test for `HeatmapGrid.tsx` (rename to `.test.tsx`, add jsdom render + hover test)
11. **W13** Add `noUnusedLocals`/`noUnusedParameters` to tsconfig files
12. **W14** Add descriptive `aria-label` to `DimensionCard` expand toggle
13. **W15** Remove `focusable="true"` from SVG polygon in `RadarChartInteractive.tsx`
14. **W16** Replace hardcoded font family with CSS custom property in `RadarChartInteractive.tsx`
15. **W17** Add accessible description to StreakCard activity dots
