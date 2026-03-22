# Scoring Accuracy Fixes

> Fix three scoring accuracy issues discovered while investigating user jordanlynn5's Quality score.

## Context

Investigation revealed three data accuracy gaps in the scoring pipeline:

1. **`dev` and `developer` missing from `DEFAULT_BRANCH_NAMES`** — These common branch names are not recognized as default branches, causing `featureBranchRate` to inflate by treating `dev→main` merges as "feature branch" PRs. Affects the 25% feature branch weight in solo Quality scoring.

2. **`microCommitRatio` never computed** — The field is defined in types and used in scoring (15% of Quality, both paths), but `buildStatsFromRaw()` never calculates it. Every user gets the 0.3 default, giving ~10.5 free Quality points instead of an accurate value.

3. **`low_activity_signal` condition too lenient** — Requires `activeDays < 30 AND commitsTotal < 50`. A developer with 17 active days but 65 commits avoids the penalty entirely. Changing to OR ensures that either condition alone reflects limited scoring signal.

## Design Decisions

### Micro-commit threshold: `additions + deletions < 10`

Aligns with the existing PR weight formula where `sizeMultiplier = min(1, totalChanges / 10)` — PRs below 10 total changes already get weight-penalized. Using the same boundary for micro-commit detection is consistent. Counts only lines changed (additions + deletions), not files — a 3-file PR with 8 lines changed is still micro in terms of code.

### low_activity_signal: AND → OR

Simple, defensible change. With OR:
- 17 active days + 65 commits → penalty (limited temporal signal) ✓
- 5 active days + 200 commits → penalty (concentrated burst) ✓
- 200 active days + 30 commits → penalty (sustained presence but low volume) — acceptable, this is genuinely low signal for PR-based metrics
- 30 active days + 50 commits → no penalty (both above thresholds) ✓

The penalty is only -10 confidence (translates to ~1.5% score reduction), so even edge cases are minimally impacted.

## Phases

| Phase | Description | Files | Batch |
|-------|-------------|-------|-------|
| 1 | Add `dev`/`developer` to DEFAULT_BRANCH_NAMES | `packages/shared/src/stats-aggregation.ts`, `packages/shared/src/stats-aggregation.test.ts` | [batch-eligible with Phase 3] |
| 2 | Implement `microCommitRatio` computation | `packages/shared/src/stats-aggregation.ts`, `packages/shared/src/stats-aggregation.test.ts` | Sequential after Phase 1 (shared file) |
| 3 | Change `low_activity_signal` from AND to OR | `apps/web/lib/impact/utils.ts`, `apps/web/lib/impact/utils.test.ts`, `docs/impact-v6.md`, `docs/impact-v4.md` | [batch-eligible with Phase 1] |

## Verification

After all phases:
```bash
pnpm run test 2>&1; pnpm run typecheck 2>&1; pnpm run lint 2>&1
```

## Impact on jordanlynn5

| Metric | Before | After |
|--------|--------|-------|
| featureBranchRate | 1.0 (16/16 "feature") | 0.0 (0/16 — all from `dev`/`developer`) |
| microCommitRatio | undefined (→ 0.3 default) | 0.0625 (1/16 micro PRs) |
| Quality (solo) | ~71 | ~47 (desc 35 + branch 0 + linkage 0 + inverseMicro 14 = 49, clamped) |
| Confidence | 100% | 90% (low_activity_signal triggers: 17 days < 30) |
| Adjusted composite | ~43 | ~38 (composite drops slightly from confidence) |
| Tier | Solid | Solid (still >= 30) |
