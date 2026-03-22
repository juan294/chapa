# Phase 1: Add `dev` and `developer` to DEFAULT_BRANCH_NAMES

> [batch-eligible with Phase 3]

## Goal

Recognize `dev` and `developer` as default branch names so that PRs merging from these branches are not counted as "feature branch" PRs. This corrects `featureBranchRate` inflation for developers who use `dev` as their working branch.

## Files

| File | Change |
|------|--------|
| `packages/shared/src/stats-aggregation.ts:6` | Add `"dev"` and `"developer"` to the Set |
| `packages/shared/src/stats-aggregation.test.ts:472-486` | Update test to include new branch names |

## Changes

### 1. Update DEFAULT_BRANCH_NAMES

**File:** `packages/shared/src/stats-aggregation.ts:6`

```diff
- const DEFAULT_BRANCH_NAMES = new Set(["main", "master", "develop", "development", "trunk"]);
+ const DEFAULT_BRANCH_NAMES = new Set(["main", "master", "develop", "development", "dev", "developer", "trunk"]);
```

### 2. Update test: "excludes all default branch names from featureBranchRate"

**File:** `packages/shared/src/stats-aggregation.test.ts:473`

```diff
- const defaultBranches = ["main", "master", "develop", "development", "trunk"];
+ const defaultBranches = ["main", "master", "develop", "development", "dev", "developer", "trunk"];
```

## TDD Sequence

1. **Red:** Update the test array first to include `"dev"` and `"developer"` — tests will fail because the implementation doesn't recognize them yet.
2. **Green:** Add the two names to `DEFAULT_BRANCH_NAMES` in the source file.
3. **Refactor:** None needed — this is a data change, not a logic change.

## Verification

```bash
cd <worktree> && pnpm run test -- packages/shared/src/stats-aggregation.test.ts
```

## Success Criteria (automated)

- [x] Test "excludes all default branch names from featureBranchRate" passes with 7 branch names
- [x] All existing stats-aggregation tests still pass
- [x] TypeScript compiles cleanly
