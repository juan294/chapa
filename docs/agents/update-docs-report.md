# Documentation Update Report

> Generated on 2026-04-04 | Branch: `develop` | Changes since v2.6.0

## Summary
- 12 documents updated
- 5 diagrams refreshed (v4→v6 in ASCII pipeline diagrams)
- 3 version references corrected (TS badge, test count, StatsData field count)
- 1 inline doc block updated (MetricsSnapshot JSDoc)
- 1 new user-facing section added (Craft dimension on /about/scoring)
- 0 items flagged [NEEDS REVIEW]

## Changes by File

### docs/impact-v6.md
- Effectiveness signals: removed "inverse friction, error recovery" → now "achievement rate (55%), satisfaction rate (45%) — friction/errors excluded"
- Consistency table: "Inverse burst" → "Week coverage"
- Pipeline diagram: 6x `computeImpactV4`/`ImpactV4Result`/`impact/v4.ts` → v6

### docs/svg-design.md
- Heatmap palette: corrected 5 opacity values to match `theme.ts` (0.06→0.12, 0.20→0.30, etc.)
- Type reference: `ImpactV4Result` → `ImpactV6Result`

### packages/shared/src/types.ts
- MetricsSnapshot JSDoc: "Redis sorted sets" → "Supabase `metrics_snapshots` table"

### CLAUDE.md
- StatsData field count: 29 → 30 (added `primaryReviewsSubmittedCount`)

### docs/impact-v4.md
- Deprecation notice: "still named computeImpactV4" → "renamed to computeImpactV6 in v6.ts"

### README.md
- TypeScript badge: 5.9 → 6.0
- Test count: 382+ files / 6,650+ tests → 389+ files / 6,950+ tests

### docs/demo.md
- "Impact v4 measures four independent dimensions" → "Impact v6 measures up to five independent dimensions"

### apps/web/app/about/scoring/page.tsx
- Added new "Craft — AI tool mastery (optional)" section explaining:
  - How to unlock Craft (run `/insights` in Claude Code, upload to Chapa)
  - Two-week re-upload cadence (matches Claude Code's insights generation cycle)
  - Three sub-dimensions table (Proficiency, Effectiveness, Sophistication)
  - Explicit note that friction/errors are excluded from scoring

### docs/plans/2026-04-03-metaphor-first-badge-vision.md
- Architecture diagram: `computeImpactV4`/`ImpactV4Result` → v6

### docs/research/multi-platform.md
- All "Impact v4" naming → "Impact v6", function/type refs → v6

### docs/research/2026-03-08-score-stasis-solution-space.md
- Pipeline refs: `computeImpactV4()` → v6, `impact/v4.ts` → v6

### docs/plans/2026-03-07-insights-integration.md
- "Impact v4" → "Impact v6" (3 occurrences)

## Verified Current (no changes needed)
- `docs/design-system.md` — updated in v2.6.0 cycle
- `docs/accepted-risks.md` — just updated with CRON_SECRET entry
- `docs/chapa-architecture.drawio` — already says "v6 Scoring"
- `CHANGELOG.md` — will be updated during `/release`
- Historical specs (v3/v5) — archived, no update needed
- 39 plan/research docs with v4 refs — historical point-in-time records

## Flagged for Review
None.
