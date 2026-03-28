# Documentation Update Report

> Generated on 2026-03-28 | Branch: `develop` | Changes since v2.4.1

## Summary
- 5 documents updated
- 0 diagrams refreshed (all current or covered by v6.1 spec section)
- 0 version references corrected (all intentional)
- 0 inline doc blocks updated (all already current)
- 0 items flagged [NEEDS REVIEW]

## Changes by File

### docs/how-it-works.md
- **Quality dimension table**: "inverse micro-commit ratio (15%)" → "batch size score (15%)" in both collaborative and solo paths
- **Consistency dimension table**: "inverse burst activity (15%)" → "week coverage (15%)"
- **Delivery dimension table**: Added "lead time modifier (±5%)"
- **Solo detection**: "zero reviews" → ratio-based (review-to-PR ratio < 0.15)
- **Explanatory paragraphs**: Added 3 new paragraphs explaining lead time modifier, batch size score, and week coverage with outlier clipping
- **Confidence table**: Burst activity threshold "20+" → "100+"

### docs/scoring-explainer-video.md
- **Delivery section**: Added lead time modifier paragraph (DORA flow efficiency)
- **Quality collaborative**: "Inverse Micro-Commit Ratio" → "Batch Size Score" with research context
- **Quality solo**: Same micro-commit → batch size update
- **Profile type detection**: Binary ("at least one code review") → ratio-based (0.15 threshold)
- **Consistency section**: "Inverse Burst Activity" → "Week Coverage"; added outlier clipping to heatmap evenness
- **Confidence table**: Burst threshold "20+" → "100+" with rationale
- **Anti-gaming section**: "Unknown micro-commit ratio default" → "Batch size scoring"
- **Solo Philosophy**: Updated detection description and quality rubric list
- **Pipeline steps**: Updated step 2 profile detection description

### README.md
- **Dimension table**: Updated all 4 dimension descriptions to reflect v6.1 signals (lead time, batch size, week coverage, cross-project influence)

### docs/impact-v6.md
- **Solo Profile Exception**: "zero code reviews" → "review-to-PR ratio below 0.15"
- **Solo Quality signals**: "micro-commit ratio" → "batch size score"

### CHANGELOG.md
- Added v2.5.0 entry with Added/Changed/Documentation sections covering all v6.1 changes
- Added link reference for v2.5.0

## Discovery Process
4 parallel agents investigated:
- **change-analyst**: 20 commits, categorized by area (scoring, API, docs, tests, config)
- **doc-inventory**: 40+ doc files mapped; 3 flagged for update
- **diagram-analyzer**: 11 diagrams found; all current or covered by existing v6.1 section
- **version-scanner**: All scoring version refs checked; function name `computeImpactV4` confirmed intentional

## Flagged for Review
None.
