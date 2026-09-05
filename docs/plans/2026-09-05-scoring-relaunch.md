# Chapa scoring relaunch implementation plan

Date:2026-09-05
Status: Approved for implementation of all phases on 2026-09-05; phases 1, 2, 3, 5, 6, 7, 9 and 10 verified; S07 supplemental evidence verified; S08 source integrity pending; S12 receipts and S13 history verified; S14 verification pending; phase 4 supported code verified with issue-API amendment pending; all remaining tasks remain required before relaunch.
Source baseline: develop @ c1ce31cbf5969ee400c4cf232d67cf7dc1b1de0d (three local commits ahead of origin/develop at initial inspection).
Audit: [Mathematics and validity audit](../research/2026-09-05-scoring-mathematics-and-validity-audit.md).
Normative policy: [v7 implementation policy](2026-09-05-scoring-relaunch-phases/policy.md).

## Objective and authorized scope

Resolve every finding from the audit before relaunch: mathematical correctness, source attribution, fair treatment of AI and different working contexts, outcome/practice evidence, reproducible receipts, truthful public claims, independent evaluation and safe migration. There is no post-launch/later bucket. F01–F53 have explicit owners, acceptance artifacts and GitHub tasks; task priority expresses implementation order, not permission to omit an item.

The user has now authorized implementation of all phases in isolated worktrees and local integration into develop. The code freeze forbids every GitHub push. No PR, workflow dispatch, preview, external outreach or production mutation is authorized. Planning and review agents are GPT-6 Astra only. Existing local scoring-adjacent fixes #1287/#1294 are preserved as regression dependencies, not duplicated.

## Confirmed product decisions and selected design

The user explicitly approved:
- A fixed four-dimension core score.
- Optional Craft as a separate profile.
- Attributable quality/outcome evidence alongside the core.
- AI use, optional insights disclosure and tool choice never penalize the core.
- Every audit issue is mandatory before relaunch.

Selected implementation proposal: use explicit evidence-completion ranges when coverage is incomplete, not fabricated missing values. This is the recommended default presented during planning; the completed plan is reviewed by the user before implementation.

The policy appendix specifies exact formulas, counts, eligibility, window, rounding, ranges, rubric, archetypes, Craft, privacy and validation. It is a normative v7 redesign rather than a claim that new weights have already been empirically validated.

Options considered:
| Approach | Trade-off | Decision |
|---|---|---|
| Patch v6 math while retaining mixed denominators and tool-volume mastery claims | Smaller diff; leaves identified comparability and validity defects | Rejected |
| Fixed core with separate Craft and explicit outcome/practice evidence | Comparable arithmetic and honest evidence limits; requires schema/collector/UI migration | Selected; user approved structure |
| Remove headline scoring and publish only evidence | Avoids scalar trade-offs; changes the approved product shape | Not selected |
| Fill unknown quality with zero or renormalize available dimensions | Always produces a point; missing visibility changes meaning or penalizes unavailable data | Rejected in favor of explicit ranges |

No normative option can prove universal fairness by construction. The relaunch promise is a fully reproducible declared index plus transparent evidence, with a completed pilot and published limitations. Validation failure blocks relaunch; it cannot be reclassified as future work.

## Policy summary

Core=(Delivery+QualityPractices+Consistency+Breadth)/4, each0–100, fixed weights0.25. Craft, confidence heuristics, AI/tool provenance, solo classification, LOC and global recency do not enter the core. Full definitions live in policy.md and must not be reinterpreted independently by workers.

- Delivery counts accepted-work project/days, capped through log normalization at120.
- Quality practices counts evidence-qualified rationale, verification, resolved review/debugging and outcome follow-up, four equal components capped at12 items each.
- Consistency counts active UTC ISO weeks, saturating at40; annual cadence is not ability or sustainable behavior.
- Breadth combines qualifying projects and supported work categories, equal halves capped at4; no popularity or reserved/uncollected weights.
- Craft is separate optional evidence of framing, verification/debugging, tool judgment and accepted outcomes, capped at8 episodes per criterion. AI usage diagnostics give no automatic mastery credit. Choosing or avoiding delegation can both show good judgment.
- Unknown evidence yields conservative completion bounds with fixed denominators, never a statistical confidence interval or midpoint. Qualified semantic assessments retain accountable evaluators, source/rubric versions and limitations.
- One reference instant,365 UTC calendar dates, deduplicated source events and complete public calculation inputs make each emitted receipt replayable.

## GitHub execution tracker

Epic: [#1295: scoring relaunch](https://github.com/juan294/chapa/issues/1295). All child issues carry the launch-blocker label.

| Task | Phase | GitHub issue |
|---|---|---|
| S01 | 1 | [#1296: Freeze the v7 scoring policy and versioned evidence contracts](https://github.com/juan294/chapa/issues/1296) |
| S02 | 2 | [#1297: Collect correctly attributed GitHub events across the scoring window](https://github.com/juan294/chapa/issues/1297) |
| S03 | 3 | [#1298: Correct GitLab event semantics, date filters and partial-data handling](https://github.com/juan294/chapa/issues/1298) |
| S04 | 4 | [#1299: Correct Bitbucket attribution, event dates and nested pagination](https://github.com/juan294/chapa/issues/1299) |
| S05 | 5 | [#1300: Correct Codeberg activity units, contributed-repository discovery and event windows](https://github.com/juan294/chapa/issues/1300) |
| S06 | 6 | [#1301: Aggregate event evidence with correct pooled ratios, medians and deduplication](https://github.com/juan294/chapa/issues/1301) |
| S07 | 8 | [#1302: Age supplemental evidence correctly and migrate the upload contract](https://github.com/juan294/chapa/issues/1302) |
| S08 | 8 | [#1303: Replace productivity-based corruption guards with source-coverage integrity](https://github.com/juan294/chapa/issues/1303) |
| S09 | 9 | [#1304: Implement the fixed core scoring policy and AI-neutral fairness invariants](https://github.com/juan294/chapa/issues/1304) |
| S10 | 7 | [#1305: Make Craft an optional evidence-based AI engineering profile](https://github.com/juan294/chapa/issues/1305) |
| S11 | 10 | [#1306: Implement attributable outcome and engineering-practice evidence](https://github.com/juan294/chapa/issues/1306) |
| S12 | 11 | [#1307: Provide immutable score receipts and an independent offline calculator](https://github.com/juan294/chapa/issues/1307) |
| S13 | 11 | [#1308: Persist replayable snapshots and correct trend smoothing](https://github.com/juan294/chapa/issues/1308) |
| S14 | 11 | [#1309: Verify the complete issued receipt without overstating authenticity](https://github.com/juan294/chapa/issues/1309) |
| S15 | 12 | [#1310: Materialize one scoring receipt across APIs, badges and simulations](https://github.com/juan294/chapa/issues/1310) |
| S16 | 13 | [#1311: Render the fixed core, separate Craft and exact evidence explanations](https://github.com/juan294/chapa/issues/1311) |
| S17 | 13 | [#1312: Publish accurate bilingual methodology, claims and worked examples](https://github.com/juan294/chapa/issues/1312) |
| S18 | 14 | [#1313: Validate mathematical invariants, fairness and outcome evidence before relaunch](https://github.com/juan294/chapa/issues/1313) |
| S19 | 15 | [#1314: Rehearse version migration, cache transition and transparent score changes locally](https://github.com/juan294/chapa/issues/1314) |
| S20 | 15 | [#1315: Close every scoring relaunch requirement and prepare the release handoff](https://github.com/juan294/chapa/issues/1315) |

## Work distribution and dependency graph

The contract/database foundation lands first. Phases2–7 are **[batch-eligible]**: each reads the frozen phase1 contract and owns non-overlapping files; none requires another phase2–7 worker's output. Their pure contract fixtures allow independent development. They integrate before phase8's source orchestration. Phase9 and10 also consume phase6 but are not marked batch-eligible here; execute explicitly in the documented order unless a later reviewed schedule proves disjoint ownership.

| Phase | Scope | Tasks | Prerequisite phases | Parallel eligibility |
|---|---|---|---|---|
| 1 | [Policy, contracts and database foundation](2026-09-05-scoring-relaunch-phases/phase-1.md) | S01 | none | sequential |
| 2 | [GitHub evidence adapter](2026-09-05-scoring-relaunch-phases/phase-2.md) | S02 | 1 | [batch-eligible] after phase1 |
| 3 | [GitLab evidence adapter](2026-09-05-scoring-relaunch-phases/phase-3.md) | S03 | 1 | [batch-eligible] after phase1 |
| 4 | [Bitbucket evidence adapter](2026-09-05-scoring-relaunch-phases/phase-4.md) | S04 | 1 | [batch-eligible] after phase1 |
| 5 | [Codeberg evidence adapter](2026-09-05-scoring-relaunch-phases/phase-5.md) | S05 | 1 | [batch-eligible] after phase1 |
| 6 | [Exact aggregation](2026-09-05-scoring-relaunch-phases/phase-6.md) | S06 | 1 | [batch-eligible] after phase1 |
| 7 | [Optional Craft evidence](2026-09-05-scoring-relaunch-phases/phase-7.md) | S10 | 1 | [batch-eligible] after phase1 |
| 8 | [Durable aging and source integrity](2026-09-05-scoring-relaunch-phases/phase-8.md) | S07, S08 | 2, 3, 4, 5, 6 | sequential |
| 9 | [Core scoring engine](2026-09-05-scoring-relaunch-phases/phase-9.md) | S09 | 6 | sequential |
| 10 | [Outcome and practice evidence ledger](2026-09-05-scoring-relaunch-phases/phase-10.md) | S11 | 6 | sequential |
| 11 | [Offline replay, immutable history and verification](2026-09-05-scoring-relaunch-phases/phase-11.md) | S12, S13, S14 | 7, 9, 10 | sequential |
| 12 | [Unified materialization and APIs](2026-09-05-scoring-relaunch-phases/phase-12.md) | S15 | 8, 11 | sequential |
| 13 | [Badge, explanations and public methodology](2026-09-05-scoring-relaunch-phases/phase-13.md) | S16, S17 | 12 | sequential |
| 14 | [Independent fairness and validity evaluation](2026-09-05-scoring-relaunch-phases/phase-14.md) | S18 | 13 | sequential |
| 15 | [Migration rehearsal and relaunch handoff](2026-09-05-scoring-relaunch-phases/phase-15.md) | S19, S20 | 14 | sequential |

Within phases8,11,13,15, tasks execute in listed dependency order. One worker owns schema/contracts; an adapter worker must request a contract amendment rather than editing shared definitions concurrently. One integration worker owns profile/materialization changes; receipt/Craft workers export functions and fixtures until that integration phase. Design work consumes the scored view model through the existing single renderBadgeSvg artifact and coordinates its files with the redesign owner.

Implementation uses isolated worktrees/temporary branches from local develop, the project's atomic implement→review→fix→approve→simplify→verify loop, and stops after each phase unless explicitly authorized to continue. Central integration/push ownership applies. The git-workflow skill governs implementation mechanics; no worker pushes independently. Existing issue bodies describe a local publication freeze; plan tasks remain local until the user explicitly authorizes publication and remote triggers are rechecked.

## Required acceptance evidence

Every task requires:
1. Regression/property fixtures specified in its phase file, authored before or alongside implementation.
2. A review of actual final changes and boundary behavior, followed by simplify/reuse review.
3. Sequential local verification appropriate to touched code, including full repository checks at phase integration.
4. Recorded passing output and coverage row links. Existing tests asserting incorrect behavior must be changed to the declared policy, not retained as evidence of correctness.
5. No open audit finding, silently dropped field, unapproved new constant, fake empirical claim or unrecorded change to the policy.

Automated: targeted tests; full tests/typecheck/lint; coverage including scoring/integrity floors; local DB contracts/RLS/migrations; independent calculator parity; actual SVG/PNG/local browser flows; source/window/range/AI invariants; generated EN/ES examples; cache and mixed-version rehearsal.

Manual/domain evaluation: approve the completed policy, assess the evidence rubric, conduct/adjudicate the prespecified pilot and review empirical limitations, inspect meaningful badge evidence states and the final score-transition explanation. Real reviewer/data availability is a named implementation dependency of S18, not an unresolved algorithm decision and not permission to fabricate completion.

## Every finding is required

- **F01** Contribution events mislabeled as commits → [S02](https://github.com/juan294/chapa/issues/1297), [S03](https://github.com/juan294/chapa/issues/1298), [S05](https://github.com/juan294/chapa/issues/1300).
- **F02** Opened/repository-wide issues mislabeled as personal closures → [S02](https://github.com/juan294/chapa/issues/1297), [S04](https://github.com/juan294/chapa/issues/1299).
- **F03** Teammate history credited as personal work → [S02](https://github.com/juan294/chapa/issues/1297).
- **F04** External contributed repositories omitted → [S02](https://github.com/juan294/chapa/issues/1297), [S05](https://github.com/juan294/chapa/issues/1300).
- **F05** Daily events substituted for ten-minute commit bursts → [S06](https://github.com/juan294/chapa/issues/1301).
- **F06** Breadth weights total95%, unequal scale → [S09](https://github.com/juan294/chapa/issues/1304).
- **F07** Docs-only scoring signal never collected → [S06](https://github.com/juan294/chapa/issues/1301).
- **F08** Mean of medians is not pooled median → [S06](https://github.com/juan294/chapa/issues/1301).
- **F09** Quality ratios weighted by wrong population → [S06](https://github.com/juan294/chapa/issues/1301).
- **F10** Missing measurements and merge order change ratios → [S06](https://github.com/juan294/chapa/issues/1301).
- **F11** Maximum source ratios mislabeled as pooled ratios → [S06](https://github.com/juan294/chapa/issues/1301).
- **F12** Concentration merges incompatible units → [S06](https://github.com/juan294/chapa/issues/1301).
- **F13** Cross-source event/repository overlaps double counted → [S06](https://github.com/juan294/chapa/issues/1301), [S07](https://github.com/juan294/chapa/issues/1302).
- **F14** GitHub merge window uses creation time → [S02](https://github.com/juan294/chapa/issues/1297).
- **F15** Linked-provider event windows and timestamps inconsistent → [S03](https://github.com/juan294/chapa/issues/1298), [S04](https://github.com/juan294/chapa/issues/1299), [S05](https://github.com/juan294/chapa/issues/1300).
- **F16** Supplemental annual totals never age out → [S07](https://github.com/juan294/chapa/issues/1302), [S19](https://github.com/juan294/chapa/issues/1314).
- **F17** Craft reports never age out/latest upload overwrites evidence → [S10](https://github.com/juan294/chapa/issues/1305), [S19](https://github.com/juan294/chapa/issues/1314).
- **F18** Legitimate direct-push/issue-only/empty profiles treated as corrupt → [S08](https://github.com/juan294/chapa/issues/1303), [S15](https://github.com/juan294/chapa/issues/1310).
- **F19** Final annual PR expiring to zero rejected → [S08](https://github.com/juan294/chapa/issues/1303).
- **F20** Mixed-state sampled PRs falsely prove corruption → [S08](https://github.com/juan294/chapa/issues/1303).
- **F21** Server token assumed universally private-inclusive → [S08](https://github.com/juan294/chapa/issues/1303).
- **F22** Hard caps/samples treated as complete annual observations → [S02](https://github.com/juan294/chapa/issues/1297), [S03](https://github.com/juan294/chapa/issues/1298), [S05](https://github.com/juan294/chapa/issues/1300).
- **F23** Provider failures/diff errors become valid partials/zeros → [S03](https://github.com/juan294/chapa/issues/1298), [S04](https://github.com/juan294/chapa/issues/1299), [S08](https://github.com/juan294/chapa/issues/1303).
- **F24** Missing response time earns maximum credit → [S10](https://github.com/juan294/chapa/issues/1305).
- **F25** Accepted overflow produces NaN/out-of-domain arithmetic → [S10](https://github.com/juan294/chapa/issues/1305).
- **F26** Rounded EMA stalls; same-day feedback and missing-day policy → [S13](https://github.com/juan294/chapa/issues/1308), [S19](https://github.com/juan294/chapa/issues/1314).
- **F27** Ambient clocks prevent historical determinism → [S01](https://github.com/juan294/chapa/issues/1296), [S12](https://github.com/juan294/chapa/issues/1307), [S15](https://github.com/juan294/chapa/issues/1310).
- **F28** Published normalization examples wrong → [S17](https://github.com/juan294/chapa/issues/1312).
- **F29** Quality displayed breakdown omits actual formula path → [S16](https://github.com/juan294/chapa/issues/1311), [S17](https://github.com/juan294/chapa/issues/1312).
- **F30** LOC-never-scored claim false → [S17](https://github.com/juan294/chapa/issues/1312).
- **F31** Headline smoothing and convergence claims false → [S17](https://github.com/juan294/chapa/issues/1312).
- **F32** Solo Quality Champion eligibility copy conflicts with code → [S16](https://github.com/juan294/chapa/issues/1311), [S17](https://github.com/juan294/chapa/issues/1312).
- **F33** Solo/review-ratio denominator creates score cliff → [S01](https://github.com/juan294/chapa/issues/1296), [S09](https://github.com/juan294/chapa/issues/1304), [S18](https://github.com/juan294/chapa/issues/1313).
- **F34** Optional Craft disclosure changes core scale and can lower score → [S01](https://github.com/juan294/chapa/issues/1296), [S09](https://github.com/juan294/chapa/issues/1304), [S15](https://github.com/juan294/chapa/issues/1310), [S16](https://github.com/juan294/chapa/issues/1311), [S18](https://github.com/juan294/chapa/issues/1313).
- **F35** PR splitting and tiny-useful-change/LOC incentives → [S09](https://github.com/juan294/chapa/issues/1304), [S18](https://github.com/juan294/chapa/issues/1313).
- **F36** Missing attributable outcomes, quality, design, mentoring and maintenance → [S11](https://github.com/juan294/chapa/issues/1306), [S18](https://github.com/juan294/chapa/issues/1313).
- **F37** Craft volume/tool-style rewards overclaim mastery and quality → [S10](https://github.com/juan294/chapa/issues/1305), [S17](https://github.com/juan294/chapa/issues/1312), [S18](https://github.com/juan294/chapa/issues/1313).
- **F38** Craft excellence/Artificer with zero observed effectiveness → [S10](https://github.com/juan294/chapa/issues/1305), [S18](https://github.com/juan294/chapa/issues/1313).
- **F39** Entropy evenness misrepresented as tool breadth/mastery → [S10](https://github.com/juan294/chapa/issues/1305), [S18](https://github.com/juan294/chapa/issues/1313).
- **F40** Confidence heuristic confuses evidence coverage with ability/probability → [S01](https://github.com/juan294/chapa/issues/1296), [S09](https://github.com/juan294/chapa/issues/1304), [S17](https://github.com/juan294/chapa/issues/1312), [S18](https://github.com/juan294/chapa/issues/1313).
- **F41** Self-report authentication confused with truth/attestation → [S10](https://github.com/juan294/chapa/issues/1305), [S11](https://github.com/juan294/chapa/issues/1306), [S18](https://github.com/juan294/chapa/issues/1313).
- **F42** Tiny samples/classification uncertainty treated as reliable rates → [S10](https://github.com/juan294/chapa/issues/1305), [S11](https://github.com/juan294/chapa/issues/1306), [S18](https://github.com/juan294/chapa/issues/1313).
- **F43** Unknown outcome labels/unclassified sessions/likely-satisfied semantics → [S10](https://github.com/juan294/chapa/issues/1305), [S18](https://github.com/juan294/chapa/issues/1313).
- **F44** Unsupported percentile calibration and research-derived claims → [S17](https://github.com/juan294/chapa/issues/1312), [S18](https://github.com/juan294/chapa/issues/1313).
- **F45** Snapshots/export lack versioned complete replay inputs → [S12](https://github.com/juan294/chapa/issues/1307), [S13](https://github.com/juan294/chapa/issues/1308), [S14](https://github.com/juan294/chapa/issues/1309), [S15](https://github.com/juan294/chapa/issues/1310), [S19](https://github.com/juan294/chapa/issues/1314).
- **F46** Signed Craft lost in persisted verification record → [S14](https://github.com/juan294/chapa/issues/1309), [S19](https://github.com/juan294/chapa/issues/1314).
- **F47** HMAC/valid link overstated as source truth or SVG tamper detection → [S14](https://github.com/juan294/chapa/issues/1309), [S17](https://github.com/juan294/chapa/issues/1312).
- **F48** API mixes fresh score/stored dimensions; consumer/simulation drift → [S12](https://github.com/juan294/chapa/issues/1307), [S13](https://github.com/juan294/chapa/issues/1308), [S15](https://github.com/juan294/chapa/issues/1310), [S16](https://github.com/juan294/chapa/issues/1311), [S19](https://github.com/juan294/chapa/issues/1314).
- **F49** Sparse/dense heatmaps change consistency → [S06](https://github.com/juan294/chapa/issues/1301), [S18](https://github.com/juan294/chapa/issues/1313).
- **F50** Tenure/role/private-work availability conflated with ability → [S01](https://github.com/juan294/chapa/issues/1296), [S09](https://github.com/juan294/chapa/issues/1304), [S17](https://github.com/juan294/chapa/issues/1312), [S18](https://github.com/juan294/chapa/issues/1313).
- **F51** Metadata presence/empty approvals/irrelevant CI are weak quality evidence → [S09](https://github.com/juan294/chapa/issues/1304), [S11](https://github.com/juan294/chapa/issues/1306), [S18](https://github.com/juan294/chapa/issues/1313).
- **F52** Lifetime owner popularity mistaken for individual annual influence → [S06](https://github.com/juan294/chapa/issues/1301), [S09](https://github.com/juan294/chapa/issues/1304), [S11](https://github.com/juan294/chapa/issues/1306), [S18](https://github.com/juan294/chapa/issues/1313).
- **F53** Subdimension weight/rounding declarations and absent-vs-zero ambiguity → [S10](https://github.com/juan294/chapa/issues/1305), [S12](https://github.com/juan294/chapa/issues/1307), [S16](https://github.com/juan294/chapa/issues/1311), [S17](https://github.com/juan294/chapa/issues/1312).

Additional existing issues are retained: #1287 (durable supplemental publication) is locally fixed at the baseline and is a regression dependency of S07; #1294 (simulation recency) is locally fixed and is preserved through S15's versioned simulation migration. Do not reopen/reimplement those fixes just because the public issue remains open.

## Safety, transition and launch gate

All public score consumers switch atomically by receipt version. Preserve v6 archives, label non-replayable legacy records truthfully, segment trend versions, use additive schema and versioned caches, and provide idempotent local dry-run transition/rollback procedures. Do not grandfather erroneous numbers as current v7 merely to avoid visible score changes.

The checked-in release playbook at docs/release/release-playbook.md:85 requires Vercel Preview proof. The user's global policy forbids preview deployments and overrides that workflow. S20 must prepare a concrete documented local artifact-verification replacement and preserve the remaining release gates before publication. Do not run the conflicting preview step or silently waive it. No new hosted services, broad monitoring system, CI-debugging loop or generic release infrastructure is part of this plan.

Before future publication, run every applicable local gate and inspect GitHub/Vercel triggers; if a push would create a preview, use the documented non-destructive disable/bypass path or stop before pushing. Production deployment, migration and recomputation require separately explicit authorization. develop→main release uses a merge-commit PR; main is never a development branch.

## Planning validation

Planning review must check: all53 findings covered; all20 tasks have executable acceptance criteria; DAG is acyclic; batch files do not overlap; new tables precede their route users; core and Craft disclosure invariants hold; range semantics are mathematical bounds; pilot claims stay within evidence; no production action is implied by issue completion.

The associated issue manifest is maintained in this phase directory. GitHub issues are self-contained so workers can use them even before local plan docs are published. Independent GPT-6 Astra review resolved range containment, tier-rounding boundaries, held-out agreement, EMA assumptions, private evidence projection, acceptance-event timestamps, consumer ownership and usable evidence workflows. No remaining planning blockers were reported. Implementation of all phases is authorized; production release remains a separate decision.
