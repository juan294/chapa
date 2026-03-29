# Phase 4: makeFullStats() Factory

## Goal
Test fixture that populates ALL StatsData fields (required + optional) so merge and pipeline tests can detect field drops.

## Approach

### 1. Add makeFullStats() to fixtures.ts
- Starts with makeStats() defaults
- Adds all optional fields: displayName, avatarUrl, microCommitRatio, docsOnlyPrRatio, prDescriptionRate, featureBranchRate, issueLinkageRate, batchSizeScore, medianPrLeadTimeHours
- Values chosen to be realistic and nonzero
- Uses STATS_DATA_KEYS for a compile-time guard (if a new field is added to StatsData, makeFullStats must be updated or the schema test in Phase 1 fails)

## Files Changed
- Modified: `apps/web/lib/test-helpers/fixtures.ts`
