# Phase 3: Page source reads and prior-day reuse

Depends on: Phase 2. Batch: sequential.

## Red tests first

Add local DB/page contracts for exact and prior observations at 1,001 and 50,000 rows under the current cap, plus a synthetic 100,000-row published generation created directly in the disposable test database to exercise page reading before Phase 5 lifts the writer cap. Test duplicate/missing/overlapping pages, a withdrawn or changed link between pages, and a failed middle page. Add worker seed tests proving a large prior observation is filtered and restaged in bounded batches without materializing the old full array. Keep the current source-coordinator acceptance tests as authority checks (`apps/web/lib/platform/source-coordinator.acceptance.test.ts:1-100`).

## Implementation

```ts
readSourceManifest(context, prior): Promise<Manifest | null>;
readSourcePages(context, manifest): AsyncIterable<readonly NormalizedEngineeringEvent[]>;

for await (const page of readSourcePages(context, priorManifest)) {
  for (const event of page) if (insideWindow(event)) batch.push(event);
  if (batch.length >= PAGE_SIZE) await checkpointSeed(batch);
}
```

Page by `(generation_id,event_key)` with a keyset cursor and a fixed page size below PostgREST's 1,000-row response cap (`apps/web/lib/db/collection-queue.ts:269-284`). Bind every page to the selected immutable observation ID, generation ID, owner/source/access context, and current link version. Verify monotonically increasing keys, expected row count, and final digest/count before accepting the observation; a missing page is `source_error`, never a shorter complete source. A legacy JSONB observation uses the existing read RPC and validator, with an adapter that emits bounded pages to consumers. The supplemental writer stays on that legacy path.

Change `apps/web/lib/db/source-context.ts:22-110`, `apps/web/lib/platform/source-coordinator.ts:83-102`, and `apps/web/lib/collection/worker.ts:215-325` to use the manifest/page contract. Remove the repeated full staged-key scan from each slice (`apps/web/lib/db/collection-queue.ts:260-284`). Provider collectors keep a slice-local set for duplicates; database checkpoint insertion remains the durable cross-slice deduplication and still rejects a same-key/different-body conflict. Update the four provider seed tests and worker progress counts so a duplicate replay does not inflate `events` or change coverage.

Do not expose a current `complete` source to issuance until the entire selected observation has passed page validation. A prior observation retains its original window and `dataThrough`; the coordinator's stale/partial treatment remains (`apps/web/lib/platform/source-coordinator.ts:83-102`).

## Success criteria

### Automated

- The 100k synthetic read and the current-cap seed use fixed-size pages, no full response or staged-key list, and preserve the exact event key set and prior-window filter. Phase 5 proves a 100k seed through the public writer after lifting the cap.
- Page fault, deleted row, stale link, and interrupted seed are explicit unavailable/retry states. No partial receipt is issued; the next claim resumes the saved seed checkpoint or starts a new generation safely.
- Existing JSONB and supplemental observations still read identically; source-coordinator tests and DB contracts pass.
- Run targeted tests, `pnpm run typecheck`, `pnpm run lint`, then `pnpm run test:contract:local` sequentially.

### Manual

- None before a separately authorized release.
