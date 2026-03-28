# Phase 3: Add Batch Size / Reviewability Signal

> Sequential — after Phases 1 and 2

## Goal

Replace the micro-commit ratio (inverse penalty for tiny PRs) with a **batch size score** that rewards PRs in the reviewable sweet spot (20-500 lines changed). This aligns with the research finding that "small, reviewable batches" are a top signal of engineering discipline.

## Current Behavior

Quality (both paths) uses `inverseMicro = 1 - microCommitRatio` at 15% weight. This penalizes having many tiny PRs (< 10 lines) but treats a 100-line PR and a 5,000-line PR identically.

The research scorecard (DORA, Google code review guidelines) explicitly says that small, focused changes should be rewarded, and giant PRs should be penalized — not just tiny ones.

## Design: Batch Size Score

```
batchSizeScore = count(PRs in sweet spot) / total merged PRs
sweet spot = 20 ≤ (additions + deletions) ≤ 500
```

This is a **0-1 ratio** that replaces `inverseMicro` in both the collaborative and solo Quality formulas at the same 15% weight. It:
- Rewards small, focused PRs (20-500 lines) — the reviewable sweet spot
- Penalizes both micro PRs (< 20 lines) and oversized PRs (> 500 lines)
- Is simple to compute from existing PR data

### Sweet Spot Justification

| Range | Classification | Signal |
|-------|---------------|--------|
| < 20 lines | Micro — config tweak, typo fix | Trivial, low engineering value |
| 20-500 lines | Sweet spot — focused change | Reviewable, testable, reversible |
| > 500 lines | Oversized — hard to review | Risk of hidden bugs, slow review |

The 500-line upper bound aligns with Google's code review guidance ("a CL should be as small as possible while still representing a complete change").

## Changes

### 1. Add batch size constants

**File**: `packages/shared/src/constants.ts`

```pseudo
+ /** Minimum lines changed for a PR to be in the "reviewable sweet spot". */
+ export const BATCH_SIZE_MIN = 20;
+
+ /** Maximum lines changed for a PR to be in the "reviewable sweet spot". */
+ export const BATCH_SIZE_MAX = 500;
```

### 2. Add batchSizeScore to StatsData type

**File**: `packages/shared/src/types.ts`

```pseudo
  interface StatsData {
    ...
    microCommitRatio?: number;
+   /** Fraction of merged PRs in the reviewable sweet spot (20-500 lines changed). */
+   batchSizeScore?: number;
    ...
  }
```

### 3. Compute batchSizeScore in stats aggregation

**File**: `packages/shared/src/stats-aggregation.ts`

```pseudo
+ import { BATCH_SIZE_MIN, BATCH_SIZE_MAX } from "./constants";

  // After microCommitRatio computation (line ~56):
+ const batchSizeScore = prsMergedCount > 0
+   ? mergedPRs.filter((pr) => {
+       const total = pr.additions + pr.deletions;
+       return total >= BATCH_SIZE_MIN && total <= BATCH_SIZE_MAX;
+     }).length / prsMergedCount
+   : undefined;

  // In return object:
    ...(microCommitRatio !== undefined && { microCommitRatio }),
+   ...(batchSizeScore !== undefined && { batchSizeScore }),
```

### 4. Replace inverseMicro with batchSizeScore in collaborative Quality

**File**: `apps/web/lib/impact/v4.ts:76-81`

```pseudo
- const microRatio = stats.microCommitRatio ?? 0.3;
- const inverseMicro = 1 - microRatio;
-
- const raw = 100 * (0.6 * reviews + 0.25 * reviewRatio + 0.15 * inverseMicro);
+ const batchSize = stats.batchSizeScore ?? 0.3;
+
+ const raw = 100 * (0.6 * reviews + 0.25 * reviewRatio + 0.15 * batchSize);
```

### 5. Replace inverseMicro with batchSizeScore in solo Quality

**File**: `apps/web/lib/impact/v4.ts:101-111`

```pseudo
  function computeSoloQuality(stats: StatsData): number {
    if (stats.prsMergedCount === 0) return 0;

    const descRate = stats.prDescriptionRate ?? 0;
    const branchRate = stats.featureBranchRate ?? 0;
    const linkageRate = stats.issueLinkageRate ?? 0;
-   const microRatio = stats.microCommitRatio ?? 0.3;
-   const inverseMicro = 1 - microRatio;
+   const batchSize = stats.batchSizeScore ?? 0.3;

-   const raw = 100 * (0.40 * descRate + 0.25 * branchRate + 0.20 * linkageRate + 0.15 * inverseMicro);
+   const raw = 100 * (0.40 * descRate + 0.25 * branchRate + 0.20 * linkageRate + 0.15 * batchSize);
    return clampScore(raw);
  }
```

### 6. Update stats merging for batchSizeScore

**File**: `apps/web/lib/github/merge.ts`

```pseudo
  // Add batchSizeScore to the merged stats fields
  // Since batchSizeScore is a ratio computed from PRs, use weighted average
  // when merging multi-platform stats:
+ batchSizeScore: weightedAverage(primary.batchSizeScore, primary.prsMergedCount,
+                                  secondary.batchSizeScore, secondary.prsMergedCount),
```

### 7. Update confidence penalty for micro_commit_pattern

**File**: `apps/web/lib/impact/utils.ts:133-143`

The `micro_commit_pattern` confidence penalty still uses `microCommitRatio >= 0.6`. This should remain — it flags profiles where 60%+ of PRs are trivial (< 10 lines). The penalty is orthogonal to the batch size scoring signal.

No change needed here — `microCommitRatio` is still computed and used for confidence.

## Impact Analysis

For juan294 (67 merged PRs):
- PRs in sweet spot (20-500 lines): ~25 out of 67 ≈ 0.37
- Previous inverseMicro: 1 - 0.104 = 0.896
- New batchSizeScore: 0.37

On solo Quality formula:
- Old: 0.40(1.0) + 0.25(0.52) + 0.20(0.31) + 0.15(0.90) = 72.8 → 73
- New: 0.40(1.0) + 0.25(0.52) + 0.20(0.31) + 0.15(0.37) = 64.7 → 65

Quality drops from 73 to 65. However, since solo Quality is display-only (not in composite), this only affects the radar chart — not the overall score.

This is actually more accurate: the user has many large PRs (develop → main release bundles) that are NOT easily reviewable. The batch size signal correctly identifies this as a growth area.

## Tests

**File**: `packages/shared/src/stats-aggregation.test.ts`

```pseudo
describe("batchSizeScore", () => {
  it("returns fraction of PRs in 20-500 line range", ...)
  it("returns 0 when all PRs are micro (< 20 lines)", ...)
  it("returns 0 when all PRs are oversized (> 500 lines)", ...)
  it("returns 1.0 when all PRs are in sweet spot", ...)
  it("returns undefined when no merged PRs", ...)
})
```

**File**: `apps/web/lib/impact/v4.test.ts`

```pseudo
describe("computeQuality with batchSizeScore", () => {
  it("uses batchSizeScore instead of inverseMicro in collaborative formula", ...)
  it("uses batchSizeScore instead of inverseMicro in solo formula", ...)
  it("defaults batchSizeScore to 0.3 when undefined", ...)
})
```

## Success Criteria

### Automated
- [ ] `pnpm run test` — all tests pass
- [ ] `pnpm run typecheck` — no type errors
- [ ] `buildStatsFromRaw` produces correct `batchSizeScore` for known PR data
- [ ] Quality formulas use `batchSizeScore` instead of `inverseMicro`
- [ ] Existing Quality boundary tests (0, 100) still pass with updated formula

### Manual
- None — all verifiable via tests
