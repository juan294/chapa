# Coverage Report
> Generated: 2026-04-30 | Health status: green

## Executive Summary

All 409 test files and 7,272 tests pass across three independent runs. Overall statement coverage holds at 93.31% with all critical paths in the green tier. The sole actionable critical-path gap — `og-image/route.ts` function coverage at 60% — enters its **6th carry cycle** and must be addressed this triage.

## Coverage by Module

| Module | Stmts | Branches | Funcs | Status |
|--------|-------|----------|-------|--------|
| lib/impact | 99.59% | 98.67% | 100% | ✅ |
| lib/render | 100% | 92.86% | 100% | ✅ |
| lib/log | 100% | 100% | 100% | ✅ |
| lib/profile | 100% | 92.73% | 100% | ✅ |
| lib/history | 98.26% | 96.55% | 100% | ✅ |
| lib/auth | 98.00% | 96.12% | 98.85% | ✅ |
| lib/codeberg | 98.03% | 94.52% | 96.30% | ✅ |
| lib/email | 97.57% | 94.74% | 100% | ✅ |
| lib/cache | 97.50% | 95.16% | 93.55% | ✅ |
| lib/bitbucket | 97.70% | 93.10% | 96.43% | ✅ |
| lib/github | 97.35% | 96.64% | 93.10% | ✅ |
| lib/analytics | 97.30% | 89.47% | 100% | ✅ |
| app/api | 97.38% | 94.08% | 97.50% | ✅ |
| lib/db | 96.48% | 93.32% | 100% | ✅ |
| lib/env *(new)* | 100% | 87.50% | 100% | ✅ |

**Overall: 93.31% stmts (8307/8902) | 89.88% branches | 90.70% funcs | 94.37% lines**

Delta vs 2026-04-29: stmts +0.02pp, funcs +0.18pp, branches −0.05pp (from new `lib/env.ts` uncovered ternary branch — minor).

## Gaps & Recommendations

### P2 — Critical (6th carry cycle, MUST fix this triage)

- **`apps/web/app/u/[handle]/og-image/route.ts`** — 94.3% stmts / 60% funcs
  - Lines 77 and 97 remain untested: avatar-fetch failure path and missing-avatar SVG fallback.
  - Fix: mock `fetch()` to reject (simulates avatar timeout) and stub the fallback SVG branch.
  - This is the only actionable critical-path gap. Six cycles without resolution is unacceptable.

### P2 — Small (straightforward, one-test fixes)

- **`apps/web/lib/cache/dirty-stats.ts`** — 83.3% stmts / 75% funcs
  - One function at line 33 (the clear-dirty-marker path) is untested. Tiny file, one test closes it.

- **`apps/web/components/SharePageOwnerContent.tsx`** — 90.5% stmts / 75% funcs
  - One function branch still uncovered. Branch coverage is now 100%, so this is a handler path.

### P3 — Accepted (no action needed)

- `apps/web/app/experiments/**` — 47–87% stmts — Canvas/WebGL components blocked by JSDOM. Accepted.
- `apps/web/components/AuthorTypewriter.tsx` — 86.7% stmts / 67.5% branches — JSDOM timer limitations. Accepted.
- `apps/web/lib/effects/interactions/HolographicOverlay.tsx` — 50% stmts — Canvas API. Accepted.
- `apps/web/lib/effects/backgrounds/ParticleBackground.tsx` — 90.3% stmts / 72.2% branches — Canvas. Accepted.
- `apps/web/lib/render/archetypeDemoData.ts` + `demoData.ts` — 50% branches — TypeScript overload signatures, not runtime branches. Accepted.
- `apps/web/lib/env.ts` — 87.5% branches (7/8) — one uncovered ternary/null-coalesce in env getter. 100% stmts and funcs. Accepted.
- `apps/web/lib/auth/github-session-token.ts` + `lib/http/client-ip.ts` — 75% branches (null-check ternaries). Accepted.

### Untested files (no sibling `.test.ts`)

Only configuration and framework shells — all have zero testable logic:

- `apps/web/app/api/auth/bitbucket/config.ts` — pure OAuth config, exercised transitively via route tests
- `apps/web/app/api/auth/codeberg/config.ts` — same
- `apps/web/app/admin/page.tsx`, `apps/web/app/studio/page.tsx` — React Server Component shells (no logic)
- `apps/web/app/layout.tsx` — Next.js layout wrapper (no logic)
- `apps/web/components/ClientAnalytics.tsx`, `ClientInstrumentation.tsx` — third-party init wrappers (no logic)
- `apps/web/app/apple-icon.tsx`, `apps/web/app/icon.tsx` — static SVG assets (no logic)

## Flaky Tests

**Intermittent — monitor:** `BadgeToolbar render > download strips SVG animations > strips @keyframes, animation properties, and SMIL animate elements`

Appeared once in 4 runs (run 2 verbose output). Runs 1, 3, 4 and a targeted isolated run (47/47) all passed. This flake was previously resolved in the Apr 26 triage (removal of redundant `vi.stubGlobal` restore calls), but it reappeared intermittently. Low confidence in recurrence — confirm over next 2 cycles before taking action.
