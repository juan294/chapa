# Phase 2: Client-Side Auto-Refresh on Owner Visit

## Goal

When the badge owner visits their share page, silently trigger a cache refresh using their OAuth token so the ISR page serves correct data. Update the page in-place via `router.refresh()`.

## Files

| File | Action |
|------|--------|
| `apps/web/hooks/useOwnerCacheWarm.ts` | **New** — auto-refresh hook |
| `apps/web/hooks/useOwnerCacheWarm.test.ts` | **New** — hook tests |
| `apps/web/components/SharePageOwnerContent.tsx` | Modify — integrate hook |

## Changes

### 1. `apps/web/hooks/useOwnerCacheWarm.ts` (new)

```typescript
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const STORAGE_PREFIX = "chapa:refreshed:";

/**
 * Silently warm the stats cache with OAuth data when the badge owner
 * visits their share page.
 *
 * - Calls POST /api/refresh (existing endpoint, uses session OAuth token)
 * - Debounced via sessionStorage (once per handle per tab session)
 * - On success, calls router.refresh() to re-render with fresh data
 * - Silent on failure (ISR data remains visible)
 */
export function useOwnerCacheWarm(handle: string, isOwner: boolean): void {
  const router = useRouter();

  useEffect(() => {
    if (!isOwner) return;

    const key = `${STORAGE_PREFIX}${handle}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      // SSR or sessionStorage unavailable — skip
      return;
    }

    fetch(`/api/refresh?handle=${encodeURIComponent(handle)}`, {
      method: "POST",
    })
      .then((res) => {
        if (res.ok) {
          try { sessionStorage.setItem(key, "1"); } catch {}
          router.refresh();
        }
        // Non-ok (429 rate limit, 401, etc.) — silent, ISR data still shown
      })
      .catch(() => {
        // Network error — silent
      });
  }, [handle, isOwner, router]);
}
```

### 2. `apps/web/components/SharePageOwnerContent.tsx`

**Add import and hook call:**
```diff
  import { useSession } from "@/hooks/useSession";
+ import { useOwnerCacheWarm } from "@/hooks/useOwnerCacheWarm";

  export function SharePageOwnerContent({ handle, stats, impact }) {
    const { session, loading } = useSession();
    const isOwner = !loading && session?.login === handle;
+
+   // Warm cache with OAuth data when owner visits (once per session)
+   useOwnerCacheWarm(handle, isOwner);

    if (loading) return null;
```

**Key:** `isOwner` is `false` while `loading` is true, so the hook won't fire prematurely.

### 3. `apps/web/hooks/useOwnerCacheWarm.test.ts` (new)

```typescript
describe("useOwnerCacheWarm", () => {
  it("calls POST /api/refresh when isOwner is true", () => {
    renderHook(() => useOwnerCacheWarm("testuser", true));
    expect(fetch).toHaveBeenCalledWith(
      "/api/refresh?handle=testuser",
      { method: "POST" },
    );
  });

  it("does NOT call refresh when isOwner is false", () => {
    renderHook(() => useOwnerCacheWarm("testuser", false));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("skips refresh if sessionStorage flag is set", () => {
    sessionStorage.setItem("chapa:refreshed:testuser", "1");
    renderHook(() => useOwnerCacheWarm("testuser", true));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sets sessionStorage flag after successful refresh", async () => {
    // Mock fetch returning ok response
    renderHook(() => useOwnerCacheWarm("testuser", true));
    await waitFor(() => {
      expect(sessionStorage.getItem("chapa:refreshed:testuser")).toBe("1");
    });
  });

  it("calls router.refresh() after successful refresh", async () => {
    renderHook(() => useOwnerCacheWarm("testuser", true));
    await waitFor(() => {
      expect(mockRouter.refresh).toHaveBeenCalled();
    });
  });

  it("does not set sessionStorage on failed refresh", async () => {
    // Mock fetch returning 429
    renderHook(() => useOwnerCacheWarm("testuser", true));
    await waitFor(() => {
      expect(sessionStorage.getItem("chapa:refreshed:testuser")).toBeNull();
    });
  });

  it("does not throw on network error", () => {
    // Mock fetch rejecting
    expect(() => {
      renderHook(() => useOwnerCacheWarm("testuser", true));
    }).not.toThrow();
  });
});
```

## ISR Compatibility

This change does **not** break ISR because:
- The hook is in a **client component** (`SharePageOwnerContent` has `"use client"`)
- The server component (`page.tsx`) remains unchanged — no `headers()`, no `cookies()`
- All 6 ISR guard tests at `page.test.ts:114-141` continue to pass
- The refresh call happens **after hydration**, not during server render

## Verification

```bash
pnpm run test -- apps/web/hooks/useOwnerCacheWarm.test.ts
pnpm run test -- apps/web/app/u/\[handle\]/page.test.ts  # ISR guards still pass
pnpm run typecheck
pnpm run lint
```

## Flow Diagram

```
Owner visits /u/handle
  ↓
ISR serves cached page (possibly with GITHUB_TOKEN data)
  ↓
Client hydrates → useSession() detects isOwner
  ↓
useOwnerCacheWarm fires (once per session)
  ↓
POST /api/refresh?handle=handle
  ↓ (server-side)
requireSession → extracts OAuth token from cookie
cacheDel → clears stale Redis cache
getStats(handle, oauthToken) → fetches 78 PRs, solo profile, Quality=83
cacheSet → warms Redis with correct data
revalidatePath('/u/handle') → marks ISR cache as stale [Phase 1]
  ↓ (response back to client)
router.refresh() → Next.js re-fetches server component
  ↓
Server rebuilds page → getStats(handle) finds fresh OAuth cache → correct Quality
  ↓
UI updates in-place (no full page reload)
```
