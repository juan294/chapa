import type { StatsData } from "@chapa/shared";
import { buildStatsFromRaw } from "@chapa/shared";
import { captureServerEvent } from "@/lib/analytics/server-errors";
import { fireAndForget } from "@/lib/async/fire-and-forget";
import { fetchContributionData, type LegacyFetchContext } from "./queries";
import { isGitHubUserNotFound, type GitHubUserNotFound } from "./not-found";
import { assessRawFetchIntegrity } from "./stats-integrity";

// v7 consumers receive dated evidence; fetchStats below remains the explicit v6 reader.
/** @public Checkpointed, resumable collector slice API (#1335 phase 3) --
 * the only GitHub collection implementation since the single-run
 * `fetchGitHubEvidence` was removed with the durable queue worker's rollout.
 */
export { collectGitHubSlice, githubMergedSearchRanges } from "./evidence";

// ---------------------------------------------------------------------------
// fetchStats — main aggregation function
// ---------------------------------------------------------------------------

export async function fetchStats(
  handle: string,
  token?: string,
  context?: LegacyFetchContext,
): Promise<StatsData | GitHubUserNotFound | null> {
  const raw = context ? await fetchContributionData(handle, token, context) : await fetchContributionData(handle, token);
  // LE-8-2 — nothing to validate or score: GitHub said the handle is nobody's.
  if (isGitHubUserNotFound(raw)) return raw;
  if (!raw) return null;

  // Structural validation only: legacy samples do not establish v7 coverage.
  // Reject malformed values, never legitimate zeros or sampled activity ratios.
  const integrity = assessRawFetchIntegrity(raw);
  if (!integrity.ok) {
    console.warn(`[github] rejecting malformed legacy fetch for ${handle}: ${integrity.reason}`);
    const mergedNodeCount = Array.isArray(raw.pullRequests?.nodes) ? raw.pullRequests.nodes.filter((n) => n?.merged === true).length : 0;
    fireAndForget(
      () =>
        captureServerEvent("stats_fetch_rejected", {
          handle,
          reason: integrity.reason,
          ...(typeof raw.mergedPrTotalCount === "number" && Number.isSafeInteger(raw.mergedPrTotalCount) && raw.mergedPrTotalCount >= 0
            ? { mergedPrTotalCount: raw.mergedPrTotalCount } : {}),
          mergedNodeCount,
          authenticated: Boolean(token),
        }),
      () => undefined,
    );
    return null;
  }

  return buildStatsFromRaw(raw);
}
