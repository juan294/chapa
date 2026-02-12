import type { StatsData } from "@chapa/shared";
import { buildStatsFromRaw } from "@chapa/shared";
import { fetchContributionData } from "./queries";

// ---------------------------------------------------------------------------
// fetchStats — main aggregation function
// ---------------------------------------------------------------------------

export async function fetchStats(
  handle: string,
  token?: string,
): Promise<StatsData | null> {
  const raw = await fetchContributionData(handle, token);
  if (!raw) return null;

  return buildStatsFromRaw(raw);
}
