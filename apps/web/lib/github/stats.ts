import type { StatsData } from "@chapa/shared";
import { buildStatsFromRaw } from "@chapa/shared";
import { captureServerEvent } from "@/lib/analytics/server-errors";
import { fireAndForget } from "@/lib/async/fire-and-forget";
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
    const mergedNodeCount = raw.pullRequests?.nodes.filter((n) => n.merged).length ?? 0;
    fireAndForget(
      () =>
        captureServerEvent("stats_fetch_rejected", {
          handle,
          reason: integrity.reason,
          mergedPrTotalCount: raw.mergedPrTotalCount,
          mergedNodeCount,
          authenticated: Boolean(token),
        }),
      () => undefined,
    );
    return null;
  }

  return buildStatsFromRaw(raw);
}
