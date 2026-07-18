```markdown
# Coverage Report
> Generated: 2026-07-18 | Health status: green

## Executive Summary
Full suite passes clean — **8,525 tests across 498 files, 0 failures, 0 skips** — with overall coverage of **96.72% statements / 92.85% branches / 95.61% functions / 97.92% lines** (up from 96.31% stmts on the 2026-06-30 baseline). All four critical paths remain well above the 80% bar; the previously largest gap (`lib/gitlab/queries.ts`, 24 missed branches) is now closed at 100% stmts / 97.2% branches, and the only new gap is the small `app/[locale]/layout.tsx` (0% stmts, 36 lines) introduced by the #1023 i18n RSC migration.

## Coverage by Module
| Module | Coverage | Status |
|--------|----------|--------|
| `apps/web/lib/impact` (scoring pipeline) | 99.6% stmts / 98.7% br / 100% fn | ✅ Green |
| `apps/web/lib/render` (SVG rendering) | 100% stmts / 93.5% br / 100% fn | ✅ Green |
| `apps/web/app/api` (API routes) | 97.3% stmts / 94.2% br / 95.6% fn | ✅ Green |
| `apps/web/lib/db` (database layer) | 97.2% stmts / 94.5% br / 100% fn | ✅ Green |
| `apps/web/lib/github` | 97.5% stmts / 97.3% br | ✅ Green |
| `apps/web/lib/gitlab` | 100% stmts / 97.2% br | ✅ Green (was YELLOW — 24-branch gap closed) |
| `apps/web/lib/auth` | 97.4% stmts / 94.8% br | ✅ Green |
| `apps/web/lib/cache` | 97.1% stmts / 92.9% br | ✅ Green |
| `apps/web/lib/profile` (incl. `reconcileSnapshotWrite`) | 96.9% stmts / 94.6% br | ✅ Green |
| `apps/web/lib/history` | 98.4% stmts / 96.6% br | ✅ Green |
| `apps/web/lib/i18n` | 98.4% stmts / 92.5% br | ✅ Green |
| `apps/web/components` | 96.5% stmts / 91.0% br | ✅ Green |
| `apps/web/app` (pages, incl. experiments) | 94.8% stmts / 89.3% br | 🟡 Yellow (experiments + new `[locale]/layout.tsx` drag) |
| `packages/shared` | 100% across the board | ✅ Green |

Cost-analyst's 2026-07-17 spot-check request is satisfied: `reconcileSnapshotWrite`'s tri-state outcome tracking (`lib/profile`, 96.9%) and the `latency-check` cron (within `app/api` at 97.3%) are both covered.

## Gaps & Recommendations
- **`apps/web/app/[locale]/layout.tsx` — 0% stmts (NEW, only actionable gap).** 36 lines from the #1023 i18n RSC migration; `generateStaticParams` and the layout body are never executed by any test. The sibling `page.test.ts` *mentions* it in a comment but doesn't render it. Recommend a small render/params test following the existing `page.render.test.tsx` pattern in the same directory. This is the exact shape the cost-analyst warned about ("a contents/adjacent test is not coverage") — the file that pre-renders both locales at build time has zero direct coverage.
- **`lib/effects/interactions/HolographicOverlay.tsx` — 50% stmts.** Known P3 carry (Canvas/WebGL, JSDOM-limited). Accepted.
- **Experiments pages** (`glassmorphism` 70.6%, `heatmap-wave` 73.3%, `metallic-shimmer` 78.1%, `particle-core.ts` 58% br) — known P3 carries, feature-flag-gated Canvas/WebGL surfaces. Accepted.
- **`components/AuthorTypewriter.tsx` — 67.5% br (13 missed)** and **`lib/effects/backgrounds/ParticleBackground.tsx` — 68% br (16 missed):** timing/animation branches; low value, JSDOM-testable if desired.
- **`lib/i18n/provider.tsx` — 69.2% br (4 missed):** long-standing JSDOM locale-switch carry, improved from 61.5%.
- **`demoData.ts` / `archetypeDemoData.ts` 50% br:** documented accepted skip per 2026-07-16 triage (unreachable fallback in unexported builders) — not re-flagged.
- **Untested-file scan:** all files lacking a sibling `.test.ts` are either type-only (`*/types.ts`, barrel `index.ts` files, `packages/shared/src/*` — 100% covered via consumers), dictionaries (covered by `parity.test.ts`), OAuth `config.ts` constants, or `db/campaigns/{crud,sends}.ts` (98–99% covered via the campaigns route/cron suites). No genuinely untested runtime logic outside `[locale]/layout.tsx` above.
- **Config-assertion audit (cost-analyst 2026-07-17 ask):** noted — the `schedule.test.ts` lesson ("contents test ≠ coverage when placement determines effect") is now gated by `check:vercel-config`; `[locale]/layout.tsx` is the closest analogous case in this cycle and is flagged above.

## Flaky Tests
None detected
```

SHARED_CONTEXT_START
## Coverage Agent — 2026-07-18
- **Status**: GREEN
- Overall coverage: 96.72% stmts / 92.85% br / 95.61% fn / 97.92% lines — HEAD `74bbcff0`, 498 files / 8,525 tests, all passing (98.9s, --maxWorkers=3). Up from 96.31% stmts (2026-06-30 baseline); suite grew 8,450 → 8,525 since QA's 2026-07-15 run.
- Critical gaps: only 1 actionable — `apps/web/app/[locale]/layout.tsx` at **0% stmts** (36 lines, #1023 i18n migration; `generateStaticParams` never executed, sibling tests cover `page.tsx` only). Everything else sub-80% is a known accepted carry (HolographicOverlay 50%, 3 experiments Canvas/WebGL pages, demoData branch skips per 2026-07-16 triage). Former largest gap `lib/gitlab/queries.ts` (24 missed br) now CLOSED — lib/gitlab at 100% stmts / 97.2% br.
- Critical paths: lib/impact 99.6/98.7, lib/render 100/93.5, app/api 97.3/94.2, lib/db 97.2/94.5 — all green. Cost-analyst's spot-check request satisfied: `reconcileSnapshotWrite` (lib/profile 96.9%) and `latency-check` cron (app/api) both covered.
- Flaky tests: 0

**Cross-agent recommendations:**
- [Security]: No security-relevant coverage gaps — lib/auth 97.4%, lib/render 100% stmts (all escapeXml paths), lib/verification 100%, OAuth platform modules (bitbucket/codeberg/gitlab) all ≥92.8% stmts with gitlab now fully closed.
- [QA]: One concrete new item: add a render/params test for `app/[locale]/layout.tsx` (0% stmts) following the existing `[locale]/page.render.test.tsx` pattern — it's the file that pre-renders both locales and currently matches the "adjacent test mentions it but never executes it" anti-pattern from the #1052 schedule.test.ts lesson.
- [Triage]: Drop `lib/gitlab/queries.ts` (71.8% br) from carry lists — closed. Sole new P3: `[locale]/layout.tsx` test above.
SHARED_CONTEXT_END
