import { readObservedScoringHistory } from "./observed-history";

// ---------------------------------------------------------------------------
// getTrendData — server-side observed-history fetch (#1034, rebuilt #1335
// phase 5 on the durable v7.2 receipt history — `metrics_snapshots` and its
// smoothed-trend/diff pair are retired)
//
// Mirrors the share page's need for a developer's scoring history so the
// server component can fetch this data directly instead of a client
// component triggering its own post-hydration fetch.
//
// Pure from the caller's perspective: no dynamic request APIs (headers/
// cookies) are touched, so calling this from an ISR page does not force
// `force-dynamic` rendering.
//
// Degrades gracefully: any failure reading history (Supabase down,
// unexpected errors) resolves to `{ history: null }` rather than throwing.
// ---------------------------------------------------------------------------

/** Fewer than two observations can't show a trend. */
const MIN_OBSERVATIONS = 2;

export type ObservedScoringHistory = NonNullable<
  Awaited<ReturnType<typeof readObservedScoringHistory>>["history"]
>;

export interface TrendData {
  history: ObservedScoringHistory | null;
}

/**
 * Fetch a developer's observed scoring history, server-side.
 *
 * @param handle - GitHub handle to fetch history for
 * @returns `{ history }` — null when fewer than 2 observations exist, the
 *   subject was never scored, or the history store is unavailable
 */
export async function getTrendData(handle: string): Promise<TrendData> {
  try {
    const result = await readObservedScoringHistory(handle);
    if (result.status !== "found" || result.history.observations.length < MIN_OBSERVATIONS) {
      return { history: null };
    }
    return { history: result.history };
  } catch {
    // Fail open — same tolerance the v6 wrapper had for a missing/
    // unavailable history store.
    return { history: null };
  }
}
