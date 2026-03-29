# Phase 2: Golden-File Scoring Tests

## Goal
Reference profiles with known-correct scores. Any scoring change that shifts results must update the golden file explicitly.

## Approach

### 1. Create golden profile fixtures
3-4 reference profiles representing different developer archetypes:
- Solo developer with high delivery, no reviews
- Collaborative developer with balanced dimensions
- Low-activity emerging developer
- Multi-platform developer with supplemental data

Each fixture is a complete StatsData with known values.

### 2. Create golden-file test
`apps/web/lib/impact/golden-profiles.test.ts`:
- For each profile: computeImpactV4(fixture) → assert exact scores via toMatchInlineSnapshot()
- Covers: all 4 dimensions, archetype, composite, confidence, tier, profile type
- If a scoring formula changes, the inline snapshot MUST be updated — reviewer sees the diff

## Files Changed
- New: `apps/web/lib/impact/golden-profiles.test.ts`
