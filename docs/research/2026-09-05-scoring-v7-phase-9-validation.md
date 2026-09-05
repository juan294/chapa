# Scoring v7: core engine validation

Scope: S09 / #1304. Implementation originated in the isolated `feature/scoring-v7-engine` worktree. Independent review, simplify and full integration checks passed; S09 is verified. This document does not authorize relaunch or claim empirical fairness validation.

The arithmetic entrypoint `calculateCoreV7` accepts the frozen count contract only. `computeImpactV7` composes the private normalized engineering evidence adapter with that arithmetic. Optional reports, Craft, tool names, AI disclosure, tenure, popularity, changed-line magnitude and legacy confidence multipliers do not enter the core.

Evidence derives accepted-work project/date buckets, four distinct-work-item practice counts, qualifying UTC ISO weeks, and projects/categories with three supported dates. Incomplete coverage yields conservative bounds in each component's units. An unknown acceptance date can occupy one additional week/date per deduplicated work item; it cannot fill every week by itself. Missing delivery collection over known repositories uses the possible project/date buckets, while unknown repository discovery can reach the component ceiling. Actual observed counts are retained separately from capped arithmetic inputs.

The registered ledger projection must supply active claim revision IDs and complete assessment revision chains as of the reference instant. The engine validates revision continuity, resolves correction/retraction, requires the published rubric, evaluator identity/version, rationale and evidence references, and never treats an unassessed item as demonstrated practice. Opposing assessments of the same claim remain unknown. Practice activity is tied to matching artifact references, so one assessment cannot credit unrelated later review dates.

Targeted fixtures currently cover full-scale reachability using actual normalized evidence, no-AI/AI/tool/report invariance, the two-to-three-review cliff, same-project/day splitting, deletion and tiny changes, exact precision/tiers, interval containment, date-specific coverage, expiry and UTC calendars, source attribution, duplicate upload/order invariance, accepted-result methods, category evidence, and versioned assessment corrections. Coverage thresholds remain unchanged. Final command results and independent review findings will be recorded only after those gates run.

The implementation initially failed three additional regressions: one missing project/day inflated Delivery's upper bound to 120; unresolved acceptance time could understate possible active weeks; and unaccepted implementation-only activity could establish known Consistency. The corrected count derivation passes those regressions. The first scoped coverage run also exposed insufficient branch coverage; additional accepted-result, stale-period and category-evidence cases pass the existing scoring floor.

An initial independent GPT-6 Astra review found that unresolved aliases cannot supply known independent-work minima, that old practice verdicts must not be rejuvenated by unrelated current events on the same work item, and that self-reported acceptance dates cannot constrain possible completions as trusted facts. Each finding now has a regression and a correction. Sources marked `alias_unresolved` remain in possible evidence but are withheld from known minima until identity resolution. Accepted/rejected quality verdicts require matching in-window artifact support; an old rejection leaves unrelated new evidence unknown. Unverified acceptance dates remain flexible, and a known future acceptance cannot enter current Delivery.

Two additional mirror-date regressions initially failed: later equivalent acceptances inflated possible Consistency/Breadth dates, and a recent mirror could rejuvenate an old canonical acceptance. The shared aggregation output now retains verified acceptance selections even outside the scoring window, and the engine excludes their later equivalent acceptance copies from scoring activity while keeping the diagnostic observations. This additive private output reuses the existing equivalence resolver rather than duplicating identity resolution in the engine.

The review also found that resolving two possibly aliased repositories with two dates each can create one qualifying four-date project. An upper bound based only on their separate buckets was too low. Unresolved source identity therefore uses the policy's conservative project ceiling, while known minima withhold the affected source. The new containment fixture failed before that correction and passes afterward.

The review's simplify suggestion was applied: accepted-event and per-work lookups use Maps, avoiding repeated full-event scans. The independent GPT-6 Astra reviewer approved the final delta and simplify pass. All 103 targeted tests pass (63 engine and 40 aggregation) across `apps/web/lib/impact/v7.test.ts`, `apps/web/lib/impact/v7-evidence.test.ts`, and `packages/shared/src/scoring-aggregation-v7.test.ts`.

## Sequential local gates

- Targeted engine/aggregation tests: 103 passed.
- `pnpm run typecheck`: passed.
- `pnpm run lint`: passed.
- `pnpm run test`: 521 files / 8,667 tests passed.
- `pnpm exec vitest run --coverage --maxWorkers=4`: passed unchanged thresholds; statements 95.53%, branches 91.31%, functions 95.42%, lines 97.50%.
- `pnpm run test:coverage:scripts`: passed.
- `pnpm run check:circular`: passed.
- `pnpm run build`: passed.

Logs: `logs/scoring-v7/s09-*.log`. No schema changes, remote CI, push, PR, hosted deployment or production data operation. Public routing and UI adoption remain mandatory S15/S16 work, and empirical validation remains mandatory S18 work.
