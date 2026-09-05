# Phase 5: Codeberg evidence adapter

Prerequisites: phase 1.
**[batch-eligible]** after phase 1; exclusive files below may not overlap other batch workers.
Policy authority: [policy.md](policy.md). Parent: [scoring relaunch](../2026-09-05-scoring-relaunch.md).
This phase is mandatory before relaunch. Stop after verified completion unless the user authorizes continuation. All implementation/review agents for this work must use GPT-6 Astra.

## S05: Correct Codeberg activity units, contributed-repository discovery and event windows

GitHub: [#1300](https://github.com/juan294/chapa/issues/1300).

Worker role: backend. Depends on: S01.
Audit requirements: F01, F04, F15, F22.

Problem and resulting behavior:
Collect authored commits and dated merge/review/closure events; remove merged-PR-count-as-repo-commits and heatmap-as-commits substitutions. Include observed contributed repositories beyond owned repositories, or expose the discovery gap. Implement shared coverage and pagination semantics.

Exclusive implementation ownership (adjacent source tests included):
- apps/web/lib/codeberg/queries.ts:101
- apps/web/lib/codeberg/types.ts
- apps/web/lib/codeberg/stats.ts
- apps/web/lib/codeberg/stats-aggregation.ts
- apps/web/lib/codeberg/*.test.ts

Pseudocode contract:
```text
read frozen v7 policy and prerequisite evidence/contracts
write failing fixtures for each acceptance criterion below
implement only S05's owned behavior against the shared contract
preserve immutable input identity, coverage and reference context
review; correct every finding; simplify; verify sequentially
record exact artifacts and stop; do not push or deploy
```

Automated/checkable acceptance:
- [ ] An MR-only event never increments authored commits.
- [ ] Review and closure attribution/date fixtures pass independently of merge date.
- [ ] The 51st repository is traversed or explicitly partial.
- [ ] Old work ages out using event timestamps.
- [ ] Equivalent normalized events yield provider-independent aggregates.

Manual/domain acceptance:
- [ ] An independent reviewer reconciles this task with policy.md and the cited audit cases.
- [ ] Any semantic/data-source limitation is visible in evidence coverage and public claims.
- [ ] No task criterion is moved past relaunch or closed with an unimplemented placeholder.


## Sequential local verification

Run the owned adjacent tests using `pnpm exec vitest run <explicit-owned-test-paths>`; record the exact paths in the implementation report. At phase integration run sequentially: `pnpm run typecheck`, `pnpm run lint`, `pnpm run test`, and `pnpm run build`. For schema/write changes also run `pnpm run validate:migrations`, `pnpm run check:write-registration` and `pnpm run test:contract:local` against disposable local Supabase before build. Scoring changes additionally run `pnpm run test:coverage`; import changes run `pnpm run check:circular`. Do not run checks concurrently.

Final readiness also requires repository license/vulnerability and SVG/PNG/browser verification. No hosted CI or preview is a test environment. Missing prerequisites, failed checks and policy contradictions return to their owner before completion.
