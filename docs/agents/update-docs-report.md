# Documentation Update Report

> Generated on 2026-03-29 | Branch: `develop` | Changes since v2.5.0

## Summary
- 7 documents updated
- 0 diagrams refreshed (no Mermaid diagrams in project; ASCII diagrams current)
- 3 version/count references corrected
- 0 inline doc blocks updated
- 0 items flagged [NEEDS REVIEW]

## Changes by File

### CLAUDE.md
- **StatsData field count**: 25 → 29 (actual interface has 29 fields)
- **MetricsSnapshot storage**: "stored in Redis sorted sets" → "stored in Supabase `metrics_snapshots` table" (migrated months ago)

### README.md
- **Verification hash length**: "8-character" → "32-character" (upgraded in #617, v2.3.0)
- **Test count**: "378+ test files, 6,400+ tests" → "382+ test files, 6,650+ tests"

### docs/how-it-works.md
- **Quality 15% signal**: "inverse micro-commit ratio" → "batch size score" (both collaborative and solo)
- **Consistency 15% signal**: "inverse burst activity" → "week coverage"
- **Solo profile detection**: "zero reviews" → "review-to-PR ratio >= 0.15"
- **Solo quality role**: clarified that solo quality is excluded from composite score

### docs/scoring-explainer-video.md
- **Quality 15% signal**: "Inverse Micro-Commit Ratio" → "Batch Size Score" with updated description
- **Consistency 15% signal**: "Inverse Burst Activity" → "Week Coverage" with updated description

### docs/spec.md
- **Composite score**: "Average of all four dimensions" → "Average of all active dimensions (4 or 5 when Craft present; quality excluded for solo)"

### docs/cli-guide.md
- **Node.js version**: "18 or later" → "20 or later"
- **npm version**: "7 or later" → "10 or later"

### docs/plans/2026-03-29-scoring-pipeline-hardening.md
- **Phase checkboxes**: All 5 phases marked complete (field guard, golden-file tests, e2e pipeline test, makeFullStats factory, CI gate)

## Verified Current (no changes needed)
- `docs/impact-v6.md` — source of truth, already matches code
- `docs/design-system.md` — matches current tokens/fonts
- `docs/svg-design.md` — matches current badge rendering
- `docs/badge-verification.md` — correct (32-char hash documented)
- `docs/accepted-risks.md` — profile-type-threshold entry matches code (0.15 ratio)
- `CONTRIBUTING.md` — current
- Historical specs (v3/v4/v5) — archived, no update needed

## Flagged for Review
None.
