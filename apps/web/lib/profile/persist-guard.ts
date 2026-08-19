import { captureServerEvent } from "@/lib/analytics/server-errors";
import { fireAndForget } from "@/lib/async/fire-and-forget";
import type { MaterializedProfile } from "./materialize-profile";

/**
 * #1003, extended to every writer by #1076 — the shared persist-boundary
 * gate: refuse to build a permanent snapshot row (or verification record)
 * from stats that look incomplete/poisoned (e.g. served from an old
 * poisoned `stats:stale` entry). Every snapshot writer must call this before
 * persisting — `persistProfileSnapshot` (badge path) and
 * `persistOrchestratedSnapshot` (warm-cache, /api/refresh, /api/recalculate,
 * /api/admin/bulk-recalculate) both do.
 */
export function guardStatsComplete(
  handle: string,
  materialized: MaterializedProfile,
): boolean {
  if (materialized.statsComplete) return true;

  fireAndForget(
    () =>
      captureServerEvent("snapshot_skipped_incomplete_stats", {
        handle,
        prsMergedCount: materialized.stats.prsMergedCount,
        commitsTotal: materialized.stats.commitsTotal,
      }),
    () => undefined,
  );
  return false;
}
