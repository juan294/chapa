# Phase 5: Cron Rotation for All Users

## Goal
Fix the cron warm-cache to rotate through ALL registered users instead of always processing the first 50. This ensures every user eventually gets snapshot recording and score-change email notifications.

## Changes

### 5.1 Modify `apps/web/app/api/cron/warm-cache/route.ts`

Add rotation tracking via a Redis counter that stores the offset for the next cron run.

```pseudo
const ROTATION_KEY = "cron:warm-cache:offset";

// In GET handler, after discovering all handles:
const users = await dbGetUsers();
const allHandles = users.map((u) => u.handle);

// Get rotation offset (defaults to 0 if Redis unavailable or key missing)
const storedOffset = await cacheGet<number>(ROTATION_KEY);
const offset = storedOffset ?? 0;

// Slice from offset, wrapping around if needed
let toWarm: string[];
if (offset >= allHandles.length) {
  // Offset past end — reset to beginning
  toWarm = allHandles.slice(0, MAX_HANDLES);
} else if (offset + MAX_HANDLES > allHandles.length) {
  // Wraps around: take remaining + start from beginning
  const remaining = allHandles.slice(offset);
  const fromStart = allHandles.slice(0, MAX_HANDLES - remaining.length);
  toWarm = [...remaining, ...fromStart];
} else {
  toWarm = allHandles.slice(offset, offset + MAX_HANDLES);
}

// After processing, store the next offset
const nextOffset = (offset + MAX_HANDLES) % allHandles.length;
await cacheSet(ROTATION_KEY, nextOffset, 0);  // TTL=0 means no expiry

// ... rest of processing unchanged
```

### 5.2 Update response to include rotation info

```pseudo
return NextResponse.json({
  warmed,
  failed,
  snapshots,
  notifications,
  expiredVerificationsDeleted,
  total: toWarm.length,
  handles: toWarm,
  rotation: {
    offset,
    nextOffset,
    totalUsers: allHandles.length,
    coversAll: allHandles.length <= MAX_HANDLES,  // true if all users fit in one run
  },
  durationMs: Date.now() - start,
});
```

### 5.3 Behavior characteristics

- **First run after deploy**: offset=0 (Redis key doesn't exist), processes handles 0–49
- **Second run**: offset=50, processes handles 50–99
- **Wrap-around**: If there are 120 users and offset is 100, takes handles 100–119 + 0–29
- **Redis flush**: offset resets to 0, restarts from beginning — no data loss
- **User count < 50**: `coversAll: true`, offset always resets to 0 (all users covered every run)
- **User count grows**: New users are appended to the end of the list (ordered by `registered_at DESC`, so newest first). The rotation naturally reaches them.

**Note on ordering**: `dbGetUsers()` returns users ordered by `registered_at DESC` (newest first). This means the first batch always includes the newest users, which is good — new signups get their first snapshot quickly. The rotation ensures older users eventually get processed too.

## Tests

### `apps/web/app/api/cron/warm-cache/route.test.ts` — add tests:

1. **First run: offset starts at 0** — `cacheGet(ROTATION_KEY)` returns null, processes from index 0
2. **Subsequent run: reads stored offset** — `cacheGet` returns 50, slices from index 50
3. **Stores next offset after processing** — `cacheSet(ROTATION_KEY, nextOffset, 0)` called
4. **Wraps around at end of list** — 120 users, offset=100, processes 100–119 + 0–29
5. **Resets offset if past end** — offset=200 but only 80 users, resets to 0
6. **Response includes rotation metadata** — offset, nextOffset, totalUsers, coversAll

## Success Criteria

### Automated
- [x] All 7 new rotation tests pass (exceeded plan's 6 — added coversAll test)
- [x] Existing 27 cron tests still pass (backwards compatible)
- [x] `pnpm run typecheck` — no type errors
- [x] `pnpm run lint` — clean

### Manual
- [ ] Trigger cron locally: `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3001/api/cron/warm-cache`
- [ ] Verify response includes `rotation` object
- [ ] Trigger again — verify `offset` advanced by `MAX_HANDLES`
- [ ] With a small user set, verify `coversAll: true` and offset resets
