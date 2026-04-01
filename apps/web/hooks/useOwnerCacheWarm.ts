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
      })
      .catch(() => {});
  }, [handle, isOwner, router]);
}
