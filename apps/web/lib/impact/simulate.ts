import {
  DIMENSION_KEYS,
  SOLO_DIMENSION_KEYS,
  type DimensionScores,
  type ImpactTier,
} from "@chapa/shared";
import type { ClientImpactV6Result, StatsData } from "@chapa/shared";
import { computeAdjustedScore, getTier } from "./utils";
import { applyRecencyWeight, computeRecencyRatio } from "./recency";

export interface SimulatedScore {
  readonly composite: number;
  readonly adjusted: number;
  readonly tier: ImpactTier;
  readonly deltaVsCurrent: number;
}

/**
 * The one what-if calculator. Studio's `simulate_score` tool and any future
 * simulation surface call this instead of restating the pipeline, so a change
 * to scoring cannot leave a second answer behind in a what-if tool.
 *
 * Everything the caller does not override is held fixed at the profile's own
 * observed values — profile type, confidence and activity timing included — so
 * simulating the current dimensions returns exactly zero delta.
 */
export function simulateCoreScore(
  impact: Pick<ClientImpactV6Result, "dimensions" | "profileType" | "adjustedComposite"> & { confidence?: number },
  heatmapData: StatsData["heatmapData"],
  overrides: Partial<DimensionScores> = {},
): SimulatedScore {
  const dimensions: DimensionScores = { ...impact.dimensions, ...overrides };
  const keys = impact.profileType === "solo" ? SOLO_DIMENSION_KEYS : DIMENSION_KEYS;
  const active = keys
    .map(dimension => dimensions[dimension])
    .filter((score): score is number => score !== undefined);
  const composite = Math.round(active.reduce((sum, score) => sum + score, 0) / active.length);
  const recencyWeighted = applyRecencyWeight(composite, computeRecencyRatio(heatmapData));
  // A visitor projection carries no confidence; an unpenalised profile is the
  // only assumption available there, and it is the same one the view shows.
  const adjusted = computeAdjustedScore(recencyWeighted, impact.confidence ?? 100);
  return { composite, adjusted, tier: getTier(adjusted), deltaVsCurrent: adjusted - impact.adjustedComposite };
}
