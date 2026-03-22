# Phase 2: Implement `microCommitRatio` Computation

> Sequential after Phase 1 (shared file: `stats-aggregation.ts`)

## Goal

Compute `microCommitRatio` from merged PR data in `buildStatsFromRaw()` so that the Quality dimension's 15% inverse-micro-commit weight uses real data instead of the 0.3 default.

## Definition

A **micro PR** is a merged PR where `additions + deletions < 10` (fewer than 10 total lines changed). This aligns with the PR weight formula's existing significance cutoff (`sizeMultiplier = min(1, totalChanges / 10)`).

`microCommitRatio = count(micro PRs) / prsMergedCount` — a value from 0 to 1.

When `prsMergedCount === 0`, the field remains `undefined` (same pattern as other optional PR-level metrics).

## Files

| File | Change |
|------|--------|
| `packages/shared/src/stats-aggregation.ts:44-53` | Add microCommitRatio computation alongside other PR metrics |
| `packages/shared/src/stats-aggregation.ts:114-116` | Add conditional spread for microCommitRatio in return object |
| `packages/shared/src/stats-aggregation.test.ts` | Add tests for microCommitRatio |

## Changes

### 1. Compute microCommitRatio in buildStatsFromRaw

**File:** `packages/shared/src/stats-aggregation.ts`

After the existing solo quality signals block (line 53), add:

```typescript
// 5c. Micro-commit ratio: fraction of merged PRs with < 10 total lines changed
// Threshold aligns with PR weight sizeMultiplier cutoff (totalChanges / 10)
const microCommitRatio = prsMergedCount > 0
  ? mergedPRs.filter((pr) => pr.additions + pr.deletions < 10).length / prsMergedCount
  : undefined;
```

### 2. Include in return object

**File:** `packages/shared/src/stats-aggregation.ts:116`

After the `issueLinkageRate` spread, add:

```typescript
...(microCommitRatio !== undefined && { microCommitRatio }),
```

### 3. Add tests

**File:** `packages/shared/src/stats-aggregation.test.ts`

Add in the "Solo quality signals" section:

```typescript
it("computes microCommitRatio as fraction of merged PRs with < 10 lines changed", () => {
  const raw = makeRaw({
    pullRequests: {
      totalCount: 4,
      nodes: [
        { additions: 3, deletions: 2, changedFiles: 1, merged: true, body: "tiny", headRefName: "fix/a", closingIssuesCount: 0 },  // 5 lines → micro
        { additions: 1, deletions: 0, changedFiles: 1, merged: true, body: "typo", headRefName: "fix/b", closingIssuesCount: 0 },  // 1 line → micro
        { additions: 50, deletions: 10, changedFiles: 3, merged: true, body: "real", headRefName: "feat/c", closingIssuesCount: 0 }, // 60 lines → not micro
        { additions: 100, deletions: 20, changedFiles: 5, merged: true, body: "big", headRefName: "feat/d", closingIssuesCount: 0 },  // 120 lines → not micro
      ],
    },
  });
  const result = buildStatsFromRaw(raw);
  expect(result.microCommitRatio).toBeCloseTo(0.5, 2); // 2 micro out of 4
});

it("treats PRs at exactly 10 lines as non-micro (boundary)", () => {
  const raw = makeRaw({
    pullRequests: {
      totalCount: 2,
      nodes: [
        { additions: 7, deletions: 3, changedFiles: 1, merged: true, body: "x", headRefName: "fix/a", closingIssuesCount: 0 },  // 10 lines → NOT micro (>= 10)
        { additions: 6, deletions: 3, changedFiles: 1, merged: true, body: "x", headRefName: "fix/b", closingIssuesCount: 0 },  // 9 lines → micro (< 10)
      ],
    },
  });
  const result = buildStatsFromRaw(raw);
  expect(result.microCommitRatio).toBeCloseTo(0.5, 2);
});

it("returns 0 microCommitRatio when all PRs are substantial", () => {
  const raw = makeRaw({
    pullRequests: {
      totalCount: 2,
      nodes: [
        { additions: 50, deletions: 10, changedFiles: 3, merged: true, body: "x", headRefName: "feat/a", closingIssuesCount: 0 },
        { additions: 100, deletions: 20, changedFiles: 5, merged: true, body: "x", headRefName: "feat/b", closingIssuesCount: 0 },
      ],
    },
  });
  const result = buildStatsFromRaw(raw);
  expect(result.microCommitRatio).toBe(0);
});

it("returns 1.0 microCommitRatio when all PRs are micro", () => {
  const raw = makeRaw({
    pullRequests: {
      totalCount: 2,
      nodes: [
        { additions: 1, deletions: 0, changedFiles: 1, merged: true, body: "x", headRefName: "fix/a", closingIssuesCount: 0 },
        { additions: 2, deletions: 1, changedFiles: 1, merged: true, body: "x", headRefName: "fix/b", closingIssuesCount: 0 },
      ],
    },
  });
  const result = buildStatsFromRaw(raw);
  expect(result.microCommitRatio).toBe(1);
});

it("returns undefined microCommitRatio when no merged PRs", () => {
  const raw = makeRaw({
    pullRequests: { totalCount: 0, nodes: [] },
  });
  const result = buildStatsFromRaw(raw);
  expect(result.microCommitRatio).toBeUndefined();
});

it("excludes unmerged PRs from microCommitRatio", () => {
  const raw = makeRaw({
    pullRequests: {
      totalCount: 3,
      nodes: [
        { additions: 1, deletions: 0, changedFiles: 1, merged: true, body: "x", headRefName: "fix/a", closingIssuesCount: 0 },  // micro, merged
        { additions: 50, deletions: 10, changedFiles: 3, merged: true, body: "x", headRefName: "feat/b", closingIssuesCount: 0 },  // not micro, merged
        { additions: 1, deletions: 0, changedFiles: 1, merged: false, body: "x", headRefName: "fix/c", closingIssuesCount: 0 },  // micro, NOT merged — excluded
      ],
    },
  });
  const result = buildStatsFromRaw(raw);
  expect(result.microCommitRatio).toBeCloseTo(0.5, 2); // 1 micro out of 2 merged
});
```

## TDD Sequence

1. **Red:** Write all 6 tests above. They will fail because `microCommitRatio` is never set.
2. **Green:** Add the computation and return spread to `buildStatsFromRaw()`.
3. **Refactor:** None needed.

## Verification

```bash
cd <worktree> && pnpm run test -- packages/shared/src/stats-aggregation.test.ts
```

## Success Criteria (automated)

- [x] All 6 new microCommitRatio tests pass
- [x] All existing stats-aggregation tests still pass
- [x] All existing v4 impact tests still pass (scoring uses the same field — behavior improves but existing tests with explicit `microCommitRatio` values are unaffected)
- [x] TypeScript compiles cleanly
