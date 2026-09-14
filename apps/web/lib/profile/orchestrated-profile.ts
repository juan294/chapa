import type { ScoringRenderSelection } from "@/lib/scoring-render-selection";
import {
  materializeProfile,
  type MaterializedProfile,
} from "./materialize-profile";
import { isGitHubUserNotFound } from "@/lib/github/not-found";
import { guardStatsComplete } from "./persist-guard";
import {
  reconcileSnapshotWrite,
  type SnapshotPersistenceMode,
} from "./snapshot-write";

export type { SnapshotPersistenceMode };

export async function materializeOrchestratedProfile(
  handle: string,
  options: {
    token?: string;
    scoringSelection?: ScoringRenderSelection;
    today?: string;
    /** #930 — Skip the snapshot lookup so admin recalculates always apply the fresh score. */
    ignoreSnapshot?: boolean;
  } = {},
): Promise<MaterializedProfile | null> {
  const materialized = await materializeProfile(handle, {
    token: options.token,
    scoringSelection: options.scoringSelection,
    today: options.today,
    policy: "public-display",
    ignoreSnapshot: options.ignoreSnapshot,
  });
  // LE-8-2 — for the refresh, recalculate and warm-cache writers a handle
  // GitHub does not know is "nothing to persist", exactly as an unavailable
  // fetch is. Only the public read surfaces turn the sentinel into a 404.
  return isGitHubUserNotFound(materialized) ? null : materialized;
}

export async function persistOrchestratedSnapshot(
  handle: string,
  materialized: MaterializedProfile,
  options: { mode: SnapshotPersistenceMode },
): Promise<boolean> {
  // #1076 — This orchestrated writer backs warm-cache, /api/refresh,
  // /api/recalculate, and /api/admin/bulk-recalculate, and previously
  // bypassed the shared persist-boundary gate entirely (only
  // lib/profile/public-profile.ts's persistProfileSnapshot enforced it).
  if (!guardStatsComplete(handle, materialized)) {
    return false;
  }

  // The durable Supabase write and the Redis cache mirror are reconciled as
  // one envelope: a partial failure (durable ok, cache stale) emits an
  // operational alert rather than being swallowed (#975). Callers branch on
  // durable persistence, which is what governs the user-facing success path.
  const { persisted } = await reconcileSnapshotWrite(
    handle,
    materialized.snapshot,
    { mode: options.mode },
  );

  return persisted;
}
