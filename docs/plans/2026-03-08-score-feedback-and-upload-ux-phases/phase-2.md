# Phase 2: Snapshot Replacement Infrastructure [batch-eligible]

> Add `dbReplaceSnapshot()` and `invalidateSnapshotCache()` — the backend plumbing for immediate score updates on deliberate user actions.

## Objective

Enable same-day snapshot replacement and cache invalidation so that score-affecting actions (insights upload, platform connect) can immediately update the displayed score.

## Changes

### 2.1 — Add `dbReplaceSnapshot()` (`apps/web/lib/db/snapshots.ts`)

Add after the existing `dbInsertSnapshot()` function (~line 231):

```typescript
/**
 * Replace today's snapshot for a user. Uses ON CONFLICT DO UPDATE
 * instead of DO NOTHING — overwrites all columns if a same-day row exists.
 *
 * Use this for deliberate user actions (insights upload, recalculate)
 * where the score has legitimately changed mid-day and the new snapshot
 * should be the reference for EMA smoothing.
 *
 * Returns true if the row was written (inserted or updated), false on error.
 */
export async function dbReplaceSnapshot(
  handle: string,
  snapshot: MetricsSnapshot,
): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;

  try {
    const row = snapshotToRow(handle, snapshot);
    const { error } = await db
      .from("metrics_snapshots")
      .upsert(row, {
        onConflict: "handle,date",
        // No ignoreDuplicates — this REPLACES the existing row
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error(
      "[db] dbReplaceSnapshot failed:",
      (error as Error).message,
    );
    return false;
  }
}
```

**Key difference from `dbInsertSnapshot`:**
- `dbInsertSnapshot` → `ignoreDuplicates: true` → same-day inserts silently ignored
- `dbReplaceSnapshot` → no `ignoreDuplicates` → same-day rows are UPDATED with new data

### 2.2 — Add `invalidateSnapshotCache()` (`apps/web/lib/cache/snapshot-cache.ts`)

Add after the existing `updateSnapshotCache()` function (~line 72):

```typescript
/**
 * Delete the cached latest snapshot for a user.
 *
 * Call this after any action that changes the user's score mid-day
 * (insights upload, platform connect, recalculate) so the next
 * badge/share-page request fetches a fresh snapshot from DB.
 *
 * Fire-and-forget safe — silently no-ops on Redis failure.
 */
export async function invalidateSnapshotCache(
  handle: string,
): Promise<void> {
  const key = snapshotCacheKey(handle);
  try {
    await cacheDel(key);
  } catch {
    // Fire-and-forget — cache invalidation is non-critical
  }
}
```

Also needs to import `cacheDel`:

```typescript
// BEFORE
import { cacheGet, cacheSet } from "./redis";

// AFTER
import { cacheGet, cacheSet, cacheDel } from "./redis";
```

### 2.3 — Tests (`apps/web/lib/db/snapshots.test.ts`)

Add to the existing test file, in a new `describe("dbReplaceSnapshot")` block:

```typescript
describe("dbReplaceSnapshot", () => {
  it("inserts a new snapshot when none exists for today", async () => {
    mockFrom.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null, status: 201 }),
    });
    const result = await dbReplaceSnapshot("testuser", makeSnapshot());
    expect(result).toBe(true);
  });

  it("replaces existing same-day snapshot", async () => {
    // First insert
    mockFrom.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null, status: 200 }),
    });
    const result = await dbReplaceSnapshot("testuser", makeSnapshot({ adjustedComposite: 65 }));
    expect(result).toBe(true); // true even on "update" (status 200)
  });

  it("does NOT use ignoreDuplicates", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null, status: 201 });
    mockFrom.mockReturnValue({ upsert: upsertMock });
    await dbReplaceSnapshot("testuser", makeSnapshot());
    const upsertArgs = upsertMock.mock.calls[0];
    expect(upsertArgs[1]).toEqual({ onConflict: "handle,date" });
    // No ignoreDuplicates property
    expect(upsertArgs[1]).not.toHaveProperty("ignoreDuplicates");
  });

  it("returns false when Supabase is unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValue(null);
    const result = await dbReplaceSnapshot("testuser", makeSnapshot());
    expect(result).toBe(false);
  });

  it("returns false on error", async () => {
    mockFrom.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: new Error("DB error"), status: 500 }),
    });
    const result = await dbReplaceSnapshot("testuser", makeSnapshot());
    expect(result).toBe(false);
  });

  it("lowercases handle", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null, status: 201 });
    mockFrom.mockReturnValue({ upsert: upsertMock });
    await dbReplaceSnapshot("TestUser", makeSnapshot());
    expect(upsertMock.mock.calls[0][0].handle).toBe("testuser");
  });
});
```

Add tests for `invalidateSnapshotCache` in `apps/web/lib/cache/snapshot-cache.test.ts`:

```typescript
describe("invalidateSnapshotCache", () => {
  it("deletes the snapshot cache key", async () => {
    await invalidateSnapshotCache("testuser");
    expect(cacheDel).toHaveBeenCalledWith("snapshot:latest:testuser");
  });

  it("lowercases handle", async () => {
    await invalidateSnapshotCache("TestUser");
    expect(cacheDel).toHaveBeenCalledWith("snapshot:latest:testuser");
  });

  it("does not throw on Redis failure", async () => {
    vi.mocked(cacheDel).mockRejectedValue(new Error("Redis down"));
    await expect(invalidateSnapshotCache("testuser")).resolves.toBeUndefined();
  });
});
```

## Tests

### New tests:
1. `dbReplaceSnapshot` — insert when no existing row
2. `dbReplaceSnapshot` — replace existing same-day row (returns true, not false)
3. `dbReplaceSnapshot` — does NOT use `ignoreDuplicates`
4. `dbReplaceSnapshot` — fail-open on unavailable Supabase
5. `dbReplaceSnapshot` — fail-open on DB error
6. `dbReplaceSnapshot` — lowercases handle
7. `invalidateSnapshotCache` — deletes correct key
8. `invalidateSnapshotCache` — lowercases handle
9. `invalidateSnapshotCache` — fire-and-forget on Redis failure

### Unchanged tests:
- All existing `dbInsertSnapshot` tests — behavior unchanged
- All existing `getCachedLatestSnapshot` / `updateSnapshotCache` tests

## Verification

```bash
pnpm run typecheck 2>&1; pnpm run lint 2>&1; pnpm run test -- snapshots 2>&1; pnpm run test -- snapshot-cache 2>&1
```

## Success Criteria

### Automated
- [x] `dbReplaceSnapshot` upserts without `ignoreDuplicates`
- [x] `dbReplaceSnapshot` returns true on both insert and update
- [x] `dbReplaceSnapshot` fail-open on errors
- [x] `invalidateSnapshotCache` deletes `snapshot:latest:{handle}`
- [x] `invalidateSnapshotCache` fire-and-forget on Redis failure
- [x] All existing snapshot tests still pass (no regressions)
