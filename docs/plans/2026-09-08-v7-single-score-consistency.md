# Impact v7: one reproducible score and consistent presentation

Date: 2026-09-08. Status: owner authorized `/implement` on 2026-09-08; phase 1 complete locally; owner authorized continuous implementation of phases 2–9, local develop merge and worktree cleanup. No remote action authorized. Planning baseline: local `develop` at `0c75fdc46705c7bdf0539e7d9027e11f76172d15`. Research: [pre-launch evidence audit](../research/2026-09-08-prelaunch-evidence-audit.md). Workflow: `.claude/commands/plan.md`. Planning/review agents: GPT-6 Astra only, as requested.

## What the owner has decided

1. Show **one clear 0–100 score**, not a displayed range.
2. Preserve the familiar dimension names: **Delivery, Quality, Consistency, Breadth, Craft**. No archetype renaming or badge redesign in this work.
3. A first correct CC insights report **visually unlocks Craft as the fifth badge/radar dimension and the fifth breakdown card**. Four axes before an eligible report, five after. A valid measured zero still unlocks Craft.
4. Craft is report-derived and separate **mathematically**: it contributes zero to the four-dimension core average. “Separate” does not mean hidden from the radar.
5. Archetype availability needs later product review. Preserve the existing eligibility behavior; do not silently assign, remove or rename archetypes to resolve this plan.
6. Clear calculation, independent reproduction and correctness are paramount. All surfaces must agree on the policy, revision, values and interpretation they display.
7. Production/hackathon stays v6. Work locally, no Preview, push, PR, deploy, production migration, flag change or recompute during this implementation. The documented judging boundary is September 21; passing that date is not release authorization.
8. Score continuity with v6 is not a requirement. The owner explicitly accepts changes such as 80 → 46: this is an early product with few users. Do not tune formulas to preserve existing users' numbers. Prioritize a common policy and scale, fair treatment of equivalent evidence, defensible inputs and straightforward independent reproduction. This accepts numerical change, not an untested claim that the proposed policy is already fair.

## Proposed numerical rules — explicit planning decisions

These details are recommendations made concrete for review, not claims that the owner previously approved the exact constants. The owner explicitly selected report-derived Craft; the core recorded-evidence choice is the planner's recommended default. Approval to implement this plan would accept the policy in [policy.md](2026-09-08-v7-single-score-consistency-phases/policy.md).

**Core:** calculate the existing four fixed-weight logarithmic dimensions from qualifying evidence actually recorded. Keep missing-source coverage as explanation/receipt metadata, not estimated score credit. Do not use a midpoint, reweight the available dimensions, or silently reuse v6 confidence/recency adjustments.

For the archived owner fixture, the proposed policy yields **46**, replacing the v7 display **46–100**; the historical v6 score was **80**. The owner explicitly accepts that kind of change. Its observed dimensions are approximately **87 / 0 / 48 / 50**. “Quality 0” means no credited Quality evidence in this receipt, not zero actual quality. Actual new evidence can change this example; it is not a promised live score.

**Craft:** score the report's outcome classifications with fixed credits 1 / 0.7 / 0.3 / 0 for fully / mostly / partially / not achieved, divided by total report sessions. Unknown/unclassified sessions receive no credited outcome contribution and are disclosed, never described as proven failures. No recognized outcomes or no sessions means insufficient data, not a fabricated zero. Satisfaction, tool choice, tokens, lines, files, speed and usage volume are diagnostics only. This is a reproducible report-derived measure, not verified ability or a human-reviewed practice portfolio.

**Presentation:** normal scores remain integers. At a core tier boundary where rounding would show a number in the next tier, use a single finite decimal number truncated to two decimal places, trimming trailing zeroes (69.999 → 69.99 Solid). Preserve exact calculation in the receipt. No `<70`, range or independently rounded second headline. This retains existing unrounded tier thresholds without displaying “70 Solid.”

**Version:** public product name remains Impact v7; new machine policy/algorithm revision is `v7.2`. Existing `v7`/algorithm `v7.1` receipts remain immutable and independently replayable. Current pages do not reinterpret old ranges as point receipts.

Alternatives considered: keeping v6 formulas and only adding replay would preserve the old incentives and composite behavior; averaging range endpoints would invent credit; assigning a new archetype from incomplete observations would preempt the deferred archetype discussion. This plan chooses none of those alternatives.

## Current state and implementation boundaries

| Boundary | Current behavior / evidence | Planned destination |
|---|---|---|
| Core | `apps/web/lib/impact/v7.ts:68` calculates endpoint bounds | Add an observed-point calculator; preserve the pinned historical engine |
| Receipt | `packages/shared/src/score-receipt.ts:8` strictly pins v7.1 | Strict version registry, independent new replay, old bytes retained |
| Craft upload | `apps/web/lib/insights/use-insights-import.ts:130` uses legacy parser/contract; `apps/web/app/api/insights/route.ts:65` v7 path is diagnostics-only | Familiar upload publishes a reproducible report-derived Craft result |
| Craft evidence | `apps/web/lib/db/craft-v7.ts:57` separates reports from assessed episodes | New report-derived channel; never synthesize independently assessed episodes from HTML |
| Radar | `apps/web/lib/render/BadgeSvg.tsx:226` permits Craft only for v6 | Presence of a scored Craft projection, including zero, controls the fifth axis |
| Breakdown | `apps/web/components/SharePageOwnerContent.tsx:187` always passes legacy impact | Same point projection as badge, API and receipt |
| Issuance | `apps/web/lib/profile/issue-receipt.ts:32` ensures verification only on newly issued receipts | Repair verification on stored receipts without creating a revision |
| Verification | `apps/web/lib/profile/badge-verification.ts:25` rereads latest | Bind to materialized exact policy/revision/hash |
| Revision lineage | `supabase/migrations/043_scoring_v7_receipt_history.sql:24` requires exact reference-time match for corrections | New observation/policy = new family; explicit correction retains reference context |
| Cached images | `apps/web/app/u/[handle]/badge.svg/route.ts:473` returns before policy read | Shared bounded selection before read/write; policy keys and bounded edge freshness |
| Tools | `apps/web/app/studio/StudioClient.tsx:558` passes only legacy impact | Policy-aware simulations, explanations, comparisons and verification |
| Release | `docs/release/scoring-v7-release-packet.md:81` assumes Preview allowed after approval | Executable local-candidate proof plus separately authorized production proof; no Preview |

## Non-goals and compatibility

- No redesign of the Ice Terminal layout, palette controls, typography, dimension names or archetype catalog. Restore the familiar optional fifth-axis behavior, not a new visual concept.
- No population fairness claims, human pilot fabrication or automatic external reviewer recruitment. The prior owner decision to proceed without the empirical pilot remains a documented limitation.
- No collector rewrite, new external provider, LLM call or AI reassessment at replay time. Reuse existing evidence eligibility/deduplication rules.
- Do not relabel v6 outputs as v7. Unconsented/non-receipted profiles keep an explicitly identified legacy fallback until a valid publication path exists; all their surfaces must remain consistent. This plan does not silently enroll everyone into evidence publication.
- No editing already-applied migrations or historically hashed policy/engine bytes. Add migrations only where the new policy-filtered read/publication contract needs them.
- Preserve legacy clients and archived receipts through explicit version dispatch. New UI uses the new contract; it never interprets a legacy response as current.
- Preserve publication consent, raw-report privacy, revocation, local-isolation guards and intentional history version segmentation.

## Phases and dependency order

| Phase | Scope | Depends on | Batch |
|---|---|---|---|
| [1](2026-09-08-v7-single-score-consistency-phases/phase-1.md) | Policy, shared contract foundation and local contract harness | — | Sequential |
| [2](2026-09-08-v7-single-score-consistency-phases/phase-2.md) | Pure observed-core calculator and oracle fixtures | 1 | [batch-eligible] with 3 |
| [3](2026-09-08-v7-single-score-consistency-phases/phase-3.md) | Pure report-derived Craft calculator and selection | 1 | [batch-eligible] with 2 |
| [4](2026-09-08-v7-single-score-consistency-phases/phase-4.md) | Strict receipts, independent replay, durable lineage and verification recovery | 2 + 3 | Sequential |
| [5](2026-09-08-v7-single-score-consistency-phases/phase-5.md) | Upload publication, fixed-context materialization and image rollback | 4 | Sequential |
| [6](2026-09-08-v7-single-score-consistency-phases/phase-6.md) | Badge, fifth Craft axis, breakdown, Studio and human explanations | 5 | Sequential |
| [7](2026-09-08-v7-single-score-consistency-phases/phase-7.md) | APIs, tools, comparisons, history, leaderboard, admin and email | 6 | Sequential |
| [8](2026-09-08-v7-single-score-consistency-phases/phase-8.md) | Executable no-Preview release proof and active documentation | 7 | Sequential |
| [9](2026-09-08-v7-single-score-consistency-phases/phase-9.md) | Final local gates, focused browser acceptance and handoff | 8 | Sequential |

Only 2/3 are batch-eligible: their new pure calculator/test files are disjoint and consume the frozen phase-1 types. Root owns later shared exports and integration. No agent runs broad tests concurrently. Batch eligibility permits a later `/batch` execution; it does not silently authorize skipping phase stops.

## Verification and git discipline

Implementation uses isolated local worktrees/temporary branches. Follow implement → review → fix → dedicated simplification review → verification. Use only GPT-6 Astra for implementation/review delegation. The owner explicitly authorized continuing through all remaining phases without stopping, then merging locally into develop and cleaning up the worktrees. Keep review and verification gates between phases.

At every phase run applicable targeted red/green regressions, then sequential typecheck, lint and the repository's unit/script suite; run local contracts whenever shared receipt, migration, RPC or durable-write behavior changes. Do not retry unrelated browser matrices per phase. After phases 2/3 in parallel, root runs combined gates once after local integration. Add coverage/build checks earlier if that phase specifically changes their contract.

On the completed candidate, run the full applicable local CI selection, coverage, local contract suite, lint, typechecks, migration/registration/security/license checks, production build and budget. Execute the required local automated browser selection once, including new point/Craft/rollback tests. Reuse prior broad visual screenshots except the changed views. Never treat skipped live-production checks as local passes.

Keep all work local through phase 9. Merge completed verified work into local `develop` without touching `main`. No push/PR during this plan; any later integration push requires local gates and read-only confirmation that it cannot create a Preview. Production remains separately explicitly authorized. No remote CI debugging loop.

## Executable acceptance contract

The plan's checkable artifacts are specified in [acceptance.md](2026-09-08-v7-single-score-consistency-phases/acceptance.md). The main fixture intentionally supplies contradictory legacy dimensions/Craft so accidental fallback is detectable.

For a fixed new-policy receipt, the same current display must be found in SVG, OG renderer input, share breakdown, Studio preview, profile/insights APIs, leaderboard, tool output and downloadable receipt. Simulations identify themselves as hypothetical; history identifies its observation/revision. Neither may masquerade as the current score.

The manual card is deliberately small: report upload unlocks the fifth axis; zero still unlocks; every scored surface agrees; save changes the public palette and restores it; Spanish 320 px/normal phone width remain usable; flag-only rollback with active consent converges without deleting receipts. A layout/coverage score from the prior E2E campaign is not evidence for a new scoring seam.

## Audit disposition

| Audit item | Resolution phase |
|---|---|
| FE-B1 mixed profile versions | 6, tested end-to-end in 9 |
| BE-H1 verification retry; exact-revision race concern | 4 |
| BE-M1 semantic identity and clock/family mismatch | 4 |
| DO-H1 image rollback | 5, accepted in 9 |
| AS-H1 tool semantics | 7 |
| UX-M1 Studio Save copy | 6 |
| QA-M1 contract failures/final gate evidence | 1 and 9 |
| DO-M1 no-Preview procedure mismatch | 8 |
| New owner requirements: point headline + report-derived visible Craft | 1–7 |

Existing cold-render latency and slow consent issuance remain measured limitations; this plan does not claim to have solved provider latency. Keep prior accepted soft-404 and unrelated cleanup items in their existing disposition. Historical reports remain historical; new receipts/proof never rewrite their claims.

## Deliverables and completion

Detailed phase files, policy, acceptance matrix and the [Astra planning review record](2026-09-08-v7-single-score-consistency-phases/planning-validation.md) live beside this plan. Implementation will add new immutable fixtures and local evidence under `quality/evidence/` or a phase-owned evidence directory, with exact commit/tree and command status. No secrets/raw private reports enter committed artifacts.

The owner authorized implementation after reviewing the proposal and accepting score changes. Execute one phase at a time under the implementation gate; production remains v6.

## Implementation progress

- [x] Phase 1: policy/shared contracts and local harness — Astra-reviewed and verified in `/Users/juan/code/chapa-v7-point`, local `feature/v7-point-consistency`. No runtime switch. Local report: `docs/agents/v7-point-phase1-report.md` in that worktree.
- [x] Phase 2: observed-core calculator — targeted arithmetic/evidence regressions and independent review passed; combined local gates with phases 3–4 passed.
- [x] Phase 3: report-derived Craft calculator/selection — 43 targeted tests and independent review passed; combined local gates passed.
- [x] Phase 4: strict receipts, independent replay, durable lineage and verification recovery — independent review/fix loops completed; 9,483 unit tests and 181 local contracts passed, plus typecheck, lint, build, bundle and migration checks.
- [x] Phase 5: upload publication, shared selection and image rollback — independent compliance/quality reviews passed; 9,544 full unit tests plus 107 final delta tests, 195 local contracts, typecheck, lint, build, bundle, migration and write-registration checks passed.
- [x] Phase 6: badge, fifth Craft axis and human explanations — independent reviews, 9,578 unit tests, 195 local contracts, typecheck/lint/build/bundle and real-font raster checks passed; focused interactive acceptance is consolidated in phase9.
- [x] Phase 7: remaining scored consumers — independent Astra reviews, 9,627 unit tests, 197 local contracts, typecheck/lint/build/bundle, migration and write-registration gates passed. Current values, identity, report periods and legacy isolation are verified.
- [x] Phase 8: local release proof and active documentation — schema2/manifest/local-server identity and no-Preview workflow validated; independent Astra reviews, 9,693 unit tests, typecheck/lint/build/bundle and release-doc/config gates passed. Historical schema1 and frozen scoring artifacts preserved.
- Phase 9: disposable local qualification tooling and focused acceptance are implemented with the final candidate. Execution, manual results, local merge and cleanup status are recorded in the gitignored `docs/agents/v7-single-score-acceptance-report.md`; keeping that evidence outside the tracked tree preserves the qualified commit/build identity.
