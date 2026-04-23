# Phase 4 — Cache versioning + insights→snapshot invalidation

**Source findings:** §3.4
**Depends on:** P1 (scoring changes bump the cache version, so land P1 first)
**Batch:** no (cross-cutting touches; keep sequential)

## Goal

Add a single `CACHE_VERSION` axis to the three cache families (`snapshot`, `craft`, `badge`) so algorithm/schema deploys produce a clean cache miss instead of waiting out the 24 h TTL. When insights upload bumps `craft`, also invalidate the composite snapshot that embedded the old craft value.

## Files touched

- `apps/web/lib/cache/snapshot-cache.ts`
- `apps/web/lib/cache/craft-cache.ts`
- `apps/web/app/u/[handle]/badge.svg/route.ts`
- `apps/web/app/api/insights/route.ts`
- `apps/web/lib/cache/version.ts` (NEW — single-source constant)
- Tests: `snapshot-cache.test.ts`, `craft-cache.test.ts`, `insights/route.test.ts`, `badge.svg/route.test.ts`

## TDD — Red tests first

```ts
// cache/version.test.ts
describe("CACHE_VERSION", () => {
  it("is a monotonically increasing integer string", () => {
    expect(CACHE_VERSION).toMatch(/^v\d+$/);
  });
});

// snapshot-cache.test.ts
describe("snapshot cache keys", () => {
  it("includes the CACHE_VERSION axis", () => {
    expect(buildSnapshotKey("juan")).toBe(`snapshot:${CACHE_VERSION}:latest:juan`);
  });
  it("bumping CACHE_VERSION misses old-version reads", async () => {
    await cacheSet(`snapshot:v1:latest:juan`, snap);
    mockCacheVersion("v2");
    expect(await getSnapshot("juan")).toBeNull();
  });
});

// insights/route.test.ts
describe("POST /api/insights", () => {
  it("invalidates the snapshot cache for the handle", async () => {
    const del = vi.spyOn(cache, "cacheDel");
    await POST(mockReq(insightsBody, {session: juan}));
    expect(del).toHaveBeenCalledWith(`snapshot:${CACHE_VERSION}:latest:juan`);
  });
});

// badge.svg/route.test.ts
describe("GET /u/:handle/badge.svg", () => {
  it("uses a versioned key for the rendered SVG cache", () => {
    // Spy cacheGet call args
    expect(cacheGetSpy).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^badge:${CACHE_VERSION}:`)));
  });
});
```

## Green — implementation pseudocode

```ts
// apps/web/lib/cache/version.ts (NEW)
// Bump when scoring algorithm, payload shape, or render output changes.
// Post-P1 this goes to v2.
export const CACHE_VERSION = "v2";
```

```ts
// snapshot-cache.ts
import { CACHE_VERSION } from "./version";
export function buildSnapshotKey(handle: string): string {
  return `snapshot:${CACHE_VERSION}:latest:${handle.toLowerCase()}`;
}
// all getters/setters use buildSnapshotKey(handle) — no remaining inlined key strings
```

```ts
// craft-cache.ts — same pattern, key: `craft:${CACHE_VERSION}:${handle}`
```

```ts
// app/u/[handle]/badge.svg/route.ts — key: `badge:${CACHE_VERSION}:${handle}:${theme}:${date}`
```

```ts
// app/api/insights/route.ts — after successful write
await cacheDel(buildCraftKey(handle));
await cacheDel(buildSnapshotKey(handle));  // NEW
```

## Automated success criteria

- All new tests green.
- `grep -rn "snapshot:latest:" apps/web/` returns 0 matches outside tests/fixtures (all callers go through `buildSnapshotKey`).
- `grep -rn "craft:" apps/web/` likewise.
- Existing snapshot/craft tests still pass with the `v2`-prefixed keys.

## Manual success criteria

- Pre-deploy: record a snapshot for a handle. Bump `CACHE_VERSION` locally, observe the share page triggers a recompute (no stale number).
- Post-deploy: upload fresh insights for a handle, confirm `/u/:handle/badge.svg` reflects the new `craft` value immediately (not 24 h later).

## Notes

- Old cache entries (`snapshot:latest:…` etc.) will age out naturally via the 24 h TTL. We do not scan-and-delete; Redis memory overhead for 24 h of orphaned keys is negligible for this scale.
- `CACHE_VERSION` belongs in `apps/web/lib/cache/` (not `packages/shared`) because it's a web-app concern. P11 consolidates *scoring* constants, not cache ones.

## Status

- [x] Implemented on 2026-04-22
- [x] Verified with `pnpm run typecheck`, `pnpm run lint`, and `pnpm run test`
