"use client";

import { useState, useEffect } from "react";
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

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTrendData(handle: string): UseTrendDataResult {
  const [trend, setTrend] = useState<TrendSummary | null>(null);
  const [diff, setDiff] = useState<SnapshotDiff | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchTrendData() {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/history/${handle}?include=trend,diff&window=30`,
        );

        if (cancelled) return;

        if (!res.ok) {
          if (res.status === 429) {
            setError("Rate limited");
          } else {
            setError("Failed to load trend data");
          }
          return;
        }

        const data = await res.json();

        if (cancelled) return;

        setTrend(data.trend ?? null);
        setDiff(data.diff ?? null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load trend data");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchTrendData();

    return () => {
      cancelled = true;
    };
  }, [handle]);

  return { trend, diff, isLoading, error };
}
