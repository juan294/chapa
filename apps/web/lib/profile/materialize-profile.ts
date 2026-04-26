import type { CraftResult, ImpactV6Result, StatsData } from "@chapa/shared";
import { getCachedCraftScore } from "@/lib/cache/craft-cache";
import { getCachedLatestSnapshot } from "@/lib/cache/snapshot-cache";
import { isStatsDirty } from "@/lib/cache/dirty-stats";
import { buildSnapshot } from "@/lib/history/snapshot";
import type { MetricsSnapshot } from "@/lib/history/types";
import {
  applyImpactScorePolicy,
  type ScorePolicy,
  type SnapshotScoreInput,
} from "@/lib/impact/smoothing";
import { computeImpactV6 } from "@/lib/impact/v6";
import { getStats } from "@/lib/github/client";

export interface MaterializeImpactStateOptions {
  craftResult?: CraftResult | null;
  latestSnapshot?: SnapshotScoreInput | null;
  policy?: ScorePolicy;
  today?: string;
  /**
   * #826 — Set when scoring inputs have legitimately changed mid-day (e.g.
   * post-supplemental upload). Bypasses the same-day EMA lock and signals
   * the persistence layer to replace today's snapshot rather than skip the
   * insert on UNIQUE(handle, date) conflict.
   */
  inputsChanged?: boolean;
}

export interface MaterializedImpactState {
  craftResult: CraftResult | null;
  latestSnapshot: SnapshotScoreInput | null;
  rawImpact: ImpactV6Result;
  displayImpact: ImpactV6Result;
  snapshot: MetricsSnapshot;
  /** True when scoring inputs have changed since today's snapshot (#826). */
  inputsChanged: boolean;
}

export interface MaterializeProfileOptions
  extends Omit<MaterializeImpactStateOptions, "craftResult" | "latestSnapshot"> {
  token?: string;
}

export interface MaterializedProfile extends MaterializedImpactState {
  stats: StatsData;
}

export function materializeImpactState(
  stats: StatsData,
  options: MaterializeImpactStateOptions = {},
): MaterializedImpactState {
  const craftResult = options.craftResult ?? null;
  const latestSnapshot = options.latestSnapshot ?? null;
  const inputsChanged = options.inputsChanged ?? false;
  const rawImpact = computeImpactV6(stats, craftResult?.craftScore);
  const displayImpact = applyImpactScorePolicy(rawImpact, latestSnapshot, {
    policy: options.policy,
    today: options.today,
    inputsChanged,
  });

  return {
    craftResult,
    latestSnapshot,
    rawImpact,
    displayImpact,
    snapshot: buildSnapshot(stats, displayImpact, options.today),
    inputsChanged,
  };
}

export async function materializeProfile(
  handle: string,
  options: MaterializeProfileOptions = {},
): Promise<MaterializedProfile | null> {
  const stats = await getStats(handle, options.token);

  if (!stats) {
    return null;
  }

  const [craftSettled, snapshotSettled, dirtySettled] = await Promise.allSettled([
    getCachedCraftScore(handle),
    getCachedLatestSnapshot(handle),
    isStatsDirty(handle),
  ]);

  const craftResult = craftSettled.status === "fulfilled"
    ? craftSettled.value
    : null;
  const latestSnapshot = snapshotSettled.status === "fulfilled"
    ? snapshotSettled.value
    : null;
  // Dirty-signal lookup failures fail open — defaulting to false preserves
  // the existing same-day-lock behavior rather than introducing surprise
  // refreshes when Redis hiccups.
  const dirtyFromCache = dirtySettled.status === "fulfilled" && dirtySettled.value === true;
  const inputsChanged = options.inputsChanged ?? dirtyFromCache;

  return {
    stats,
    ...materializeImpactState(stats, {
      craftResult,
      latestSnapshot,
      policy: options.policy,
      today: options.today,
      inputsChanged,
    }),
  };
}
