import type { CraftResult, ImpactV6Result, StatsData } from "@chapa/shared";
import { getCachedCraftScore } from "@/lib/cache/craft-cache";
import { getCachedLatestSnapshot } from "@/lib/cache/snapshot-cache";
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
}

export interface MaterializedImpactState {
  craftResult: CraftResult | null;
  latestSnapshot: SnapshotScoreInput | null;
  rawImpact: ImpactV6Result;
  displayImpact: ImpactV6Result;
  snapshot: MetricsSnapshot;
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
  const rawImpact = computeImpactV6(stats, craftResult?.craftScore);
  const displayImpact = applyImpactScorePolicy(rawImpact, latestSnapshot, {
    policy: options.policy,
    today: options.today,
  });

  return {
    craftResult,
    latestSnapshot,
    rawImpact,
    displayImpact,
    snapshot: buildSnapshot(stats, displayImpact, options.today),
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

  const [craftSettled, snapshotSettled] = await Promise.allSettled([
    getCachedCraftScore(handle),
    getCachedLatestSnapshot(handle),
  ]);

  const craftResult = craftSettled.status === "fulfilled"
    ? craftSettled.value
    : null;
  const latestSnapshot = snapshotSettled.status === "fulfilled"
    ? snapshotSettled.value
    : null;

  return {
    stats,
    ...materializeImpactState(stats, {
      craftResult,
      latestSnapshot,
      policy: options.policy,
      today: options.today,
    }),
  };
}
