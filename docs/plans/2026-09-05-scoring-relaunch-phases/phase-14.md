# Phase 14: Independent fairness and validity evaluation

Prerequisites: phase 13.
Policy authority: [policy.md](policy.md). Parent: [scoring relaunch](../2026-09-05-scoring-relaunch.md).
This phase is mandatory before relaunch. Stop after verified completion unless the user authorizes continuation. All implementation/review agents for this work must use GPT-6 Astra.

## S18: Validate mathematical invariants, fairness and outcome evidence before relaunch

GitHub: [#1313](https://github.com/juan294/chapa/issues/1313).

Worker role: qa-reliability. Depends on: S02, S03, S04, S05, S06, S07, S08, S09, S10, S11, S12, S13, S14, S15, S16, S17.
Audit requirements: F33, F34, F35, F36, F37, F38, F39, F40, F41, F42, F43, F44, F49, F50, F51, F52.

Problem and resulting behavior:
Execute the prespecified validation protocol and independent mathematical review. Include every audit counterexample, matched AI/manual and platform/role/tenure/privacy scenarios, attribution and receipt round trips, splitting/gaming, missing-evidence sensitivity and an independently reviewed public/consented evidence pilot. Report observed failures, confidence limits and the limits of generalization; do not call fixtures empirical calibration.

Exclusive implementation ownership (adjacent source tests included):
- apps/web/lib/impact/v7-fairness.test.ts (new)
- scripts/scoring/validate-policy.ts (new)
- docs/research/scoring-v7-validation-protocol.md (new)
- docs/research/scoring-v7-validation-results.md (new)
- test/fixtures/scoring-v7/* (new)

Pseudocode contract:
```text
read frozen v7 policy and prerequisite evidence/contracts
write failing fixtures for each acceptance criterion below
implement only S18's owned behavior against the shared contract
preserve immutable input identity, coverage and reference context
review; correct every finding; simplify; verify sequentially
record exact artifacts and stop; do not push or deploy
```

Automated/checkable acceptance:
- [ ] Every F01–F53 requirement has a passing artifact or an implemented explicit policy resolution; no open item is relabeled later.
- [ ] All mandatory matched-pair invariants pass exactly; one-line/deletion/doc/reviewer/direct-push roles are represented.
- [ ] Independent calculator, production, displayed breakdowns and persisted receipts reconcile.
- [ ] Pilot evidence selection, rubric, sample size, reviewer agreement and disagreement resolutions are published without private data; percentile claims remain absent.
- [ ] Sensitivity report varies normative caps/weights and reports tier/archetype/range effects; failures block relaunch and return to the affected task.
- [ ] No empirical conclusion exceeds the pilot's coverage or treats cohort-level observations as proof about an individual.
- [ ] Held-out positive/negative-specific agreement, class counts/confusion matrices and useful-interval gates in policy.md pass; changed rubrics require fresh held-out items.

Manual/domain acceptance:
- [ ] An independent reviewer reconciles this task with policy.md and the cited audit cases.
- [ ] Any semantic/data-source limitation is visible in evidence coverage and public claims.
- [ ] No task criterion is moved past relaunch or closed with an unimplemented placeholder.


## Sequential local verification

Run the owned adjacent tests using `pnpm exec vitest run <explicit-owned-test-paths>`; record the exact paths in the implementation report. At phase integration run sequentially: `pnpm run typecheck`, `pnpm run lint`, `pnpm run test`, and `pnpm run build`. For schema/write changes also run `pnpm run validate:migrations`, `pnpm run check:write-registration` and `pnpm run test:contract:local` against disposable local Supabase before build. Scoring changes additionally run `pnpm run test:coverage`; import changes run `pnpm run check:circular`. Do not run checks concurrently.

Final readiness also requires repository license/vulnerability and SVG/PNG/browser verification. No hosted CI or preview is a test environment. Missing prerequisites, failed checks and policy contradictions return to their owner before completion.
