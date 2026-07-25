```markdown
# Coverage Report
> Generated: 2026-07-23 | Health status: green

## Executive Summary
The suite is fully green — **8,529/8,529 tests pass across 499 files** with **96.78% statement / 92.87% branch / 95.74% function / 97.97% line** coverage overall. Every critical path (scoring, rendering, API, DB) sits at ≥96% statements; the only sub-80% files are known experiments/effects surfaces (Canvas/WebGL/JSDOM) that are accepted P3 carries.

## Coverage by Module
| Module | Coverage (stmt / br / fn / line) | Status |
|--------|----------------------------------|--------|
| `lib/impact` (scoring pipeline) | 99.6 / 98.7 / 100.0 / 99.5 | 🟢 |
| `lib/render` (SVG rendering) | 100.0 / 93.5 / 100.0 / 100.0 | 🟢 |
| `app/api` (API routes) | 97.4 / 94.3 / 95.6 / 97.7 | 🟢 |
| `lib/db` (database layer) | 97.2 / 94.5 / 100.0 / 100.0 | 🟢 |
| `lib/github` | 97.5 / 97.3 / 90.9 / 98.6 | 🟢 |
| `lib/cache` | 97.1 / 92.9 / 94.1 / 97.4 | 🟢 |
| `lib/auth` | 97.4 / 94.8 / 99.1 / 98.7 | 🟢 |
| `lib/gitlab` | 100.0 / 97.2 / 100.0 / 100.0 | 🟢 |
| `lib/history` | 98.4 / 96.6 / 100.0 / 99.1 | 🟢 |
| `lib/i18n` | 98.4 / 92.5 / 97.0 / 99.1 | 🟢 |
| `lib/dashboard` | 99.2 / 96.3 / 100.0 / 99.2 | 🟢 |
| `lib/monitoring` | 100.0 / 100.0 / 100.0 / 100.0 | 🟢 |
| `lib/profile` | 96.9 / 94.6 / 95.7 / 98.9 | 🟢 |
| `components` | 96.5 / 91.0 / 96.7 / 98.4 | 🟢 |
| `packages/shared` | 100.0 / 100.0 / 100.0 / 100.0 | 🟢 |
| **TOTAL** | **96.78 / 92.87 / 95.74 / 97.97** | 🟢 |

## Gaps & Recommendations
Only **4 files** fall below 80% statement coverage — all are non-critical experiment/effect surfaces (Canvas/WebGL/JSDOM limitations), unchanged accepted P3 carries with no impact on scoring, rendering, API, or DB paths:

- `apps/web/lib/effects/interactions/HolographicOverlay.tsx` — **50.0% stmts / 86.7 br / 75.0 fn** (WebGL/pointer-interaction surface, hard to exercise in JSDOM).
- `apps/web/app/experiments/heatmap-wave/page.tsx` — **73.3% stmts / 50.0 br / 60.0 fn** (Canvas-animation experiment page).
- `apps/web/app/experiments/glassmorphism/page.tsx` — **70.6% stmts / 75.0 br / 75.0 fn** (experiment page, feature-flag gated).
- `apps/web/app/experiments/metallic-shimmer/page.tsx` — **78.1% stmts / 42.9 br / 85.7 fn** (shimmer-effect experiment page).

Untested files (no sibling `.test.ts`) in critical dirs — all **covered indirectly** at ≥98% via the campaigns suites; this is a file-placement convention gap, not a coverage risk:
- `apps/web/lib/db/campaigns/crud.ts`, `apps/web/lib/db/campaigns/sends.ts` — exercised through the broader campaigns test suites (no co-located sibling test).
- `apps/web/lib/db/campaigns/index.ts` — re-export barrel, excluded from coverage by config.

Recommendation: no P1/P2 action required. Optionally add co-located sibling tests for `campaigns/crud.ts` and `campaigns/sends.ts` to satisfy the co-location convention, and consider light JSDOM smoke tests for the experiment pages if they graduate out of the feature-flag gate.

## Flaky Tests
None detected

<!-- SHARED_CONTEXT ENTRY (append to docs/agents/shared-context.md)
## Coverage Agent — 2026-07-23
- **Status**: GREEN
- Overall coverage: 96.78% stmts / 92.87% br / 95.74% fn / 97.97% lines; 8,529/8,529 tests across 499 files, single clean run (~60s, --maxWorkers=3)
- Critical gaps: none — lib/impact 99.6, lib/render 100, app/api 97.4, lib/db 97.2 stmts. lib/gitlab now 100% (was 75.2% br). Only 4 sub-80% files, all accepted-P3 experiments/effects (HolographicOverlay 50%, heatmap-wave 73.3%, glassmorphism 70.6%, metallic-shimmer 78.1%).
- Flaky tests: 0

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps — lib/auth 97.4, lib/render 100 stmts (all escapeXml paths), lib/github 97.5. Nothing new.
- [QA]: 0 flakes; suite stable at 8,529/8,529. `lib/db/campaigns/{crud,sends}.ts` lack sibling tests but are ≥98% covered via campaigns suites — file-placement convention gap only, not a quality risk.
-->
```
