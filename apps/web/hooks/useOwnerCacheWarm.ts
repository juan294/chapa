"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { fireAndForget } from "@/lib/async/fire-and-forget";
import { trackEvent } from "@/lib/analytics/posthog";

const STORAGE_PREFIX = "chapa:refreshed:";

/**
 * Clear all owner cache warm sessionStorage entries.
 *
 * Call this on logout so that a subsequent login as a different user
 * does not see warm-cache debounce state from the previous session.
 */
export function clearCacheWarmState(): void {
  if (typeof sessionStorage === "undefined") return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    sessionStorage.removeItem(key);
  }
}

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
      return;
    }

    fireAndForget(
      () =>
        fetch(`/api/refresh?handle=${encodeURIComponent(handle)}`, {
          method: "POST",
        }).then((res) => {
          if (res.ok) {
            try { sessionStorage.setItem(key, "1"); } catch {}
            router.refresh();
          } else {
            trackEvent("client_api_error", {
              route: "/api/refresh",
              status: res.status,
              source: "useOwnerCacheWarm",
            });
          }
        }),
      () => undefined,
    );
  }, [handle, isOwner, router]);
}
