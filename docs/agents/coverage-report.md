# Coverage Report
> Generated: 2026-04-22 | Health status: **green**

## Executive Summary

Overall coverage holds at **93.09% statements / 89.56% branches / 89.89% functions / 94.14% lines** across 396 test files and 7,048 tests. All critical-path modules (impact, render, profile, cache, db, auth, github, history, email, api) remain ≥97% statement coverage. Yesterday's flaky `BadgeToolbar @keyframes` test passed cleanly in 3/3 runs this cycle — likely a transient environment blip rather than a stable regression; keep monitoring one more cycle before closing.

## Coverage by Module

| Module | Stmt | Br | Fn | Status |
|--------|------|------|------|--------|
| lib/impact | 100.00% | 98.58% | 100.00% | GREEN |
| lib/render | 100.00% | 93.75% | 100.00% | GREEN |
| lib/profile | 100.00% | 91.67% | 100.00% | GREEN |
| lib/cache | 99.23% | 98.00% | 95.65% | GREEN |
| lib/history | 98.23% | 96.55% | 100.00% | GREEN |
| lib/email | 97.92% | 96.69% | 100.00% | GREEN |
| lib/auth | 97.73% | 95.74% | 100.00% | GREEN |
| lib/db | 97.60% | 95.26% | 100.00% | GREEN |
| lib/other | 97.52% | 93.01% | 97.52% | GREEN |
| app/api | 97.51% | 94.65% | 94.78% | GREEN |
| lib/github | 96.97% | 92.55% | 96.43% | GREEN |
| components | 95.46% | 89.39% | 93.95% | GREEN |
| app/pages | 94.90% | 90.40% | 93.32% | GREEN |
| packages/shared | 90.57% | 100.00% | 100.00% | GREEN |
| lib/analytics | 84.09% | 71.43% | 87.50% | YELLOW |
| app/experiments | 56.68% | 51.22% | 52.56% | YELLOW (accepted — Canvas/WebGL) |

## Gaps & Recommendations

**P2 — security-relevant branch coverage (carried from prior cycles):**
- `apps/web/lib/analytics/server-errors.ts` — 71.43% module-level branches. The nine `SENSITIVE_PATTERNS` token-redaction branches remain untested. These run before PostHog ingestion and are high-priority security guards. Add targeted tests that feed each pattern type (OAuth tokens, Bearer, API keys, secrets, passwords, cookies, emails, IPv4, custom env) through `captureServerError()` and assert the redacted output.

**P2 — owner-only UI handlers untested (carried):**
- `apps/web/components/SharePageOwnerContent.tsx` — 59.1% stmts, 50% funcs. Embed-copy and refresh CTA interactive handlers have no coverage. Add render + click tests that exercise the owner-gated branch.

**P3 — accepted coverage gaps (no action planned):**
- `apps/web/app/experiments/**` — Canvas/WebGL pages (holographic, confetti, 3d-tilt, metallic-shimmer, number-counters, tier-visuals, heatmap-wave, particles). JSDOM cannot exercise these paths. Documented accepted risk.
- `apps/web/lib/effects/interactions/HolographicOverlay.tsx` — 50% stmts, Canvas-bound.
- `apps/web/components/ShareBadgePreviewLazy.tsx`, `GlobalCommandBarLazy.tsx` — 50% / 60% stmts, `next/dynamic` factory wrappers with no meaningful assertion surface.
- `apps/web/app/apple-icon.tsx`, `icon.tsx`, `layout.tsx`, `admin/page.tsx`, `studio/page.tsx`, `components/ClientAnalytics.tsx` — framework entrypoints / zero-logic shells.

**Untested source files (all legitimate):**
- `types.ts` files across `lib/verification`, `lib/history`, `lib/codeberg`, `lib/bitbucket` (no runtime logic).
- `lib/test-helpers/*` (support utilities, exercised by consumers).
- `app/api/auth/{codeberg,bitbucket}/config.ts` (static config).
- `lib/auth/unsubscribe-token.ts` (covered indirectly via email route tests; 75% branch coverage carried).

## Flaky Tests

**None detected in this run.** 3/3 passes at 7048/7048 tests. Yesterday's `BadgeToolbar.render.test.tsx > strips @keyframes...` failure did not reproduce. Recommendation to QA stands: wrap the `Image` global stub setup/restore in try/finally so `unstubAllGlobals` always fires even if `waitFor` throws — a cheap robustness improvement before the next regression.
