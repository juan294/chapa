# Phase 6: Exact aggregation

Prerequisites: phase 1.
**[batch-eligible]** after phase 1; exclusive files below may not overlap other batch workers.
Policy authority: [policy.md](policy.md). Parent: [scoring relaunch](../2026-09-05-scoring-relaunch.md).
This phase is mandatory before relaunch. Stop after verified completion unless the user authorizes continuation. All implementation/review agents for this work must use GPT-6 Astra.

## S06: Aggregate event evidence with correct pooled ratios, medians and deduplication

GitHub: [#1301](https://github.com/juan294/chapa/issues/1301).

Worker role: backend. Depends on: S01.
Audit requirements: F05, F07, F08, F09, F10, F11, F12, F13, F49, F52.

Problem and resulting behavior:
Merge dated sufficient evidence before finalizing statistics. Use actual per-signal numerators/denominators, pooled lead-time observations, canonical repository identities and deduplicated events. Populate complete-path docs classification, dense calendars, correct authored-commit concentration and real timestamp burst diagnostics. Keep legacy scalar aggregates explicitly legacy.

Exclusive implementation ownership (adjacent source tests included):
- packages/shared/src/stats-aggregation.ts:39
- packages/shared/src/platform-stats.ts:90
- apps/web/lib/github/merge.ts:42
- packages/shared/src/scoring-aggregation-v7.ts (new)
- packages/shared/src/*aggregation*.test.ts
- apps/web/lib/github/merge.test.ts

Pseudocode contract:
```text
read frozen v7 policy and prerequisite evidence/contracts
write failing fixtures for each acceptance criterion below
implement only S06's owned behavior against the shared contract
preserve immutable input identity, coverage and reference context
review; correct every finding; simplify; verify sequentially
record exact artifacts and stop; do not push or deploy
```

Automated/checkable acceptance:
- [x] Pooled median of [1,1,1] and [2,100,100] is 1.5 hours.
- [x] Pooling measured 3/3, unmeasured 30, measured 0/3 is 0.5 for every order/parenthesization.
- [x] Duplicate source/event uploads are idempotent; same canonical repo across accounts counts once.
- [x] Micro/docs rates pool observations rather than taking maxima.
- [x] Sparse and dense calendars of identical events have identical results; daily spread does not imply a ten-minute burst.
- [x] Docs-only is unknown for partial/empty file lists; supported complete documentation changes receive evidence credit.

Manual/domain acceptance:
- [x] An independent reviewer reconciles this task with policy.md and the cited audit cases.
- [x] Any semantic/data-source limitation is visible in evidence coverage and public claims.
- [x] No task criterion is moved past relaunch or closed with an unimplemented placeholder.


## Sequential local verification

Run the owned adjacent tests using `pnpm exec vitest run <explicit-owned-test-paths>`; record the exact paths in the implementation report. At phase integration run sequentially: `pnpm run typecheck`, `pnpm run lint`, `pnpm run test`, and `pnpm run build`. For schema/write changes also run `pnpm run validate:migrations`, `pnpm run check:write-registration` and `pnpm run test:contract:local` against disposable local Supabase before build. Scoring changes additionally run `pnpm run test:coverage`; import changes run `pnpm run check:circular`. Do not run checks concurrently.

Final readiness also requires repository license/vulnerability and SVG/PNG/browser verification. No hosted CI or preview is a test environment. Missing prerequisites, failed checks and policy contradictions return to their owner before completion.

## Implementation validation

Verified on 2026-09-05; see [the S02/S06 validation report](../../research/2026-09-05-scoring-v7-phases-2-6-validation.md). V7 runtime routing remains the mandatory S15 dependency; core eligibility and bounds remain S09.
