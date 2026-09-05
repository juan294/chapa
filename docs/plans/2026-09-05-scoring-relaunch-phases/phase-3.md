# Phase 3: GitLab evidence adapter

Prerequisites: phase 1.
**[batch-eligible]** after phase 1; exclusive files below may not overlap other batch workers.
Policy authority: [policy.md](policy.md). Parent: [scoring relaunch](../2026-09-05-scoring-relaunch.md).
This phase is mandatory before relaunch. Stop after verified completion unless the user authorizes continuation. All implementation/review agents for this work must use GPT-6 Astra.

## S03: Correct GitLab event semantics, date filters and partial-data handling

GitHub: [#1298](https://github.com/juan294/chapa/issues/1298).

Worker role: backend. Depends on: S01.
Audit requirements: F01, F15, F22, F23.

Problem and resulting behavior:
Emit the shared evidence contract using actual authored commits, merge/closure/review event timestamps and stable identities. Remove MR-count-as-commit and generic-event-as-commit substitutions. Reviewer assignment/current approver lists cannot stand in for dated submitted reviews. Carry failed/truncated diffs and pagination status rather than zeroing measurements.

Exclusive implementation ownership (adjacent source tests included):
- apps/web/lib/gitlab/queries.ts:107
- apps/web/lib/gitlab/types.ts
- apps/web/lib/gitlab/stats.ts
- apps/web/lib/gitlab/stats-aggregation.ts:33
- apps/web/lib/gitlab/*.test.ts

Pseudocode contract:
```text
read frozen v7 policy and prerequisite evidence/contracts
write failing fixtures for each acceptance criterion below
implement only S03's owned behavior against the shared contract
preserve immutable input identity, coverage and reference context
review; correct every finding; simplify; verify sequentially
record exact artifacts and stop; do not push or deploy
```

Automated/checkable acceptance:
- [ ] Old merge/new review and new merge/old review fixtures count only the eligible events.
- [ ] Review endpoint permission/tier restrictions produce unavailable evidence, never zero reviews.
- [ ] Failed or truncated diff retrieval never becomes a zero-line PR or measured docs-only result.
- [ ] More than ten review candidates are processed within the shared budget or visibly partial.
- [ ] Platform-equivalent event fixtures match GitHub normalized semantics.

Manual/domain acceptance:
- [ ] An independent reviewer reconciles this task with policy.md and the cited audit cases.
- [ ] Any semantic/data-source limitation is visible in evidence coverage and public claims.
- [ ] No task criterion is moved past relaunch or closed with an unimplemented placeholder.


## Sequential local verification

Run the owned adjacent tests using `pnpm exec vitest run <explicit-owned-test-paths>`; record the exact paths in the implementation report. At phase integration run sequentially: `pnpm run typecheck`, `pnpm run lint`, `pnpm run test`, and `pnpm run build`. For schema/write changes also run `pnpm run validate:migrations`, `pnpm run check:write-registration` and `pnpm run test:contract:local` against disposable local Supabase before build. Scoring changes additionally run `pnpm run test:coverage`; import changes run `pnpm run check:circular`. Do not run checks concurrently.

Final readiness also requires repository license/vulnerability and SVG/PNG/browser verification. No hosted CI or preview is a test environment. Missing prerequisites, failed checks and policy contradictions return to their owner before completion.
