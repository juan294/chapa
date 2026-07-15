import { getSnapshots } from "./history";
import { computeTrend, type TrendSummary } from "./trend";
import { compareSnapshots, type SnapshotDiff } from "./diff";

// ---------------------------------------------------------------------------
// getTrendData — server-side trend/diff fetch (#1034)
//
// Mirrors the `?include=trend,diff` behavior of GET /api/history/:handle so
// the share page's server component can fetch this data directly instead of
// the ImpactDashboard client component triggering its own post-hydration
// fetch. This removes the static-shell -> hydrate -> lazy-chunk -> client
// fetch waterfall for data that's already fetchable at render time.
//
// Pure from the caller's perspective: no dynamic request APIs (headers/
// cookies) are touched, so calling this from an ISR page does not force
// `force-dynamic` rendering.
//
// Degrades gracefully: any failure reading history (Redis/Supabase down,
// unexpected errors) resolves to `{ trend: null, diff: null }` rather than
// throwing, matching the tolerance the client `useTrendData` hook already
// had for missing/unavailable history data.
// ---------------------------------------------------------------------------

const TREND_WINDOW = 30;

export interface TrendData {
  trend: TrendSummary | null;
  diff: SnapshotDiff | null;
}

/**
 * Fetch trend and diff data for a developer's impact history, server-side.
 *
 * @param handle - GitHub handle to fetch history for
 * @returns `{ trend, diff }` — both null when fewer than 2 snapshots exist
 *   or the history store is unavailable
 */
export async function getTrendData(handle: string): Promise<TrendData> {
  try {
    const snapshots = await getSnapshots(handle);

    if (snapshots.length < 2) {
      return { trend: null, diff: null };
    }

    const trend = computeTrend(snapshots, TREND_WINDOW);
    const previous = snapshots[snapshots.length - 2]!;
    const current = snapshots[snapshots.length - 1]!;
    const diff = compareSnapshots(previous, current);

    return { trend, diff };
  } catch {
    // Fail open — same tolerance as the client-side useTrendData hook had
    // for a missing/unavailable history store.
    return { trend: null, diff: null };
  }
}
