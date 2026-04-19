# Coverage Report
> Generated: 2026-04-19 | Health status: yellow

## Executive Summary
Suite stable at 394 files / 6894 tests with 93% statement coverage and zero flaky tests across 3 runs. Overall health is YELLOW due to the experiments module (Canvas/WebGL, accepted) and a carried P2 gap in `warm-cache/route.ts` (62.5% funcs); all critical scoring, rendering, and API paths remain GREEN.

## Coverage by Module
| Module | Stmts | Branches | Funcs | Lines | Status |
|--------|-------|----------|-------|-------|--------|
| lib/impact | 100% | 97.2% | 100% | 100% | GREEN |
| lib/render | 100% | 89.8% | 100% | 100% | GREEN |
| lib/db | 97.5% | 94.2% | 100% | 99.8% | GREEN |
| lib/cache | 99.6% | 99.2% | 97.6% | 100% | GREEN |
| lib/auth | 98.8% | 97.6% | 100% | 99.4% | GREEN |
| lib/github | 97.6% | 95.8% | 97.9% | 99.1% | GREEN |
| lib/history | 99.1% | 97.5% | 100% | 99.6% | GREEN |
| lib/email | 97.9% | 97.4% | 100% | 98.2% | GREEN |
| app/api | 98.9% | 98.7% | 96.2% | 98.9% | GREEN |
| app/api/admin | 97.7% | 95.2% | 98.1% | 97.8% | GREEN |
| app/api/cron | 93.9% | 89.1% | 85.1% | 94.1% | YELLOW |
| components | 94.2% | 93.8% | 93.3% | 95.7% | GREEN |
| packages/shared | 81.8% | 100% | 100% | 81.8% | GREEN* |
| experiments | 58.6% | 64.3% | 51.5% | 61.6% | RED (accepted) |
| **TOTAL** | **93%** | **89.47%** | **89.64%** | **94.06%** | **YELLOW** |

*`packages/shared` low stmts from `package.json`/`tsconfig.json` included in v8 scan — all functional code is 100%.

## Gaps & Recommendations

### P2 — Actionable

- **`app/api/cron/warm-cache/route.ts`** — 62.5% funcs, 75% branches (CARRIED from 2026-04-18)
  - 3 uncovered arrow functions: `.map((h) => h.trim())` and `.filter(...)` inside `parsePriorityHandles`, and the `.catch(() => {})` on `getAvatarBase64`
  - Missing branch: wrap-around rotation path (when `offset + MAX_HANDLES > allHandles.length`)
  - Fix: add test with `WARM_CACHE_PRIORITY_HANDLES` env var set + rotation offset near the end of the user list + `getAvatarBase64` rejection

- **`lib/profile/public-profile.ts`** — 68.75% branches, 83.33% funcs (NEW)
  - `runPublicProfileSideEffects` missing branches: no-displayName/avatarUrl case (skips `dbUpsertUser`), `inserted = false` path (skips `updateSnapshotCache`)
  - 1 function uncovered (likely the `.catch(() => {})` handler on `dbUpsertUser`)
  - Fix: add tests for the falsy-displayName/avatarUrl variant and the `dbInsertSnapshot` returning false path

- **`components/UserMenu.tsx`** — 80% funcs (CARRIED, now exactly at threshold)
  - `handleInsightsFile` complex file-upload branch still not exercised
  - Risk: low — UI-only handler, not a critical path

### P3 — Accepted

- **experiments/\*** — 58.6% aggregate (Canvas/WebGL, JSDOM limitation — accepted)
- **`HolographicOverlay.tsx`** — 50% stmts (Canvas API, JSDOM limitation — accepted)
- **`ParticleBackground.tsx`** — 72.2% branches (Canvas/RAF, JSDOM limitation — accepted)
- **`AuthorTypewriter.tsx`** — 67.5% branches (JSDOM timing, accepted)
- **`lib/render/archetypeDemoData.ts`, `demoData.ts`** — 50% branches (lookup-only data tables, no logic — accepted)
- **`app/api/refresh/route.ts`, `app/api/recalculate/route.ts`** — 33–50% funcs (fire-and-forget `after()` callbacks registered but not called in test context — accepted)
- **`app/u/[handle]/og-image/route.ts`** — 50% funcs (OG image error path — low risk)
- **`ShareBadgePreviewLazy.tsx`, `GlobalCommandBarLazy.tsx`** — 25–33% funcs (lazy wrappers — accepted)

### Untested Files (no `.test.*` counterpart)

- `app/api/auth/codeberg/config.ts` — pure config object wiring, no logic; covered implicitly through route tests
- `app/api/auth/bitbucket/config.ts` — same; no action needed

## Flaky Tests
None detected — 3/3 runs passed 6894/6894 tests identically.

---

## Shared Context Entry

<!-- ENTRY:START agent=coverage timestamp=2026-04-19T02:00:00Z -->
## Coverage Agent — 2026-04-19
- **Status**: YELLOW
- Overall coverage: **93% stmts** (7647/8222), 89.47% branch, 89.64% funcs, 94.06% lines
- Test suite: 394 files, 6894 tests — stable (0 change vs 2026-04-18, no regressions)
- All critical paths GREEN: lib/impact 100%, lib/render 100%, lib/db 97.5%, lib/cache 99.6%, lib/auth 98.8%, lib/github 97.6%, lib/history 99.1%, lib/email 97.9%, app/api 98.9%, app/api/admin 97.7%, components 94.2%
- **Flaky tests: NONE** — 3/3 runs passed 6894/6894.
- **P2 carried**: `app/api/cron/warm-cache/route.ts` — 62.5% funcs, 75% branches. Missing: `parsePriorityHandles` arrow callbacks (env var never set in tests), wrap-around rotation branch, `getAvatarBase64` catch handler.
- **P2 NEW**: `lib/profile/public-profile.ts` — 68.75% branches, 83.33% funcs. `runPublicProfileSideEffects` missing no-displayName/avatarUrl branch and false-insert path. Uncovered catch handler.
- **P2 carried**: `components/UserMenu.tsx` — 80% funcs (handleInsightsFile, at threshold).
- **P3 carried (all accepted)**: experiments 58.6% (Canvas/WebGL), HolographicOverlay 50% (Canvas), AuthorTypewriter 67.5% branches (JSDOM), demoData files 50% branches (data tables), refresh/recalculate fire-and-forget arrows, lazy wrappers 25–33% funcs

**Cross-agent recommendations:**
- [Security]: No new security-relevant test gaps. All critical-path coverage stable and GREEN. `public-profile.ts` side-effects (dbUpsertUser, storeVerificationRecord) have partial branch coverage — the uncovered paths are non-throwing fire-and-forget, low blast radius.
- [QA]: Suite stable at 6894 tests, 0 failures, 0 flaky for 4th consecutive cycle.
- [Cost Analyst]: app/api 98.9%, lib/db 97.5% — stable. warm-cache P2 unchanged — 3 uncovered arrow functions are in non-critical `parsePriorityHandles` and avatar-cache warming, not the snapshot/notification pipeline.
- [Performance]: No coverage-performance gaps. Experiment pages (Canvas/WebGL) remain the only persistent gap and are accepted.
<!-- ENTRY:END -->
