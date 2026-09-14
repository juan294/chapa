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
 * Record that this tab has already warmed `handle` with the session token,
 * so the next owner visit to the share page does not post `/api/refresh`.
 *
 * `/generating/:handle` calls this after `/api/generate` succeeds: that
 * request is the same session-token fetch the warm would repeat, and the
 * refresh budget is five per hour (LE-5-2).
 */
export function markCacheWarmed(handle: string): void {
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${handle}`, "1");
  } catch {
    // Storage blocked: the visit falls back to one warm attempt.
  }
}

/**
 * Silently warm the stats cache with OAuth data when the badge owner
 * visits their share page.
 *
 * - Calls POST /api/refresh (existing endpoint, uses session OAuth token)
 * - At most one attempt per handle per tab session, whatever the outcome.
 *   The flag is written before the request goes out, so a second effect run
 *   (React StrictMode mounts twice; a remount while the first attempt is in
 *   flight) never posts again, and a 429 is not retried against a budget
 *   the tab already knows is spent. The toolbar Refresh button remains the
 *   deliberate retry path. (LE-5-2)
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
      sessionStorage.setItem(key, "1");
    } catch {
      return;
    }

    fireAndForget(
      () =>
        fetch(`/api/refresh?handle=${encodeURIComponent(handle)}`, {
          method: "POST",
        }).then((res) => {
          if (res.ok) {
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
