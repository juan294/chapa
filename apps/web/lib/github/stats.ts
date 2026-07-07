import type { StatsData } from "@chapa/shared";
import { buildStatsFromRaw } from "@chapa/shared";
import { fetchContributionData } from "./queries";
import { assessRawFetchIntegrity } from "./stats-integrity";

// ---------------------------------------------------------------------------
// fetchStats — main aggregation function
// ---------------------------------------------------------------------------

export async function fetchStats(
  handle: string,
  token?: string,
): Promise<StatsData | null> {
  const raw = await fetchContributionData(handle, token);
  if (!raw) return null;

  // Reject a structurally-valid-but-degraded payload at the source, before
  // it can ever be scored, cached, or persisted. See stats-integrity.ts —
  // this is the single integrity gate the rest of the pipeline relies on.
  const integrity = assessRawFetchIntegrity(raw);
  if (!integrity.ok) {
    console.warn(`[github] rejecting degraded fetch for ${handle}: ${integrity.reason}`);
    return null;
  }

  return buildStatsFromRaw(raw);
}
