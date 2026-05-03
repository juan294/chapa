import type {
  DimensionScores,
  ImpactV6Result,
  ImpactTier,
} from "@chapa/shared";
import type { TrendSummary } from "@/lib/history/trend";
import type { SnapshotDiff } from "@/lib/history/diff";
import { interpolate } from "@/lib/i18n/interpolate";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface Insight {
  id: string;
  type: "trend" | "tip" | "achievement" | "next-tier";
  icon:
    | "trending-up"
    | "trending-down"
    | "target"
    | "trophy"
    | "lightbulb"
    | "arrow-up";
  headline: string;
  body: string;
  dimension?: keyof DimensionScores;
  priority: number;
  /** Structured metadata for next-tier insights — avoids parsing translated headlines */
  nextTierMeta?: {
    gap: number;
    /** English tier key (e.g. "Solid", "High", "Elite") — for visual tier bar ordering */
    nextTierKey: ImpactTier;
    currentIndex: number;
    nextIndex: number;
    /** Translated tier labels for display */
    tierLabels: string[];
  };
  /** English archetype name for color resolution (locale-independent) */
  archetypeName?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Ordered tier list (lowest to highest) for comparison */
const TIER_ORDER: ImpactTier[] = ["Emerging", "Solid", "High", "Elite"];

/** Thresholds to reach the next tier: current tier -> score needed */
const NEXT_TIER_THRESHOLDS: Record<string, { threshold: number; nextTier: ImpactTier }> = {
  Emerging: { threshold: 30, nextTier: "Solid" },
  Solid: { threshold: 70, nextTier: "High" },
  High: { threshold: 85, nextTier: "Elite" },
};

const MAX_INSIGHTS = 5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toArchetypeKey(archetype: string): string {
  const map: Record<string, string> = {
    'Builder': 'builder',
    'Quality Champion': 'qualityChampion',
    'Marathoner': 'marathoner',
    'Polymath': 'polymath',
    'Balanced': 'balanced',
    'Emerging': 'emerging',
    'Artificer': 'artificer',
  };
  return map[archetype] ?? archetype.toLowerCase();
}

function findWeakestDimension(dimensions: DimensionScores): string {
  let weakest = "delivery";
  let lowest = dimensions.delivery;
  for (const [key, value] of Object.entries(dimensions)) {
    if (value < lowest) {
      lowest = value;
      weakest = key;
    }
  }
  return weakest;
}

function findWorstDimension(trend: TrendSummary): string {
  const dims = trend.dimensions;
  let worst = "delivery";
  let lowestDelta = dims.delivery.avgDelta;
  for (const [key, val] of Object.entries(dims)) {
    if (val.avgDelta < lowestDelta) {
      lowestDelta = val.avgDelta;
      worst = key;
    }
  }
  return worst;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Generate personalized developer insights from impact profile, trend, and diff data.
 *
 * Applies 6 prioritized rules: tier change, overall trend, dimension improvements,
 * weakest-dimension tip, next-tier guidance, and archetype context. Results are
 * sorted by priority and capped at 5. Used by the share page insights panel.
 *
 * @param impact - Current impact profile (dimensions, archetype, tier, composite)
 * @param trend  - Optional trend summary (direction, avgDelta, dimension trends)
 * @param diff   - Optional snapshot diff (tier/dimension changes since last snapshot)
 * @param t      - Translation function for locale-aware strings
 * @returns Up to 5 insights sorted by priority (1 = highest)
 */
export function generateInsights(
  impact: ImpactV6Result,
  trend: TrendSummary | null,
  diff: SnapshotDiff | null,
  t: (key: string) => string | string[] | Record<string, unknown>[] = (key) => key,
): Insight[] {
  const insights: Insight[] = [];

  // Helper: interpolate a translation key with vars
  const i = (key: string, vars: Record<string, string>) =>
    interpolate(t(key) as string, vars);

  // Track which dimensions already have an improvement insight (for dedup)
  const improvementDimensions = new Set<string>();

  // -----------------------------------------------------------------------
  // Rule 1: Tier change (priority 1)
  // -----------------------------------------------------------------------
  if (diff?.tier) {
    const toIndex = TIER_ORDER.indexOf(diff.tier.to);
    const fromIndex = TIER_ORDER.indexOf(diff.tier.from);
    const isUpgrade = toIndex > fromIndex;
    const tierKey = diff.tier.to.toLowerCase();

    insights.push({
      id: "achievement-tier",
      type: "achievement",
      icon: "trophy",
      headline: isUpgrade
        ? i('insights.tierUpgrade', { tier: t(`tiers.${tierKey}`) as string })
        : i('insights.tierDowngrade', { tier: t(`tiers.${tierKey}`) as string }),
      body: isUpgrade
        ? i('insights.tierUpgradeBody', { tier: t(`tiers.${tierKey}`) as string })
        : i('insights.tierDowngradeBody', { tier: t(`tiers.${tierKey}`) as string }),
      priority: 1,
    });
  }

  // -----------------------------------------------------------------------
  // Rule 2: Trend-based (priority 2)
  // -----------------------------------------------------------------------
  if (trend && trend.direction !== "stable") {
    const window = trend.compositeValues.length;
    if (trend.direction === "improving") {
      insights.push({
        id: "trend-overall",
        type: "trend",
        icon: "trending-up",
        headline: t('insights.trendUp') as string,
        body: i('insights.trendUpBody', { delta: String(trend.avgDelta), window: String(window) }),
        priority: 2,
      });
    } else {
      // declining
      const worstDimension = findWorstDimension(trend);
      insights.push({
        id: "trend-overall",
        type: "trend",
        icon: "trending-down",
        headline: t('insights.trendDown') as string,
        body: i('insights.trendDownBody', {
          delta: String(trend.avgDelta),
          dimension: t(`dimensions.${worstDimension}.label`) as string,
        }),
        priority: 2,
      });
    }
  }

  // -----------------------------------------------------------------------
  // Rule 3: Dimension improvement (priority 3)
  // -----------------------------------------------------------------------
  if (diff) {
    const dimKeys: (keyof DimensionScores)[] = diff.dimensions.craft != null
      ? ["delivery", "quality", "consistency", "breadth", "craft"]
      : ["delivery", "quality", "consistency", "breadth"];
    for (const key of dimKeys) {
      const delta = diff.dimensions[key];
      if (delta != null && delta > 5) {
        improvementDimensions.add(key);
        insights.push({
          id: `trend-${key}`,
          type: "trend",
          icon: "trending-up",
          headline: i('insights.dimensionImproved', {
            dimension: t(`dimensions.${key}.label`) as string,
            delta: String(delta),
          }),
          body: i('insights.dimensionImprovedBody', {
            dimension: t(`dimensions.${key}.label`) as string,
          }),
          dimension: key,
          priority: 3,
        });
      }
    }
  }

  // -----------------------------------------------------------------------
  // Rule 4: Weakest dimension tip (priority 4)
  // -----------------------------------------------------------------------
  if (impact.archetype !== "Balanced" && impact.archetype !== "Emerging") {
    const weakest = findWeakestDimension(impact.dimensions);
    // Dedup: skip if this dimension already has an improvement insight
    if (!improvementDimensions.has(weakest)) {
      insights.push({
        id: `tip-${weakest}`,
        type: "tip",
        icon: "lightbulb",
        headline: i('insights.growDimension', {
          dimension: t(`dimensions.${weakest}.label`) as string,
        }),
        body: t(`dimensionTips.${weakest}`) as string,
        dimension: weakest as keyof DimensionScores,
        priority: 4,
      });
    }
  }

  // -----------------------------------------------------------------------
  // Rule 5: Next tier guidance (priority 5)
  // -----------------------------------------------------------------------
  const nextTierInfo = NEXT_TIER_THRESHOLDS[impact.tier];
  if (nextTierInfo) {
    const gap = nextTierInfo.threshold - impact.adjustedComposite;
    const nextTierKey = nextTierInfo.nextTier.toLowerCase();
    const currentTierIndex = TIER_ORDER.indexOf(impact.tier);
    const nextTierIndex = TIER_ORDER.indexOf(nextTierInfo.nextTier);
    const tierLabels = TIER_ORDER.map((tier) => t(`tiers.${tier.toLowerCase()}`) as string);
    insights.push({
      id: "next-tier",
      type: "next-tier",
      icon: "arrow-up",
      headline: i('insights.pointsToTier', {
        points: String(gap),
        tier: t(`tiers.${nextTierKey}`) as string,
      }),
      body: i('insights.pointsToTierBody', {
        points: String(gap),
        tier: t(`tiers.${nextTierKey}`) as string,
      }),
      priority: 5,
      nextTierMeta: {
        gap,
        nextTierKey: nextTierInfo.nextTier,
        currentIndex: currentTierIndex,
        nextIndex: nextTierIndex,
        tierLabels,
      },
    });
  }

  // -----------------------------------------------------------------------
  // Rule 6: Archetype context (priority 6, always included)
  // -----------------------------------------------------------------------
  const archetypeKey = toArchetypeKey(impact.archetype);
  const archetypeText = t(`archetypeProfiles.${archetypeKey}`) as string;
  const firstSentence = archetypeText.split(". ")[0] + ".";
  insights.push({
    id: "tip-archetype",
    type: "tip",
    icon: "target",
    headline: i('insights.youreA', { archetype: impact.archetype }),
    body: firstSentence,
    priority: 6,
    archetypeName: impact.archetype,
  });

  // -----------------------------------------------------------------------
  // Sort by priority and cap at 5
  // -----------------------------------------------------------------------
  insights.sort((a, b) => a.priority - b.priority);
  return insights.slice(0, MAX_INSIGHTS);
}
