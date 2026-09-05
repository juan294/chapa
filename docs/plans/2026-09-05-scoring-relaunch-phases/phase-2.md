# Phase 2: GitHub evidence adapter

Prerequisites: phase 1.
**[batch-eligible]** after phase 1; exclusive files below may not overlap other batch workers.
Policy authority: [policy.md](policy.md). Parent: [scoring relaunch](../2026-09-05-scoring-relaunch.md).
This phase is mandatory before relaunch. Stop after verified completion unless the user authorizes continuation. All implementation/review agents for this work must use GPT-6 Astra.

## S02: Collect correctly attributed GitHub events across the scoring window

GitHub: [#1297](https://github.com/juan294/chapa/issues/1297).

Worker role: backend. Depends on: S01.
Audit requirements: F01, F02, F03, F04, F14, F22.

Problem and resulting behavior:
Replace calendar-as-commits, opened-as-closed issues and unfiltered repository histories with subject-attributed timestamped events. Discover observed external contributions. Fetch merged changes by merge time, actual submitted reviews and closure actors, complete changed-path data for documentation, and explicit per-connection coverage. Bound API work and retain cursors/coverage when incomplete.

Exclusive implementation ownership (adjacent source tests included):
- packages/shared/src/github-query.ts:17
- apps/web/lib/github/queries.ts:26
- apps/web/lib/github/stats.ts:40
- apps/web/lib/github/queries.test.ts
- apps/web/lib/github/stats.test.ts

Pseudocode contract:
```text
read frozen v7 policy and prerequisite evidence/contracts
write failing fixtures for each acceptance criterion below
implement only S02's owned behavior against the shared contract
preserve immutable input identity, coverage and reference context
review; correct every finding; simplify; verify sequentially
record exact artifacts and stop; do not push or deploy
```

Automated/checkable acceptance:
- [ ] An unresolved issue opening earns zero closed-issue credit; another actor closing an issue is not the subject's closure.
- [ ] Teammate commits cannot change subject repository depth or concentration; observed external contributions are included.
- [ ] A PR opened before the window and merged inside it is included; review time is independent of PR merge time.
- [ ] 101st PR and provider search ceilings are processed through pagination/partitioning or reported partial, never presented as complete.
- [ ] Missing/null/restricted nodes and mid-page errors preserve unknown coverage; mixed contribution types do not become commits.

Manual/domain acceptance:
- [ ] An independent reviewer reconciles this task with policy.md and the cited audit cases.
- [ ] Any semantic/data-source limitation is visible in evidence coverage and public claims.
- [ ] No task criterion is moved past relaunch or closed with an unimplemented placeholder.


## Sequential local verification

Run the owned adjacent tests using `pnpm exec vitest run <explicit-owned-test-paths>`; record the exact paths in the implementation report. At phase integration run sequentially: `pnpm run typecheck`, `pnpm run lint`, `pnpm run test`, and `pnpm run build`. For schema/write changes also run `pnpm run validate:migrations`, `pnpm run check:write-registration` and `pnpm run test:contract:local` against disposable local Supabase before build. Scoring changes additionally run `pnpm run test:coverage`; import changes run `pnpm run check:circular`. Do not run checks concurrently.

Final readiness also requires repository license/vulnerability and SVG/PNG/browser verification. No hosted CI or preview is a test environment. Missing prerequisites, failed checks and policy contradictions return to their owner before completion.
