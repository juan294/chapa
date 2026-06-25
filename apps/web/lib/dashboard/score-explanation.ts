import type {
  ConfidenceFlag,
  CraftResult,
  DimensionScores,
  ImpactTier,
  ImpactV6Result,
  Platform,
  StatsData,
} from "@chapa/shared";
import { DIMENSION_KEYS, SOLO_DIMENSION_KEYS } from "@chapa/shared";
import type { DimensionKey, DimensionSubMetric } from "./dimension-sub-metrics";
import { getDimensionSubMetrics } from "./dimension-sub-metrics";

export interface DimensionExplanation {
  key: DimensionKey;
  score: number;
  countsTowardComposite: boolean;
  subMetrics: DimensionSubMetric[];
}

export interface PlatformProvenance {
  platform: Platform;
  login?: string;
  providesQualitySignals: boolean;
  providedSignalKeys: SignalKey[];
  missingSignalKeys: SignalKey[];
}

export interface ConfidenceExplanation {
  value: number;
  penalties: { flag: ConfidenceFlag; penalty: number }[];
}

export interface ScoreExplanation {
  composite: {
    score: number;
    adjusted: number;
    tier: ImpactTier;
    activeDimensionKeys: DimensionKey[];
    soloQualityExcluded: boolean;
  };
  dimensions: DimensionExplanation[];
  dataSources: PlatformProvenance[];
  confidence: ConfidenceExplanation;
}

const BASE_SIGNAL_KEYS = ["commits", "prs", "issues", "activity"] as const;
const QUALITY_SIGNAL_KEYS = [
  "prDescription",
  "featureBranch",
  "issueLinkage",
  "batchSize",
] as const;

export type SignalKey =
  | (typeof BASE_SIGNAL_KEYS)[number]
  | (typeof QUALITY_SIGNAL_KEYS)[number]
  | "stars"
  | "watchers";

const PLATFORM_SIGNAL_MAP: Record<
  Platform,
  { quality: boolean; stars: boolean; watchers: boolean }
> = {
  github: { quality: true, stars: true, watchers: true },
  gitlab: { quality: false, stars: true, watchers: false },
  bitbucket: { quality: false, stars: false, watchers: false },
  codeberg: { quality: false, stars: true, watchers: true },
};

function isDimensionPresent(
  dimensions: DimensionScores,
  key: keyof DimensionScores,
): key is DimensionKey {
  return dimensions[key] != null;
}

function hasQualitySignal(stats: StatsData, key: (typeof QUALITY_SIGNAL_KEYS)[number]): boolean {
  switch (key) {
    case "prDescription":
      return stats.prDescriptionRate !== undefined;
    case "featureBranch":
      return stats.featureBranchRate !== undefined;
    case "issueLinkage":
      return stats.issueLinkageRate !== undefined;
    case "batchSize":
      return stats.batchSizeScore !== undefined;
  }
}

function buildPlatformProvenance(platform: Platform, stats: StatsData): PlatformProvenance {
  const capabilities = PLATFORM_SIGNAL_MAP[platform];
  const providedSignalKeys: SignalKey[] = [...BASE_SIGNAL_KEYS];
  const missingSignalKeys: SignalKey[] = [];

  if (capabilities.stars) {
    providedSignalKeys.push("stars");
  } else {
    missingSignalKeys.push("stars");
  }

  if (capabilities.watchers) {
    providedSignalKeys.push("watchers");
  } else {
    missingSignalKeys.push("watchers");
  }

  for (const signal of QUALITY_SIGNAL_KEYS) {
    if (!capabilities.quality) {
      // Platform genuinely cannot expose this signal (GitLab/Bitbucket/Codeberg).
      missingSignalKeys.push(signal);
    } else if (hasQualitySignal(stats, signal)) {
      providedSignalKeys.push(signal);
    }
    // else: platform supports the signal but there is no data for it yet (e.g. a
    // near-empty GitHub account) — omit it rather than claim it is unavailable
    // on the platform, which would mislead.
  }

  return {
    platform,
    login: platform === "github" ? stats.handle : stats.linkedPlatformLogins?.[platform],
    providesQualitySignals: capabilities.quality,
    providedSignalKeys,
    missingSignalKeys,
  };
}

export function buildScoreExplanation(
  impact: ImpactV6Result,
  stats: StatsData,
  craftResult: CraftResult | null = null,
): ScoreExplanation {
  const isSolo = impact.profileType === "solo";
  const activeDimensionKeys = (isSolo ? SOLO_DIMENSION_KEYS : DIMENSION_KEYS).filter((key) =>
    isDimensionPresent(impact.dimensions, key),
  ) as DimensionKey[];

  const dimensions = DIMENSION_KEYS
    .filter((key) => isDimensionPresent(impact.dimensions, key))
    .map((key) => ({
      key,
      score: impact.dimensions[key]!,
      countsTowardComposite: activeDimensionKeys.includes(key),
      subMetrics: getDimensionSubMetrics(key, stats, impact.profileType, craftResult),
    }));

  const linkedPlatforms = stats.linkedPlatforms?.filter((platform) => platform !== "github") ?? [];
  const platforms: Platform[] = ["github", ...linkedPlatforms];

  return {
    composite: {
      score: impact.compositeScore,
      adjusted: impact.adjustedComposite,
      tier: impact.tier,
      activeDimensionKeys,
      soloQualityExcluded: isSolo,
    },
    dimensions,
    dataSources: platforms.map((platform) => buildPlatformProvenance(platform, stats)),
    confidence: {
      value: impact.confidence,
      penalties: (impact.confidencePenalties ?? []).map(({ flag, penalty }) => ({ flag, penalty })),
    },
  };
}
