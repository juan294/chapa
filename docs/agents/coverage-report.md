# Coverage Report
> Generated: 2026-05-02 | Health status: green

## Executive Summary
Overall coverage at **93.31% statements / 90.55% functions / 89.79% branches / 94.36% lines** across 7,331 tests in 419 files (+37 tests vs 2026-05-01). Every critical-path module sits above 97%, and the only sub-80% files are framework shells, static icon assets, or Canvas/WebGL effects with accepted JSDOM limits. One intermittent flake (`BadgeToolbar > strips @keyframes`) reproduced once across three full runs — same fingerprint as Apr 30; recurrence confirmed.

## Coverage by Module
| Module | Stmts | Funcs | Status |
|--------|------:|------:|--------|
| `lib/impact/` (scoring pipeline) | 99.59% | 100.00% | GREEN |
| `lib/render/` (SVG rendering) | 100.00% | 100.00% | GREEN |
| `lib/db/` (database layer) | 97.07% | 100.00% | GREEN |
| `lib/cache/` | 99.48% | 98.67% | GREEN |
| `lib/auth/` | 98.67% | 99.22% | GREEN |
| `lib/github/` | 97.78% | 96.43% | GREEN |
| `lib/bitbucket/` | 99.17% | 98.33% | GREEN |
| `lib/codeberg/` | 99.20% | 98.18% | GREEN |
| `lib/email/` | 98.12% | 100.00% | GREEN |
| `lib/analytics/` | 98.46% | 100.00% | GREEN |
| `lib/history/` | 99.11% | 100.00% | GREEN |
| `lib/profile/` | 100.00% | 100.00% | GREEN |
| `lib/insights/` | 100.00% | 100.00% | GREEN |
| `lib/async/` | 100.00% | 100.00% | GREEN |
| `lib/log/` | 100.00% | 100.00% | GREEN |
| `lib/env/` | 100.00% | 100.00% | GREEN |
| `app/api/` (API routes) | 98.60% | 99.26% | GREEN |
| `components/` | 92.73% | 92.58% | GREEN |
| **TOTAL** | **93.31%** | **90.55%** | **GREEN** |

## Gaps & Recommendations

All critical-path gaps from prior cycles are closed (`og-image/route.ts`, `dirty-stats.ts`, `SharePageOwnerContent.tsx` all 100%). Remaining sub-80% files are accepted P3 carries — none are critical paths:

- `lib/effects/interactions/HolographicOverlay.tsx` — 50.0% stmts / 75.0% funcs. **Accepted (P3)** — Canvas/WebGL not exercisable in JSDOM.
- `lib/effects/backgrounds/ParticleBackground.tsx` — 90.3% stmts / 77.8% funcs / 72.2% br. **Accepted (P3)** — Canvas.
- `components/SharePageOwnerContentLazy.tsx` — 33.3% stmts / 0.0% funcs. Dynamic-import shim that re-exports the lazy bundle; underlying component is fully covered. **Accepted** — no logic to test.
- `app/layout.tsx`, `app/admin/page.tsx`, `app/studio/page.tsx`, `app/cli/authorize/error.tsx`, `app/apple-icon.tsx`, `app/icon.tsx` — 0.0% stmts. Next.js framework shells / static icon generators. **Accepted** — exercised via E2E; no in-process unit value.
- `components/ClientAnalytics.tsx`, `components/ClientInstrumentation.tsx` — 0.0% stmts. Bootstrap-only components mounted by `app/layout.tsx`. **Accepted**.

Optional polish: `lib/env.ts` branches at 87.5% — one untested ternary in env-coercion. A single test would push branches over 90%.

## Flaky Tests

- **`apps/web/components/BadgeToolbar.render.test.tsx > BadgeToolbar render > download strips SVG animations > strips @keyframes, animation properties, and SMIL animate elements`** — failed 1/3 full-suite runs (run #3 only). Failure: `expected '<svg></svg>' to contain 'opacity="1"'` at line 1014. The DOM serialized as an empty SVG, suggesting the `URL.createObjectURL` / `Image` stub interaction races with the assertion when other tests share the worker. The Apr 30 triage fix (removing manual `vi.stubGlobal` restores) did not fully resolve it — flake has now recurred. Recommend reopening with a deterministic synchronous `Image.onload` stub instead of relying on `vi.unstubAllGlobals()` ordering. **Confirmed recurrent (2 of last 3 cycles).**

```
SHARED_CONTEXT_START
## Coverage Agent — 2026-05-02
- **Status**: GREEN
- Overall coverage: 93.31% stmts / 90.55% funcs / 89.79% br / 94.36% lines (7,331 tests / 419 files / +37 tests)
- Critical gaps: NONE — every critical-path module ≥97% (lib/impact 99.59%, lib/render 100%, lib/db 97.07%, app/api 98.60%, lib/auth 98.67%, lib/cache 99.48%)
- Flaky tests: 1 — BadgeToolbar > strips @keyframes (1/3 runs; Apr 30 triage fix did not fully hold)

**Cross-agent recommendations:**
- [Security]: lib/analytics 98.46% / lib/auth 98.67% — SENSITIVE_PATTERNS scrubbing and OAuth paths well covered. No security-relevant test gaps.
- [QA]: BadgeToolbar @keyframes flake recurred after Apr 30 fix. Recommend reopening with a deterministic Image.onload stub instead of relying on vi.unstubAllGlobals() ordering. The other 7,331/7,331 ran clean across 2 of 3 full-suite runs.
SHARED_CONTEXT_END
```
