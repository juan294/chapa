# Scoring v7: GitHub evidence and exact aggregation validation

Date: 2026-09-05. Tasks: S02 (#1297), S06 (#1301). Policy: `docs/plans/2026-09-05-scoring-relaunch-phases/policy.md`. Both tasks are verified and ready for local integration.

## Implemented behavior

S02 provides `fetchGitHubEvidence` with stable subject/repository/event identities, bounded request work, and explicit reference-window filtering. It fetches authored default-branch commit history, authored PRs selected by merge time, submitted reviews from discovered PRs, actor-specific issue closures, and fully paginated changed-file lists. Each private connection checkpoint retains counts, completion state and its replay cursor. HTTP/GraphQL errors retain usable observations without declaring their missing tail complete.

A closure does not establish authorship of somebody else's accepted result. Unsupported closer types and unavailable practice observations stay unknown. Review submission remains diagnostic until substantive work is supported by an accountable assessment. Different head/base branch names do not establish feature-branch purpose. Global repository discovery and historical review discovery remain explicitly partial where GitHub's documented semantics do not prove completeness.

S06 unions sufficient evidence before aggregation. Event identity and verified work/repository mappings control deduplication. Overlapping equivalence groups resolve transitively. Conflicting immutable facts/provenance are rejected; conflicting measurements remain unknown. Pooled rates retain each signal's measured numerator and denominator plus unknown count. Medians use the pooled individual observations and avoid finite-input overflow. Explicit work links also prevent mirrored diagnostic samples from receiving duplicate weight.

Accepted-work observations retain one selected acceptance event before project/date bucketing. Partial or self-reported acceptance fields do not become source facts. Only nonempty complete changed-file lists support the versioned documentation classifier. Authored commits alone feed concentration and actual timestamp-based ten-minute diagnostics. The diagnostic event calendar contains the same 365 UTC dates; caller-provided legacy heatmap density cannot affect it. Canonical repository IDs are accumulated safely, including `constructor` and `__proto__`.

These APIs are additive. V6 scalar aggregation stays explicitly legacy. S09 still owns core eligibility, component-specific bounds, qualifying activity calendar and arithmetic; S15 must route live consumers through v7. This report does not claim the live score has already switched or that an empty review qualifies for a core dimension.

## Independent review and corrections

Implementation workers and reviewers used GPT-6 Astra. S02's independent review found and verified fixes for partial-page replay cursors, aggregate/component coverage contradictions, closure attribution, branch-purpose inference, historical review discovery coverage and empty-approval semantics. S06's independent review found and verified fixes for field/event provenance strengthening, partial micro-change measurements and prototype-key numeric corruption. Its dedicated reuse/quality/efficiency review recommended the safe accumulator and no broader refactor. Both scoped implementations received final compliance approval before integration gates.

## Local verification

- S02 scoped: `apps/web/lib/github/evidence.test.ts`, `queries.test.ts`, `stats.test.ts`: 58 tests passed, including 19 adapter fixtures.
- S06 scoped: `packages/shared/src/scoring-aggregation-v7.test.ts`, `stats-aggregation.test.ts`, `platform-stats.test.ts`, `apps/web/lib/github/merge.test.ts`: 153 tests passed.
- TDD regression failures and subsequent passing runs are retained in `logs/scoring-v7/s06-*.log`; S02's worker recorded 8 failing review regressions before the corrected 19-test adapter run.
- `pnpm run typecheck`: passed.
- `pnpm run lint`: passed.
- `pnpm run test`: 517 files / 8,562 tests passed.
- `pnpm exec vitest run --coverage --maxWorkers=4`: passed unchanged thresholds; statements 95.93%, branches 91.90%, functions 95.16%, lines 97.46%.
- `pnpm run test:coverage:scripts`: passed. These two coverage commands execute both parts of the repository coverage gate sequentially.
- `pnpm run check:circular`: passed.
- `pnpm run build`: passed.
- Full integration logs: `logs/scoring-v7/s02-s06-*.log`. No schema changes were made in these phases.

No remote CI, push, PR, hosted deployment or production data operation was performed. Changes were made in scoring-owned isolated worktrees; the separate redesign worktree and SEO files were preserved.
