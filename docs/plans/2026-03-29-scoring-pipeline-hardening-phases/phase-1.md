# Phase 1: Field Completeness Guard

## Goal
Make it impossible to add a field to StatsData without mergeStats() and buildStatsFromRaw() handling it.

## Approach

### 1. Create a canonical field list in `packages/shared/src/stats-schema.ts`
Export `STATS_DATA_KEYS: readonly string[]` — the exhaustive list of all StatsData fields. Derive it from a `satisfies` pattern so TypeScript enforces it matches the interface.

### 2. Add field completeness test to `merge.test.ts`
Test: "mergeStats output contains every StatsData field when both inputs are fully populated"
- Create fully-populated primary and supplemental stats (using makeFullStats from Phase 4, or inline)
- Call mergeStats(primary, supplemental)
- Assert Object.keys(result).sort() contains every key from STATS_DATA_KEYS
- Excluding metadata fields that are set elsewhere (linkedPlatforms, linkedPlatformLogins, hasSupplementalData)

### 3. Add field completeness test to `stats-aggregation.test.ts`
Test: "buildStatsFromRaw output contains every required StatsData field"
- Build stats from a full raw fixture
- Assert all required keys present

## Files Changed
- New: `packages/shared/src/stats-schema.ts`
- Modified: `packages/shared/src/index.ts` (export)
- Modified: `apps/web/lib/github/merge.test.ts`
- Modified: `packages/shared/src/stats-aggregation.test.ts`
