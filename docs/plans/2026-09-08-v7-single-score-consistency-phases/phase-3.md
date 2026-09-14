# Phase 3 — Pure report-derived Craft [batch-eligible]

Depends on phase1. May run alongside phase2; disjoint new calculator/test files only.

## Files and implementation

Read `apps/web/lib/insights/report-v7.ts:1`, `apps/web/lib/insights/scoring.ts:48`, `apps/web/lib/insights/scoring.ts:139`, `apps/web/lib/db/craft-v7.ts:57`. Own new `apps/web/lib/insights/report-craft.ts`, `report-craft.test.ts`, `report-craft-selection.ts`, `report-craft-selection.test.ts` and synthetic/public report fixtures. Do not edit existing parser, shared types/exports, upload routes, ledger or core engine in this parallel phase.

```text
validate(period, totals, numeric domains, known alias map)
classified = fully + mostly + partially + failed
unknown = supplied unknown labels + unclassified sessions
if totalSessions == 0 or classified == 0:
  insufficient_report_data
else:
  exact = 100*(fully + .7*mostly + .3*partially)/totalSessions
  return scored(point(exact), period, classified/totalSessions, provenance, trace)
```

Mapping is the closed table in policy.md. Reject duplicate labels/aliases after normalization before map construction; preserve unknown labels privately and only unknown-count aggregates publicly. Use unclassified=T−sum(all supplied outcome counts) and reject negative/unsafe totals. Do not infer category meaning from arbitrary text or use a model at runtime. Failed outcomes stay in the denominator. Unknown/unclassified inputs remain separately visible and earn no positive credit; do not call them failures. All counts/rates must be safe and finite. A fully recognized failed report scores0 and still qualifies for visual unlock.

Report selection is period-driven, not score-driven: newest eligible observation end/start, explicit same-period correction, exact digest duplicates idempotent. Do not pool overlapping reports or use upload time to refresh observation age. Return expired/historical/straddling/insufficient as explicit states. Re-uploaded older/insufficient reports cannot silently replace a current valid score; expose the reason/current selection in the result.

No proficiency/sophistication, Master/Expert, Artificer or independence claims are inferred from aggregate outcomes. Craft remains named Craft and is a visible optional dimension, but its explanation shows the actual outcome-credit arithmetic. The current report mechanism and historical assessed portfolio remain distinct contracts.

## Automated acceptance

C06–C10 and C18 in acceptance.md. Required exact fixture T10/F4/M2/P1/fail1/unknown1/unclassified1 gives57 and coverage8/10. Uniformly doubling reports leaves57. Tool/line/token/message/speed fields do not change score; recognized failure-only produces0; unknown-only or recognized keys with all zero counts produce insufficient. Impossible totals, future/reversed periods, unsafe counts, unknown aliases and malformed input have declared validation results. Raw text/private data never enters the public trace projection.

```sh
pnpm exec vitest run apps/web/lib/insights/report-craft.test.ts apps/web/lib/insights/report-craft-selection.test.ts --no-file-parallelism
```

Root integrates shared exports in phase4. Review invariants and run combined broad gates at that point; no external calls or report uploads in this phase.

## Manual / stop

Present the57 example and zero-versus-insufficient states. No UI change yet. Stop with pure implementation and scoped results; do not add a reviewer requirement or publish a report.
