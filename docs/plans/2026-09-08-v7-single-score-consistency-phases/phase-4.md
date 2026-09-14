# Phase 4 — Receipts, replay, lineage and verification recovery

Depends on phases2+3. Sequential. Closes BE-H1, BE-M1 and the exact-revision race concern with executed tests.

## Files

Read/modify `packages/shared/src/score-receipt.ts`, shared scoring unions/index, `apps/web/lib/profile/score-receipt-v7.ts`, `issue-receipt.ts`, `badge-verification.ts`, `apps/web/lib/db/snapshots.ts`, `apps/web/lib/history/snapshot.ts`, `apps/web/lib/cache/snapshot-cache.ts`, verification token/store adapters, and corresponding unit/contract tests. Add historical/current strict-contract modules, `receipt-semantic-identity.ts`, `scripts/scoring/reference-calculator-v7-observed.ts`, and new current receipt fixtures. Extend `scripts/scoring/reference-calculator.ts` dispatcher/tests and `docs/scoring-reproduction.md`.

Add `supabase/migrations/050_scoring_observed_policy_receipts.sql` if needed for policy-filtered manifest/current reads and current revision/trace storage. The next number was050 at planning; if another migration lands first, allocate the next unused number and update this plan's references. Never rewrite039–049. Preserve service-only privacy despite generic public-table grant examples in skills.

## Strict compatibility and independent replay

```text
registry[(v7,v7.1)] = preserved historical schema/rules/digests
registry[(v7.2,v7.2)] = new point+reportCraft schema/rules/digests
parse+seal+verify dispatch to exact registered pair
reject extra fields, unregistered identity and range score in new policy
```

Historical engines/policy bytes and their digest tests remain unchanged. New report-derived Craft is a strict discriminated variant, not old four-criterion practice data filled with invented values. Public trace includes only scoring-sufficient aggregate inputs and explicit provenance/coverage.

The new independent calculator implements core, Craft and display formulas itself, imports contracts/serialization only, and verifies every scalar intermediate plus labels. No production scorer import, clock, network, secret or fresh model inference. Old receipt CLI output still contains its original range; new receipt output is the defined point. Use the archived envelope as immutable evidence and create a separate current synthetic envelope from its recorded counts.

## Semantic and durable identity

```text
candidateSemantic = canonical(policy,algorithm,rules,windowDate,
  observedCounts,coverage,criteria,exclusions,limitations,
  selectedReport,core,craft,scalarTraces)
// exclude only incidental caller timestamps/allocated IDs; preserve genuine dataThrough
if samePolicy + sameDate + sameSemantic:
  reuse exact envelope (including its old referenceTime)
else if explicit correction of existing context:
  retain family+referenceTime, increment revision, supersede target
else:
  new family/referenceTime, revision1, no supersedes
```

Canonicalize set-like rows before receipt-local reference allocation; ordering alone must not create a revision. Publication storage must serialize concurrent identical candidates or retry against the winning current identity so concurrent refreshes cannot create two logical no-op roots. Do not weaken exact SQL lineage checks to hide bad application contexts. Policy-qualified latest reads and manifests prevent an old range-policy receipt from being selected as current v7.2. Trend anchors separate machine policies; same-day new observations use the preceding-day anchor.

## Verification recovery and binding

```text
materialize -> issued OR stored => ensureVerification(exact envelope)
verification failure => failed, retryable; durable receipt retained
stored + successful repair => skipped semantics preserved, same revision
render => read exact revision from materialized identity, validate policy/family/hash
          return token only if recorded issuance exists and is not revoked
```

Never reread latest to choose a token, issue from public reads, or mint a new revision just to repair verification. All failure outcomes remain observable. A withdrawal during repair is denied by the durable consent check.

## Automated acceptance

C11–C16, C19. Promote the two audit probes into permanent regressions. Use real local persistence for partial-write recovery and family races; mocked tests alone are insufficient.

- Historical envelope hash/replay unchanged; new envelope reproducible offline in two timezones and with clock advanced.
- Trace/label/algorithm/extra-field tampering rejected; no bounds coerced to false completeness.
- Publish receipt, fail verifier once, unchanged retry repairs same row; revoked retry never republishes.
- Materialized A/latest B returns token A, never B; missing recorded issuance gives no strip.
- Same counts but changed coverage/exclusion/provenance/report identity creates a revision/context correctly; mere clock/row ordering doesn't.
- New policy/date/reference observation forms a new family; explicit correction preserves exact reference time; concurrent identical requests converge without fabricated history.
- v6, historical v7.1 and new v7.2 coexist, verify and retain independent trend semantics.

```sh
pnpm exec vitest run packages/shared/src/scoring-observed.test.ts apps/web/lib/profile/score-receipt-v7.test.ts apps/web/lib/profile/issue-receipt.test.ts apps/web/lib/profile/badge-verification.test.ts scripts/scoring/reference-calculator.test.ts --no-file-parallelism
pnpm run test:contract:local
pnpm exec tsx --tsconfig tsconfig.scripts.json scripts/scoring/reference-calculator.ts docs/plans/2026-09-07-local-e2e-verification-phases/evidence/phase6/receipt-envelope.json
pnpm run validate:migrations
pnpm run typecheck
pnpm run lint
pnpm run test
```

New contract tests are automatically included in the full local selection. Build/replay fixtures use explicit local reference times. Do not touch production data/schema or enable runtime globally.

## Manual / stop

Inspect a redacted new receipt against policy and compare old/new CLI results. Show exact identity/recovery evidence. Stop; runtime upload/render integration follows separately.
