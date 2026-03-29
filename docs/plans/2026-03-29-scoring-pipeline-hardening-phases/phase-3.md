# Phase 3: End-to-End Pipeline Test

## Goal
Single test that traces the full scoring pipeline without mocks, asserting field survival and score ranges at each stage.

## Approach

### 1. Create pipeline integration test
`apps/web/lib/impact/pipeline.test.ts`:
- Start with makeFullStats() (all fields populated)
- Run through mergeStats() with a supplemental fixture
- Assert all fields survive merge (using STATS_DATA_KEYS)
- Run computeImpactV4() on merged result
- Assert all dimensions are numbers in [0, 100]
- Run buildSnapshot() on stats + impact
- Assert snapshot has expected key count
- Assert dimension scores in snapshot match impact output exactly

### 2. Test multi-platform field preservation
- Create primary stats with solo quality fields populated
- Create supplemental stats (simulating Bitbucket)
- Merge them
- Compute Quality via solo path
- Assert Quality > 0 (this is the exact v2.5.0 regression)

## Dependencies
- Phase 4 (makeFullStats factory)

## Files Changed
- New: `apps/web/lib/impact/pipeline.test.ts`
