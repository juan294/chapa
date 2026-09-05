# Phase 4: Bitbucket evidence adapter

Prerequisites: phase 1.
**[batch-eligible]** after phase 1; exclusive files below may not overlap other batch workers.
Policy authority: [policy.md](policy.md). Parent: [scoring relaunch](../2026-09-05-scoring-relaunch.md).
This phase is mandatory before relaunch. Stop after verified completion unless the user authorizes continuation. All implementation/review agents for this work must use GPT-6 Astra.

## S04: Correct Bitbucket attribution, event dates and nested pagination

GitHub: [#1299](https://github.com/juan294/chapa/issues/1299).

Worker role: backend. Depends on: S01.
Audit requirements: F02, F15, F23.

Problem and resulting behavior:
Use account IDs and actual merge/closure/review state events, rather than repository totals or updated_on. Collect only subject-attributed closures and reviews, including reviews on still-open changes. Preserve coverage for repository discovery, diffstats and every nested pagination call.

Exclusive implementation ownership (adjacent source tests included):
- apps/web/lib/bitbucket/queries.ts:115
- apps/web/lib/bitbucket/types.ts:46
- apps/web/lib/bitbucket/stats.ts
- apps/web/lib/bitbucket/stats-aggregation.ts
- apps/web/lib/bitbucket/*.test.ts

Pseudocode contract:
```text
read frozen v7 policy and prerequisite evidence/contracts
write failing fixtures for each acceptance criterion below
implement only S04's owned behavior against the shared contract
preserve immutable input identity, coverage and reference context
review; correct every finding; simplify; verify sequentially
record exact artifacts and stop; do not push or deploy
```

Automated/checkable acceptance:
- [ ] Another user's resolved issue supplies no subject closure credit.
- [ ] updated_on changes alone cannot move a merge/closure into the year.
- [ ] A page-two 429/error reports partial observations and retains a valid prior without silently publishing a lower complete total.
- [ ] Missing usernames still work through stable account IDs.
- [ ] Cross-provider canonical fixtures reconcile exactly where capabilities are equivalent.

Manual/domain acceptance:
- [ ] An independent reviewer reconciles this task with policy.md and the cited audit cases.
- [ ] Any semantic/data-source limitation is visible in evidence coverage and public claims.
- [ ] No task criterion is moved past relaunch or closed with an unimplemented placeholder.


## Sequential local verification

Run the owned adjacent tests using `pnpm exec vitest run <explicit-owned-test-paths>`; record the exact paths in the implementation report. At phase integration run sequentially: `pnpm run typecheck`, `pnpm run lint`, `pnpm run test`, and `pnpm run build`. For schema/write changes also run `pnpm run validate:migrations`, `pnpm run check:write-registration` and `pnpm run test:contract:local` against disposable local Supabase before build. Scoring changes additionally run `pnpm run test:coverage`; import changes run `pnpm run check:circular`. Do not run checks concurrently.

Final readiness also requires repository license/vulnerability and SVG/PNG/browser verification. No hosted CI or preview is a test environment. Missing prerequisites, failed checks and policy contradictions return to their owner before completion.
