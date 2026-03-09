# Phase 3: Recalculate Endpoint + Insights Cache Fix

> `POST /api/recalculate` — force-recalculate score with latest data, replace snapshot.
> Also fix insights upload to invalidate snapshot cache.

## Objective

Create a reusable endpoint that recalculates the user's impact score with the latest data (including craft), replaces today's snapshot, and returns the new score. Also fix the insights upload to invalidate the snapshot cache so the EMA same-day guard uses fresh data.

## Changes

### 3.1 — Create `POST /api/recalculate` (`apps/web/app/api/recalculate/route.ts`)

```typescript
import { type NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { rateLimit } from "@/lib/cache/redis";
import { getStats } from "@/lib/github/client";
import { computeImpactV4 } from "@/lib/impact/v4";
import { dbGetToolInsights } from "@/lib/db/tool-insights";
import { buildSnapshot } from "@/lib/history/snapshot";
import { dbReplaceSnapshot } from "@/lib/db/snapshots";
import { updateSnapshotCache, invalidateSnapshotCache } from "@/lib/cache/snapshot-cache";
import { getTier } from "@/lib/impact/utils";

/**
 * POST /api/recalculate — Force-recalculate impact score.
 *
 * Fetches stats (cached or fresh), gets craft score from DB,
 * computes fresh impact, replaces today's snapshot, and returns
 * the new score + dimensions.
 *
 * Use after any deliberate user action that changes the score
 * (insights upload, platform connect/disconnect).
 *
 * Auth required. Rate limited: 20 requests/handle/hour.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const { session, error } = requireSession(request);
  if (error) return error;

  const handle = session.login.toLowerCase();

  // Rate limit: 20 per handle per hour
  const rl = await rateLimit(`ratelimit:recalculate:${handle}`, 20, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  // Fetch stats (cache-first — no need to re-fetch from GitHub)
  const stats = await getStats(handle, session.token);
  if (!stats) {
    return NextResponse.json(
      { error: "Could not load stats. Try again later." },
      { status: 502 },
    );
  }

  // Get craft score from DB (latest uploaded insights)
  const craftResult = await dbGetToolInsights(handle);

  // Compute fresh impact with craft included
  const impact = computeImpactV4(stats, craftResult?.craftScore ?? undefined);

  // For recalculate: use the RAW adjusted composite, NOT EMA-smoothed.
  // This is a deliberate action — the user wants to see the actual score.
  // The raw adjustedComposite already has recency + confidence applied,
  // just no EMA dampening.
  impact.tier = getTier(impact.adjustedComposite);

  // Build snapshot and REPLACE today's (not insert-ignore)
  const snapshot = buildSnapshot(stats, impact);
  const replaced = await dbReplaceSnapshot(handle, snapshot);

  if (replaced) {
    // Update Redis cache so subsequent badge views use the new snapshot
    await updateSnapshotCache(handle, snapshot);
  }

  return NextResponse.json({
    success: true,
    adjustedComposite: impact.adjustedComposite,
    compositeScore: impact.compositeScore,
    dimensions: impact.dimensions,
    archetype: impact.archetype,
    tier: impact.tier,
    profileType: impact.profileType,
    craftScore: craftResult?.craftScore ?? null,
    craftTier: craftResult?.tier ?? null,
  });
}
```

### 3.2 — Fix insights upload cache invalidation (`apps/web/app/api/insights/route.ts`)

```typescript
// BEFORE (line 58-59)
// Defer cache invalidation to post-response (non-blocking)
after(() => cacheDel(`stats:v2:merged:${session.login.toLowerCase()}`));

// AFTER — also invalidate snapshot cache
after(async () => {
  const handle = session.login.toLowerCase();
  await Promise.all([
    cacheDel(`stats:v2:merged:${handle}`),
    invalidateSnapshotCache(handle),
  ]);
});
```

Add import:
```typescript
import { invalidateSnapshotCache } from "@/lib/cache/snapshot-cache";
```

### 3.3 — Tests (`apps/web/app/api/recalculate/route.test.ts`)

```typescript
describe("POST /api/recalculate", () => {
  // Auth
  it("returns 401 when not authenticated", async () => { ... });

  // Rate limiting
  it("returns 429 when rate limited", async () => { ... });

  // Happy path
  it("returns recalculated impact with craft score", async () => {
    mockRequireSession({ login: "testuser", token: "tok" });
    mockGetStats(makeStats({ reviewsSubmittedCount: 0 })); // solo
    mockDbGetToolInsights({ craftScore: 69, tier: "Expert" });
    mockComputeImpactV4({ adjustedComposite: 61, dimensions: { delivery: 75, ... } });

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.adjustedComposite).toBe(61);
    expect(body.craftScore).toBe(69);
    expect(body.craftTier).toBe("Expert");
  });

  // Snapshot replacement
  it("replaces today's snapshot via dbReplaceSnapshot", async () => {
    mockRequireSession({ login: "testuser", token: "tok" });
    mockGetStats(makeStats());
    mockDbGetToolInsights({ craftScore: 69 });

    await POST(makeRequest());

    expect(dbReplaceSnapshot).toHaveBeenCalledWith("testuser", expect.any(Object));
    expect(updateSnapshotCache).toHaveBeenCalledWith("testuser", expect.any(Object));
  });

  // Without craft
  it("works without craft score (no insights uploaded)", async () => {
    mockRequireSession({ login: "testuser", token: "tok" });
    mockGetStats(makeStats());
    mockDbGetToolInsights(null); // no insights

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(body.craftScore).toBeNull();
    expect(body.success).toBe(true);
  });

  // Stats unavailable
  it("returns 502 when stats cannot be loaded", async () => {
    mockRequireSession({ login: "testuser", token: "tok" });
    mockGetStats(null);

    const res = await POST(makeRequest());
    expect(res.status).toBe(502);
  });

  // Does NOT apply EMA smoothing
  it("returns raw adjusted composite without EMA smoothing", async () => {
    mockRequireSession({ login: "testuser", token: "tok" });
    mockGetStats(makeStats());
    mockDbGetToolInsights({ craftScore: 69 });
    // computeImpactV4 returns adjustedComposite: 61
    mockComputeImpactV4({ adjustedComposite: 61 });

    const res = await POST(makeRequest());
    const body = await res.json();

    // Raw score, not smoothed — smoothScore is NOT called
    expect(body.adjustedComposite).toBe(61);
    expect(smoothScore).not.toHaveBeenCalled();
  });

  // Snapshot replacement failure is non-fatal
  it("returns success even if snapshot replacement fails", async () => {
    mockRequireSession({ login: "testuser", token: "tok" });
    mockGetStats(makeStats());
    mockDbGetToolInsights(null);
    vi.mocked(dbReplaceSnapshot).mockResolvedValue(false); // DB failure

    const res = await POST(makeRequest());
    expect(res.status).toBe(200); // Still succeeds
  });
});
```

Update insights route test (`apps/web/app/api/insights/route.test.ts`) to verify snapshot cache invalidation:

```typescript
it("invalidates snapshot cache after successful upload", async () => {
  // ... setup ...
  await POST(makeRequest(validBody));
  await flushAfterCallbacks();

  expect(invalidateSnapshotCache).toHaveBeenCalledWith("testuser");
});
```

## Tests

### New tests (recalculate route):
1. Auth required (401)
2. Rate limiting (429)
3. Happy path with craft score
4. Snapshot replaced via `dbReplaceSnapshot`
5. Works without craft (null)
6. Stats unavailable (502)
7. No EMA smoothing applied
8. Snapshot failure is non-fatal

### Modified tests (insights route):
1. Verify `invalidateSnapshotCache` called after upload

### Unchanged tests:
- All existing insights tests
- All existing badge route tests
- All existing smoothing tests

## Verification

```bash
pnpm run typecheck 2>&1; pnpm run lint 2>&1; pnpm run test -- recalculate 2>&1; pnpm run test -- insights/route 2>&1
```

## Success Criteria

### Automated
- [x] `POST /api/recalculate` returns fresh impact with craft
- [x] Recalculate uses `dbReplaceSnapshot` (not `dbInsertSnapshot`)
- [x] Recalculate does NOT call `smoothScore` (raw adjusted composite)
- [x] Recalculate updates snapshot cache after replacement
- [x] Insights upload invalidates `snapshot:latest:{handle}`
- [x] Rate limited (20/hour)
- [x] Auth required
- [x] Graceful on stats failure (502) and snapshot failure (still 200)
