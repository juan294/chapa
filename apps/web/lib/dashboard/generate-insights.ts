import type {
  DimensionScores,
  ImpactV4Result,
  ImpactTier,
} from "@chapa/shared";
import type { TrendSummary } from "@/lib/history/trend";
import type { SnapshotDiff } from "@/lib/history/diff";

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
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ARCHETYPE_PROFILES: Record<string, string> = {
  Builder:
    "Your profile is driven by output — you turn ideas into merged pull requests and closed issues at a pace that keeps the roadmap moving. Delivery is clearly your dominant dimension, meaning you thrive when shipping features and moving codebases forward.",
  "Quality Champion":
    "Your profile is shaped by quality — you're the one reviewing pull requests, catching edge cases, and making sure nothing ships that shouldn't. Quality is your dominant dimension, and your team's code quality reflects it.",
  Marathoner:
    "Your profile is defined by consistency — you show up day after day with steady, sustained contributions that compound over time. Consistency is your dominant dimension, making you the reliable backbone of any team.",
  Polymath:
    "Your profile is marked by reach — you contribute across multiple repositories and technology areas, connecting the dots between projects. Breadth is your dominant dimension, giving you a uniquely wide perspective.",
  Balanced:
    "Your profile is impressively well-rounded — no single dimension dominates because you invest across delivery, reviewing, consistency, and breadth. This balance makes you versatile and adaptable to any team need.",
  Emerging:
    "Your profile is still taking shape — with more contributions over the coming months, your strongest dimensions will emerge and reveal your developer identity. Every commit, review, and repo you touch sharpens the picture.",
};

const DIMENSION_TIPS: Record<string, string> = {
  delivery:
    "To strengthen Delivery, focus on opening and merging more pull requests — even small, focused PRs that close open issues count significantly.",
  quality:
    "To strengthen Quality, start reviewing teammates' pull requests more often — thoughtful code reviews are the fastest way to grow this dimension.",
  consistency:
    "To strengthen Consistency, aim for regular contributions across more days — even small commits on consecutive days build this dimension faster than occasional bursts.",
  breadth:
    "To strengthen Breadth, contribute to repos outside your main project — opening issues, submitting PRs, or reviewing code in other repositories all count.",
};

const DIMENSION_LABELS: Record<string, string> = {
  delivery: "Delivery",
  quality: "Quality",
  consistency: "Consistency",
  breadth: "Breadth",
};

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
// Main function
// ---------------------------------------------------------------------------

export function generateInsights(
  impact: ImpactV4Result,
  trend: TrendSummary | null,
  diff: SnapshotDiff | null,
): Insight[] {
  const insights: Insight[] = [];

  // Track which dimensions already have an improvement insight (for dedup)
  const improvementDimensions = new Set<string>();

  // -----------------------------------------------------------------------
  // Rule 1: Tier change (priority 1)
  // -----------------------------------------------------------------------
  if (diff?.tier) {
    const toIndex = TIER_ORDER.indexOf(diff.tier.to);
    const fromIndex = TIER_ORDER.indexOf(diff.tier.from);
    const isUpgrade = toIndex > fromIndex;

    insights.push({
      id: "achievement-tier",
      type: "achievement",
      icon: "trophy",
      headline: isUpgrade
        ? `You leveled up to ${diff.tier.to}!`
        : `Your tier shifted to ${diff.tier.to}`,
      body: isUpgrade
        ? `Your consistent effort paid off — welcome to ${diff.tier.to} tier.`
        : `Recent activity changes moved you to ${diff.tier.to}. Focus on your strongest dimension to climb back.`,
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
        headline: "Your impact is trending upward",
        body: `Score has improved by an average of +${trend.avgDelta}/day over the last ${window} days. Keep this momentum.`,
        priority: 2,
      });
    } else {
      // declining
      const worstDimension = findWorstDimension(trend);
      insights.push({
        id: "trend-overall",
        type: "trend",
        icon: "trending-down",
        headline: "Your impact is trending downward",
        body: `Score has declined by an average of ${trend.avgDelta}/day recently. The biggest drop is in ${DIMENSION_LABELS[worstDimension] ?? worstDimension}.`,
        priority: 2,
      });
    }
  }

  // -----------------------------------------------------------------------
  // Rule 3: Dimension improvement (priority 3)
  // -----------------------------------------------------------------------
  if (diff) {
    const dimKeys = ["delivery", "quality", "consistency", "breadth"] as const;
    for (const key of dimKeys) {
      const delta = diff.dimensions[key];
      if (delta > 5) {
        improvementDimensions.add(key);
        insights.push({
          id: `trend-${key}`,
          type: "trend",
          icon: "trending-up",
          headline: `${DIMENSION_LABELS[key]} improved by +${delta}`,
          body: `Your ${key} score jumped significantly this week.`,
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
        headline: `Grow your ${DIMENSION_LABELS[weakest]}`,
        body: DIMENSION_TIPS[weakest] ?? "",
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
    insights.push({
      id: "next-tier",
      type: "next-tier",
      icon: "arrow-up",
      headline: `${gap} points to ${nextTierInfo.nextTier}`,
      body: `You're ${gap} points away from ${nextTierInfo.nextTier} tier. Focus on your strongest dimension to close the gap.`,
      priority: 5,
    });
  }

  // -----------------------------------------------------------------------
  // Rule 6: Archetype context (priority 6, always included)
  // -----------------------------------------------------------------------
  const archetypeText = ARCHETYPE_PROFILES[impact.archetype] ?? "";
  const firstSentence = archetypeText.split(". ")[0] + ".";
  insights.push({
    id: "tip-archetype",
    type: "tip",
    icon: "target",
    headline: `You're a ${impact.archetype}`,
    body: firstSentence,
    priority: 6,
  });

  // -----------------------------------------------------------------------
  // Sort by priority and cap at 5
  // -----------------------------------------------------------------------
  insights.sort((a, b) => a.priority - b.priority);
  return insights.slice(0, MAX_INSIGHTS);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
