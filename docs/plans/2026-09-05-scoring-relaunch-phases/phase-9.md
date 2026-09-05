# Phase 9: Core scoring engine

Prerequisites: phase 6.
Policy authority: [policy.md](policy.md). Parent: [scoring relaunch](../2026-09-05-scoring-relaunch.md).
This phase is mandatory before relaunch. Stop after verified completion unless the user authorizes continuation. All implementation/review agents for this work must use GPT-6 Astra.

## S09: Implement the fixed core scoring policy and AI-neutral fairness invariants

GitHub: [#1304](https://github.com/juan294/chapa/issues/1304).

Worker role: backend. Depends on: S01, S06.
Audit requirements: F06, F33, F34, F35, F40, F50, F51, F52.

Problem and resulting behavior:
Implement the policy appendix with a fixed four-dimension denominator, separate Craft, explicit evidence bounds, full precision internals and published rounding. Remove AI/generated-volume penalties, review/PR threshold switches, LOC magnitude rewards, legacy multiplicative confidence and activity-timing multipliers from v7. Preserve v6 historical interpretation. Make every dimension's intended bounds and archetype rules explicit.

Exclusive implementation ownership (adjacent source tests included):
- apps/web/lib/impact/v7.ts (new)
- apps/web/lib/impact/v6.ts:361 (legacy adapter only)
- apps/web/lib/impact/utils.ts:119
- apps/web/lib/impact/recency.ts:23
- apps/web/lib/impact/heatmap-evenness.ts:69
- packages/shared/src/scoring.ts:7
- packages/shared/src/constants.ts:13

Pseudocode contract:
```text
read frozen v7 policy and prerequisite evidence/contracts
write failing fixtures for each acceptance criterion below
implement only S09's owned behavior against the shared contract
preserve immutable input identity, coverage and reference context
review; correct every finding; simplify; verify sequentially
record exact artifacts and stop; do not push or deploy
```

Automated/checkable acceptance:
- [ ] Same engineering evidence with AI/manual provenance, tool choice or report disclosure gives bit-identical core outputs.
- [ ] The two-to-three-review counterexample cannot drop because of profile classification; additional valid review evidence is monotone.
- [ ] All dimension weights total exactly one and endpoints are attainable under the declared input model.
- [ ] One-line useful fixes and deletions do not lose eligibility solely due to size; same-project/day splitting and duplicate references do not multiply Delivery units; cross-day/project manipulation is separately measured in S18.
- [ ] Missing evidence widens the disclosed range without changing the denominator or substituting zero quality.
- [ ] Policy constants are labeled design choices; archetypes describe evidence shape, not certified seniority.

Manual/domain acceptance:
- [ ] An independent reviewer reconciles this task with policy.md and the cited audit cases.
- [ ] Any semantic/data-source limitation is visible in evidence coverage and public claims.
- [ ] No task criterion is moved past relaunch or closed with an unimplemented placeholder.


## Sequential local verification

Run the owned adjacent tests using `pnpm exec vitest run <explicit-owned-test-paths>`; record the exact paths in the implementation report. At phase integration run sequentially: `pnpm run typecheck`, `pnpm run lint`, `pnpm run test`, and `pnpm run build`. For schema/write changes also run `pnpm run validate:migrations`, `pnpm run check:write-registration` and `pnpm run test:contract:local` against disposable local Supabase before build. Scoring changes additionally run `pnpm run test:coverage`; import changes run `pnpm run check:circular`. Do not run checks concurrently.

Final readiness also requires repository license/vulnerability and SVG/PNG/browser verification. No hosted CI or preview is a test environment. Missing prerequisites, failed checks and policy contradictions return to their owner before completion.
