---
phase: 9D
release: v2.9.0
issues: ["#702", "#750"]
batch_eligible: true
effort: S
---

# Phase 9D — Warm-cache observability (`#702`, `#750`)

## Goal

Two related fixes in `apps/web/app/api/cron/warm-cache/route.ts`:

- **`#702`** — Surface which handles failed in the cron response payload,
  not just a count.
- **`#750`** — Move `cacheSet(ROTATION_KEY, nextOffset)` to AFTER
  `processInBatches` completes so a timeout doesn't advance the rotation
  past handles that were never warmed.

## Current state

- `processInBatches` already returns `{ succeeded, failed }` with
  per-item handles (verified in `apps/web/lib/async/process-in-batches.ts`)
- The cron route already extracts `warmFailures` and calls `captureServerError`
  per failed handle, but the JSON response only returns `failed: number`
- Rotation offset is written at line 98–103 BEFORE `processInBatches`
  starts (line 123)

## Pseudocode

```ts
// route.ts changes

// 1) Move rotation offset write to AFTER processInBatches (#750)
//    Delete the line at ~98-103 that writes ROTATION_KEY pre-batch.
//    Keep the read; replace the write with one after successful warm.

const previousOffset = await readRotationOffset();
const toWarm = pickHandles(allHandles, previousOffset, BATCH_COUNT);
const nextOffset = (previousOffset + toWarm.length) % allHandles.length;

const { succeeded: warmResults, failed: warmFailures } = await processInBatches(
  toWarm, BATCH_SIZE, async (handle) => { ... },
);

// Only advance rotation if at least one handle succeeded
if (warmResults.length > 0) {
  await cacheSet(ROTATION_KEY, nextOffset);
}

// 2) Surface failures[] in response (#702)
const failures = warmFailures.map(({ item, error }) => ({
  handle: item,
  reason: error.message,
}));
// Also include the per-result false-warmed entries
const softFailures = warmResults
  .filter(r => !r.warmed)
  .map(r => ({ handle: r.handle, reason: "warm returned false" }));

return NextResponse.json({
  warmed,
  failed: failures.length + softFailures.length,
  failures: [...failures, ...softFailures],
  // ... existing fields
});
```

## Files

- Modified: `apps/web/app/api/cron/warm-cache/route.ts`
- Modified: `apps/web/app/api/cron/warm-cache/route.test.ts` — add test
  cases for failure reporting and rotation-on-success

## Acceptance criteria

### Automated
- [ ] New test: simulate `processInBatches` returning 2 succeeded + 1 failed, assert `failures[]` length 1 with correct handle/reason
- [ ] New test: when `warmResults.length === 0`, `cacheSet(ROTATION_KEY)` is NOT called
- [ ] `pnpm run typecheck && pnpm run test && pnpm run lint` all pass

### Manual
- Hit `/api/cron/warm-cache` locally with a stubbed warmHandle that throws
  for one handle; verify response shows `{ failures: [{ handle, reason }] }`

## Closing the issues

```bash
gh issue close 702 --comment "Fixed in <sha>. Cron response now includes failures[] with handle and reason."
gh issue close 750 --comment "Fixed in <sha>. Rotation offset only advances after processInBatches succeeds for at least one handle."
```
