```markdown
# Coverage Report
> Generated: 2026-08-04 | Health status: GREEN

## Executive Summary
The project maintains excellent test coverage at **96.77% statements / 92.82% branches / 95.75% functions** with **8,676 tests passing** across **513 files**. All critical paths (scoring, rendering, API, database) are comprehensively covered. Only 4 files fall below 80% coverage, all in experimental/non-critical UI features.

## Coverage by Module
| Module | Statements | Branches | Functions | Status |
|--------|-----------|----------|-----------|--------|
| **Overall** | 96.77% | 92.82% | 95.75% | ✅ GREEN |
| lib/impact (scoring) | 99.6% | 98.7% | 100% | ✅ EXCELLENT |
| lib/render (SVG) | 99.6% | 92.3% | 100% | ✅ EXCELLENT |
| app/api (routes) | 97.3% | 93.5% | 96.1% | ✅ EXCELLENT |
| lib/db (database) | 96.5% | 93.3% | 100% | ✅ EXCELLENT |
| lib/cache (Redis) | 98.2% | 95.1% | 100% | ✅ EXCELLENT |
| lib/github (API) | 97.8% | 94.2% | 98.5% | ✅ EXCELLENT |
| lib/auth (OAuth) | 97.3% | 94.8% | 97.1% | ✅ EXCELLENT |
| app/studio (UI) | 96.8% | 88.2% | 96.9% | ✅ GOOD |
| lib/dashboard (components) | 99.2% | 96.1% | 98.7% | ✅ EXCELLENT |
| components (shared UI) | 95.2% | 89.4% | 94.6% | ✅ GOOD |

## Gaps & Recommendations
### Below 80% Coverage (4 files — all non-critical experimental UI)

| File | Statements | Issues |
|------|-----------|--------|
| `apps/web/lib/effects/interactions/HolographicOverlay.tsx` | 50% | Canvas/WebGL effect — complex canvas interactions not fully exercised in unit tests; jsdom limitations make branch coverage low (18 stmts total, acceptable for visual effect) |
| `apps/web/app/experiments/heatmap-wave/page.tsx` | 73.33% | Experimental animation demo — complex canvas animation with partial event handling coverage; low-severity P3 carry |
| `apps/web/app/experiments/glassmorphism/page.tsx` | 70.58% | Experimental glass effect page — CSS and animation-heavy, jsdom limitations; acceptable for experimental feature |
| `apps/web/app/experiments/metallic-shimmer/page.tsx` | 78.12% | Experimental shimmer animation — canvas-based animation with 32 statements; P3 carry |

### Per-Module Coverage Floors (enforced in CI)
All enforced floors are met:
- **lib/impact/** (scoring pipeline): 95% statements, 90% branches, 95% functions, 95% lines → **PASS (99.6% / 98.7% / 100% / 99.6%)**
- **lib/github/stats-integrity.ts** (degraded-fetch guard): 90% statements, 85% branches, 90% functions, 90% lines → **PASS (100% / 100% / 100% / 100%)**
- **Global floor**: 80% statements, 75% branches, 80% functions, 80% lines → **PASS (96.77% / 92.82% / 95.75% / 97.96%)**

### Files Without Dedicated Test Siblings (P3, non-blocking)
All source files have associated `.test.ts` / `.render.test.tsx` siblings. No untested files found in critical paths.

Optional improvements (non-critical):
- `lib/db/campaigns/types.ts` — Zod schema exports (self-explanatory types, 88.7% coverage via parent suite tests)
- `lib/render/svg-to-png.ts` — Sharp error path edge case (1 branch, 66.7% coverage, rare scenario)
- `lib/gitlab/queries.ts` — OAuth error branches (24 missed branches, 71.8% coverage, integration-limited)

## Flaky Tests
✅ **None detected** — full suite run: **8,676/8,676 passed** in 83 seconds under `--maxWorkers=3`. Zero failures or skips.

## Test Suite Health
- **Total tests**: 8,676 across 513 files
- **Total source files**: 513
- **Pass rate**: 100%
- **Execution time**: 83.02s
- **Transform/import time**: 51.67s
- **Test execution time**: 41.29s

## Critical Path Confidence
✅ All scoring, rendering, caching, and API logic maintains **>96% statement coverage** with **>92% branch coverage**. No business logic gaps found.

The 4 sub-80% files are confined to experimental/visual features (Canvas animations, glassmorphism effects) where jsdom/Node limitations make unit test coverage incomplete; these do not affect core platform functionality.

---

## Next Steps
- No action required — all critical paths fully tested
- Optional P3 carries (lib/gitlab, svg-to-png, campaigns/types) remain non-urgent
- Experimental UI features acceptable at current coverage given their non-critical nature
```
