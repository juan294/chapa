import type { DimensionScores, ImpactTier } from "@chapa/shared";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * #1335 phase 5 ("delete v6") — the `generateInsights()` function this type
 * used to back (built from the retired legacy client-impact aggregate plus a
 * v6 trend/diff pair) is deleted: it had no real caller left once the
 * dashboard's coaching copy moved into `ImpactDashboard.tsx`'s own v7.2
 * branch. The `Insight` shape itself stays — `components/dashboard/
 * InsightCard.tsx` still renders it and is exported through the
 * design-sync manifest (`.ds-entry.tsx`) — but nothing in the app produces
 * one any more.
 */
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
