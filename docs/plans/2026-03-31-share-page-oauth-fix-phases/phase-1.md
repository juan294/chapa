# Phase 1: Add `revalidatePath` to Refresh Endpoint

## Goal

When the refresh endpoint successfully re-fetches stats with an OAuth token, invalidate the ISR cache for the user's share page so the next request triggers a fresh server render with the correct data.

## Files

| File | Action |
|------|--------|
| `apps/web/app/api/refresh/route.ts` | Modify — add `revalidatePath` call |
| `apps/web/app/api/refresh/route.test.ts` | Modify — add test for revalidation |

## Changes

### 1. `apps/web/app/api/refresh/route.ts`

**Add import:**
```
+ import { revalidatePath } from "next/cache";
```

**After successful stats fetch and snapshot insert (after line 83), add ISR invalidation:**
```
  // After: dbInsertSnapshot / updateSnapshotCache block

+ // Invalidate ISR cache so the share page rebuilds with OAuth-sourced data
+ revalidatePath(`/u/${handle}`);

  return NextResponse.json({ stats, impact });
```

### 2. `apps/web/app/api/refresh/route.test.ts`

**Add test:**
```
describe("ISR revalidation", () => {
  it("calls revalidatePath for the user's share page after successful refresh", async () => {
    // Setup: mock session, mock getStats returning valid data
    // Act: POST /api/refresh?handle=testuser
    // Assert: revalidatePath was called with "/u/testuser"
  });

  it("does not call revalidatePath when stats fetch fails", async () => {
    // Setup: mock getStats returning null
    // Act: POST /api/refresh?handle=testuser
    // Assert: revalidatePath was NOT called, response is 502
  });
});
```

**Mock setup:**
```
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
```

## Verification

```bash
pnpm run test -- apps/web/app/api/refresh/route.test.ts
pnpm run typecheck
```

## Notes

- `revalidatePath` from `next/cache` works in Route Handlers (Next.js 14+)
- It marks the ISR cache as stale so the next request triggers regeneration
- The share page's `revalidate = 3600` means without this call, stale data could persist up to 1 hour even after cache refresh
- This also improves the existing manual refresh button — previously, clicking "Refresh" would update the Redis cache but the ISR page wouldn't rebuild for up to 1 hour
