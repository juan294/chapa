# Phase 1: Reproduce and budget the complete path

Depends on: none. Batch: sequential. Deliverable: a repeatable local benchmark and the baseline result, without a production code or schema change.

## Why

The production log identifies `scoring_collection_finish` as the timed-out statement, but not which operation inside it exceeded the budget. The present local 30k measurement used about 1.5 KB per event and covers finish and read only (`docs/runbooks/scoring-collection-queue.md:233-240`). The 12k contract test checks correctness, not production-like 17.5k/100k latency (`apps/web/lib/db/collection-queue.contract.test.ts:152-174`).

## Work

1. Add a deterministic synthetic fixture builder alongside the real-stack queue contract tests. Match the observed mix of commits, accepted changes, reviews, repositories, changed-file lists, and roughly 1.5 KB JSON size; disclose the exact shape and compressed/uncompressed byte counts in the result. Use generated identities only.
2. Add `scripts/benchmark-scoring-collection.ts` (or the repository's existing benchmark convention if found during implementation) to run, in order, 17,572, 50,000, and 100,000-event scenarios on disposable local Supabase. For each, time checkpoint batches, staged-key retrieval, SQL finish, source read, prior seed, and observed receipt issuance. Capture RPC response bytes and peak Node RSS. A baseline failure at 100k is expected under the current 50k cap; record it, do not relax the cap here.
3. On the local database only, profile `count`, ordered `jsonb_agg`, source-value validation, insert, and staged deletion as separate statements using transaction rollback where a write would otherwise persist. Follow [Supabase's local/nonproduction EXPLAIN guidance](https://supabase.com/docs/guides/database/debugging-performance); do not enable PostgREST explain on production.
4. Record the configured PostgREST statement timeout, cron duration, worker lease/slice budget, and function memory limit used by this deployment. The worker currently leases for 120 seconds and slices for up to 60 seconds (`apps/web/lib/collection/worker.ts:193-202`); the cron advertises 300 seconds (`apps/web/app/api/cron/collect-evidence/route.ts:7-36`). The benchmark's pass/fail thresholds derive from the measured configuration.
5. Save a compact result under this plan's `-phases/evidence/phase-1/`, including commands, local schema version, fixture checksum, timings, and the exact source SHA. Avoid real user data and credentials.

## Checkable artifacts

```ts
for (const count of [17_572, 50_000, 100_000]) {
  const events = fixture({ count, seed: 294 });
  assert(uniqueEngineeringEventKeys(events).size === count);
  measure("checkpoint", () => stageInBoundedBatches(events));
  measure("finish", () => finishOrRecordCurrentLimit());
  measure("read+seed+issue", () => readSeedAndIssueWhenFinishSucceeded());
  record({ count, bytes, wallMs, responseBytes, peakRss, config, sha });
}
```

## Success criteria

### Automated

- The fixture builder produces the same checksum on repeated runs; no live provider or production database is contacted.
- The 17,572 and 50,000 cases reproduce every existing contract boundary, and the 100,000 case records the expected current limit separately from any timeout or memory failure.
- A local SQL profile identifies the share of finish time in aggregate, validation, insert, and delete, or records that the local environment cannot separate them. No presumed root cause is reported as measured.

### Manual

- Review the baseline table against the production log before starting Phase 2. If a different boundary dominates or the synthetic shape is unrepresentative, stop and revise the plan.
