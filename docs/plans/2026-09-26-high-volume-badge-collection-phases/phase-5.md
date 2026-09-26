# Phase 5: Recover, disclose, and prove 100k end to end

Depends on: Phase 4. Batch: sequential.

## Red tests first

Add a worker fault matrix around `finishCollectionJob`: one transient timeout; repeated timeouts with no progress; failure after the database committed but before the response; expired/stale lease; a later successful claim; and a fan-in failure after completion. Existing `runCollectionTick` only captures rejected slices and leaves the job running (`apps/web/lib/collection/worker.ts:490-505`), while the explicit `failJob` path owns the P2 collection alert (`worker.ts:270-287`). A test must prove both safety and eventual recovery/disclosure, not just absence of a false receipt.

## Implementation

```ts
try {
  const outcome = await finishCollectionJob(lease, args);
  if (outcome.status === "ok") await fanInOnJobComplete(...);
} catch (error) {
  await failJob(lease, storageStop("finish"), boundedBackoff(job.attempt));
  // Terminal result uses existing failed-job alert and owner action-needed state.
}
```

Distinguish a storage/finish failure from a provider API failure in the diagnostic union, SQL validators, telemetry, and localized owner copy. If the response is lost after commit, read the durable job/observation state before retrying; an identical completion returns the stored observation, never a second one. After bounded no-progress attempts, move to `failed`, emit a deduplicated P2 alert, and show the owner a specific message and Retry/support path. Preserve the rate-limit and transient progress-reset semantics from migration 058. The first score still has no score-bump email under the current notification contract (`apps/web/lib/collection/fan-in.ts:89-125`); the status UI is the recovery surface.

Raise the per-source limit to 100,000 only after the Phase 2-4 contracts and benchmark pass. Apply the same cap to checkpoint, finish, row/page read, and TypeScript validation; a single mismatched bound is a release blocker. For 100,001 events, `event_limit` is terminal and visible; owner Retry alone cannot fix it while the cap remains. Give that state specific owner copy and an operator alert rather than the generic retry loop. Keep `ready` tied to a current durable receipt, with earlier receipt freshness disclosed while a new run is in progress (`apps/web/lib/collection/status.ts:36-108`).

Update `apps/web/e2e/helpers/scoring-point-fixtures.ts:113-217` for the generation model and run the receipt/status E2E checks. Extend `scripts/delete-user.ts:62-79` and `scripts/clone-prod-db.ts:45` to account for new private tables; add withdrawal/deletion contracts. Update `docs/runbooks/scoring-collection-queue.md` with the new limit, paged storage, timeout alert, cleanup, and recovery query. Correct its stale statement that all retries clear checkpoints (`docs/runbooks/scoring-collection-queue.md:201` versus the migration-058 policy at `:65-84`). Update `CLAUDE.md`'s queue contract and the changelog once, in this phase.

## Success criteria

### Automated

- The full 100k single-provider and mixed-provider local run reaches `complete`, issues one v7.2 receipt, and renders matching profile/badge/OG/owner status from that receipt. The benchmark records all timing/memory/response budgets and passes the main plan's thresholds.
- Every stuck state in the main plan has a recovery-or-disclosure test. Repeated finish failures cannot remain healthy-looking at 99%; a later successful retry completes without recollecting all provider operations.
- Grants, withdrawal, user deletion, legacy observation read, same-day refresh, and generation cleanup pass real-stack contracts.
- Run the complete verification sequence in the main plan and record the exact SHA and exit status for each command.

### Manual, only after an authorized release

- Inspect the exact deployed commit/migration, production queue/receipt rows, and rendered public profile for the previously timed-out owner. Compare the result to the main plan's manual success criteria. No production write or release is authorized by completing this phase locally.
