# Phase 1: Fix Profile Type Detection

> `[batch-eligible]` — can run in parallel with Phase 2

## Goal

Change profile type detection from binary (`reviews === 0`) to ratio-based (`reviews / PRs < 0.15`). This prevents a handful of incidental reviews from triggering the collaborative scoring path that penalizes solo developers.

## Current Behavior

```
detectProfileType(stats) → reviews === 0 ? "solo" : "collaborative"
computeQuality(stats) → reviews === 0 ? soloQuality() : collabQuality()
```

These two checks are independent — `detectProfileType` controls composite/archetype, while `computeQuality` controls which formula runs. They happen to use the same `reviews === 0` condition, but they need to be aligned under the new threshold.

## Changes

### 1. Add constant for solo threshold

**File**: `packages/shared/src/constants.ts`

```pseudo
+ /** Review-to-PR ratio below which a profile is classified as "solo". */
+ export const SOLO_REVIEW_RATIO_THRESHOLD = 0.15;
```

### 2. Update detectProfileType to use ratio

**File**: `apps/web/lib/impact/v4.ts:210-212`

```pseudo
- export function detectProfileType(stats: StatsData): ProfileType {
-   return stats.reviewsSubmittedCount === 0 ? "solo" : "collaborative";
- }
+ export function detectProfileType(stats: StatsData): ProfileType {
+   if (stats.reviewsSubmittedCount === 0) return "solo";
+   const prCount = Math.max(stats.prsMergedCount, 1);
+   const ratio = stats.reviewsSubmittedCount / prCount;
+   return ratio < SOLO_REVIEW_RATIO_THRESHOLD ? "solo" : "collaborative";
+ }
```

### 3. Update computeQuality to accept profileType

**File**: `apps/web/lib/impact/v4.ts:58-83`

```pseudo
- export function computeQuality(stats: StatsData): number {
-   if (stats.reviewsSubmittedCount === 0) {
-     return computeSoloQuality(stats);
-   }
+ export function computeQuality(stats: StatsData, profileType?: ProfileType): number {
+   const effectiveType = profileType ?? detectProfileType(stats);
+   if (effectiveType === "solo") {
+     return computeSoloQuality(stats);
+   }
```

### 4. Update computeDimensions to pass profileType

**File**: `apps/web/lib/impact/v4.ts:184-195`

```pseudo
- export function computeDimensions(stats: StatsData, craftScore?: number): DimensionScores {
+ export function computeDimensions(stats: StatsData, craftScore?: number, profileType?: ProfileType): DimensionScores {
    const dims: DimensionScores = {
      delivery: computeDelivery(stats),
-     quality: computeQuality(stats),
+     quality: computeQuality(stats, profileType),
      consistency: computeConsistency(stats),
      breadth: computeBreadth(stats),
    };
```

### 5. Update computeImpactV4 to thread profileType

**File**: `apps/web/lib/impact/v4.ts:296-330`

```pseudo
  export function computeImpactV4(stats: StatsData, craftScore?: number): ImpactV4Result {
    const profileType = detectProfileType(stats);
-   const dimensions = computeDimensions(stats, craftScore);
+   const dimensions = computeDimensions(stats, craftScore, profileType);
```

### 6. Update burst_activity confidence threshold

**File**: `apps/web/lib/impact/utils.ts:124-131`

```pseudo
- if (stats.maxCommitsIn10Min >= 20) {
+ if (stats.maxCommitsIn10Min >= 100) {
```

This aligns the confidence penalty threshold with the consistency burst threshold change in Phase 2.

## Tests

**File**: `apps/web/lib/impact/v4.test.ts`

### New tests

```pseudo
describe("detectProfileType", () => {
  it("returns solo when reviews = 0", ...)
  it("returns solo when review ratio < 0.15 (e.g., 5 reviews, 67 PRs)", ...)
  it("returns collaborative when review ratio >= 0.15 (e.g., 15 reviews, 67 PRs)", ...)
  it("returns collaborative when review ratio = 1.0 (pure reviewer)", ...)
  it("handles edge case: 0 PRs with some reviews → collaborative", ...)
})

describe("computeQuality with profileType", () => {
  it("uses solo formula when profileType is solo even with non-zero reviews", ...)
  it("uses collaborative formula when profileType is collaborative", ...)
  it("defaults to detectProfileType when profileType not provided", ...)
})
```

### Updated tests

- Existing `detectProfileType` tests: update expectations for the ratio threshold
- Existing `computeImpactV4` integration tests: verify solo composite excludes quality when ratio < 0.15

**File**: `apps/web/lib/impact/utils.test.ts`

- Update `burst_activity` confidence penalty tests to use threshold 100 instead of 20

## Success Criteria

### Automated
- [ ] `pnpm run test` — all tests pass
- [ ] `pnpm run typecheck` — no type errors
- [ ] `detectProfileType({ reviews: 5, prsMergedCount: 67 })` returns `"solo"`
- [ ] `detectProfileType({ reviews: 15, prsMergedCount: 67 })` returns `"collaborative"`
- [ ] `computeImpactV4` with 5 reviews, 67 PRs excludes quality from composite
- [ ] Confidence penalty `burst_activity` only fires at maxCommitsIn10Min >= 100

### Manual
- None — all verifiable via tests
