"use client";

import { useState, useEffect } from "react";
import { trackEvent } from "@/lib/analytics/posthog";
import type { TrendSummary } from "@/lib/history/trend";
import type { SnapshotDiff } from "@/lib/history/diff";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseTrendDataResult {
  trend: TrendSummary | null;
  diff: SnapshotDiff | null;
  isLoading: boolean;
  error: string | null;
}

interface TrendData {
  trend: TrendSummary | null;
  diff: SnapshotDiff | null;
}

/** Settled result stored in the cache — always resolves, never rejects. */
type CachedResult =
  | { ok: true; data: TrendData }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Module-level promise cache
//
// Multiple hook instances (or React Strict Mode double-invocations) for the
// same handle share one in-flight fetch promise. This eliminates the
// GET /api/history/:handle waterfall on the share page where useOwnerCacheWarm
// and useTrendData can both trigger network calls on the same mount cycle.
//
// Promises in the cache always resolve (never reject) so there are no
// unhandled-rejection races between cache population and hook attachment.
//
// The cache is session-scoped: a full page reload clears it automatically.
// Call clearTrendDataCache() in tests to reset state between runs.
// ---------------------------------------------------------------------------

const trendCache = new Map<string, Promise<CachedResult>>();

/**
 * Clear the module-level trend data cache.
 * Exported for use in tests — call in beforeEach to reset state between runs.
 */
export function clearTrendDataCache(): void {
  trendCache.clear();
}

function fetchTrendData(handle: string): Promise<CachedResult> {
  const cached = trendCache.get(handle);
  if (cached) return cached;

  const promise = fetch(`/api/history/${handle}?include=trend,diff&window=30`)
    .then((res): Promise<CachedResult> => {
      if (!res.ok) {
        const msg = res.status === 429 ? "Rate limited" : "Failed to load trend data";
        trackEvent("client_api_error", {
          route: "/api/history/[handle]",
          status: res.status,
          source: "useTrendData",
        });
        return Promise.resolve({ ok: false, error: msg });
      }
      return (
        res.json() as Promise<{ trend?: TrendSummary | null; diff?: SnapshotDiff | null }>
      ).then((data) => ({
        ok: true as const,
        data: { trend: data.trend ?? null, diff: data.diff ?? null },
      }));
    })
    .catch((err: unknown): CachedResult => {
      // Network / parse errors: remove the entry so the next mount can retry
      trendCache.delete(handle);
      const msg = err instanceof Error ? err.message : "Failed to load trend data";
      return { ok: false, error: msg };
    });

  trendCache.set(handle, promise);
  return promise;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetch trend and diff data for a developer's impact history.
 *
 * Calls `GET /api/history/:handle?include=trend,diff&window=30` on mount and
 * returns loading/error state alongside the parsed `TrendSummary` and `SnapshotDiff`.
 *
 * Uses a module-level promise cache keyed by handle so that multiple hook
 * instances (or React Strict Mode double-effects) for the same handle share
 * one network request per session. The cache is cleared on page reload.
 *
 * @param handle - GitHub handle to fetch history for
 * @returns `{ trend, diff, isLoading, error }` — null values until loaded
 */
export function useTrendData(handle: string): UseTrendDataResult {
  const [trend, setTrend] = useState<TrendSummary | null>(null);
  const [diff, setDiff] = useState<SnapshotDiff | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      const result = await fetchTrendData(handle);

      if (cancelled) return;

      if (result.ok) {
        setTrend(result.data.trend);
        setDiff(result.data.diff);
      } else {
        setError(result.error);
      }

      setIsLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [handle]);

  return { trend, diff, isLoading, error };
}
