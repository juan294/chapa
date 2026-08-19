import type { ConfidenceFlag, DeveloperArchetype, ImpactTier, ProfileType } from "@chapa/shared";
import type { MetricsSnapshot } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CategoricalChange<T> {
  from: T;
  to: T;
}

export interface PenaltyChanges {
  added: ConfidenceFlag[];
  removed: ConfidenceFlag[];
}

export interface SnapshotDiff {
  direction: "improving" | "declining" | "stable";
  daysBetween: number;

  // Numeric deltas (current - previous)
  compositeScore: number;
  adjustedComposite: number;
  confidence: number;

  dimensions: {
    delivery: number;
    quality: number;
    consistency: number;
    breadth: number;
    craft?: number;
  };

  stats: {
    commitsTotal: number;
    prsMergedCount: number;
    prsMergedWeight: number;
    reviewsSubmittedCount: number;
    issuesClosedCount: number;
    reposContributed: number;
    activeDays: number;
    linesAdded: number;
    linesDeleted: number;
    totalStars: number;
    totalForks: number;
    totalWatchers: number;
    topRepoShare: number;
  };

  // Categorical changes (null = no change)
  archetype: CategoricalChange<DeveloperArchetype> | null;
  tier: CategoricalChange<ImpactTier> | null;
  profileType: CategoricalChange<ProfileType> | null;

  // Penalty changes (null = old snapshot lacks penalty data)
  penaltyChanges: PenaltyChanges | null;
}

export type PublicSnapshotDiff = Omit<
  SnapshotDiff,
  "confidence" | "penaltyChanges"
>;

export type ClientSnapshotDiff = SnapshotDiff | PublicSnapshotDiff;

export function redactSnapshotDiffForVisitor(
  diff: SnapshotDiff,
): PublicSnapshotDiff {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { confidence: _confidence, penaltyChanges: _penaltyChanges, ...visitorDiff } = diff;
  return visitorDiff;
}

// ---------------------------------------------------------------------------
// Direction threshold
// ---------------------------------------------------------------------------

const DIRECTION_THRESHOLD = 2;

// ---------------------------------------------------------------------------
// compareSnapshots — pure function
// ---------------------------------------------------------------------------

/**
 * Compare two metric snapshots and produce a structured diff.
 *
 * Pure function — deterministic for a given pair of snapshots. Computes:
 * - Overall direction: "improving" if adjusted composite delta > {@link DIRECTION_THRESHOLD},
 *   "declining" if < negative threshold, "stable" otherwise.
 * - Numeric deltas for composite score, adjusted composite, confidence, all dimensions, and raw stats.
 * - Categorical changes for archetype, tier, and profile type (null when unchanged).
 * - Penalty changes: which confidence flags were added or removed between snapshots
 *   (null if either snapshot lacks penalty data, for backwards compatibility).
 * - Calendar distance in days between the two snapshot dates.
 *
 * The craft dimension delta is only included when both snapshots have a craft score.
 *
 * @param previous - The earlier (baseline) snapshot
 * @param current - The later (comparison) snapshot
 * @returns A {@link SnapshotDiff} containing all deltas and categorical changes
 */
export function compareSnapshots(
  previous: MetricsSnapshot,
  current: MetricsSnapshot,
): SnapshotDiff {
  const adjustedDelta = current.adjustedComposite - previous.adjustedComposite;

  let direction: SnapshotDiff["direction"];
  if (adjustedDelta > DIRECTION_THRESHOLD) {
    direction = "improving";
  } else if (adjustedDelta < -DIRECTION_THRESHOLD) {
    direction = "declining";
  } else {
    direction = "stable";
  }

  const prevDate = new Date(`${previous.date}T00:00:00.000Z`);
  const currDate = new Date(`${current.date}T00:00:00.000Z`);
  const daysBetween = Math.round(
    (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  // Penalty changes — null if either snapshot lacks the field
  let penaltyChanges: PenaltyChanges | null = null;
  if (previous.confidencePenalties !== undefined && current.confidencePenalties !== undefined) {
    const prevFlags = new Set(previous.confidencePenalties.map((p) => p.flag));
    const currFlags = new Set(current.confidencePenalties.map((p) => p.flag));
    penaltyChanges = {
      added: [...currFlags].filter((f) => !prevFlags.has(f)),
      removed: [...prevFlags].filter((f) => !currFlags.has(f)),
    };
  }

  return {
    direction,
    daysBetween,

    compositeScore: current.compositeScore - previous.compositeScore,
    adjustedComposite: adjustedDelta,
    confidence: current.confidence - previous.confidence,

    dimensions: {
      delivery: current.delivery - previous.delivery,
      quality: current.quality - previous.quality,
      consistency: current.consistency - previous.consistency,
      breadth: current.breadth - previous.breadth,
      ...(current.craft != null && previous.craft != null && {
        craft: current.craft - previous.craft,
      }),
    },

    stats: {
      commitsTotal: current.commitsTotal - previous.commitsTotal,
      prsMergedCount: current.prsMergedCount - previous.prsMergedCount,
      prsMergedWeight: current.prsMergedWeight - previous.prsMergedWeight,
      reviewsSubmittedCount: current.reviewsSubmittedCount - previous.reviewsSubmittedCount,
      issuesClosedCount: current.issuesClosedCount - previous.issuesClosedCount,
      reposContributed: current.reposContributed - previous.reposContributed,
      activeDays: current.activeDays - previous.activeDays,
      linesAdded: current.linesAdded - previous.linesAdded,
      linesDeleted: current.linesDeleted - previous.linesDeleted,
      totalStars: current.totalStars - previous.totalStars,
      totalForks: current.totalForks - previous.totalForks,
      totalWatchers: current.totalWatchers - previous.totalWatchers,
      topRepoShare: current.topRepoShare - previous.topRepoShare,
    },

    archetype:
      current.archetype !== previous.archetype
        ? { from: previous.archetype, to: current.archetype }
        : null,

    tier:
      current.tier !== previous.tier
        ? { from: previous.tier, to: current.tier }
        : null,

    profileType:
      current.profileType !== previous.profileType
        ? { from: previous.profileType, to: current.profileType }
        : null,

    penaltyChanges,
  };
}

// ---------------------------------------------------------------------------
// explainDiff — human-readable explanations
// ---------------------------------------------------------------------------

const DIMENSION_LABELS: Record<string, string> = {
  delivery: "Delivery",
  quality: "Quality",
  consistency: "Consistency",
  breadth: "Breadth",
};

const SIGNIFICANT_DIMENSION_CHANGE = 5;

/**
 * Produce human-readable explanation lines for a snapshot diff.
 *
 * Generates an array of plain-text sentences describing what changed between
 * two snapshots. Includes:
 * - Direction summary with point delta
 * - Tier and archetype changes (if any)
 * - Significant dimension changes (absolute delta >= {@link SIGNIFICANT_DIMENSION_CHANGE})
 * - Confidence penalty additions and removals
 *
 * @prebuilt Part of the pre-built history API surface — intended for
 * future consumers (share page, admin dashboard). Not yet imported.
 *
 * @param diff - The structured diff produced by {@link compareSnapshots}
 * @returns Array of human-readable explanation strings (one sentence per notable change)
 */
export function explainDiff(diff: SnapshotDiff): string[] {
  const lines: string[] = [];

  // Direction summary
  if (diff.direction === "improving") {
    lines.push(
      `Score is improving: adjusted composite changed by +${diff.adjustedComposite.toFixed(1)} points.`,
    );
  } else if (diff.direction === "declining") {
    lines.push(
      `Score is declining: adjusted composite changed by ${diff.adjustedComposite.toFixed(1)} points.`,
    );
  } else {
    lines.push("Score is stable — no significant change detected.");
  }

  // Tier change
  if (diff.tier) {
    lines.push(`Tier changed from ${diff.tier.from} to ${diff.tier.to}.`);
  }

  // Archetype change
  if (diff.archetype) {
    lines.push(`Archetype shifted from ${diff.archetype.from} to ${diff.archetype.to}.`);
  }

  // Significant dimension changes
  for (const [key, label] of Object.entries(DIMENSION_LABELS)) {
    const delta = diff.dimensions[key as keyof typeof diff.dimensions];
    if (delta != null && Math.abs(delta) >= SIGNIFICANT_DIMENSION_CHANGE) {
      const sign = delta > 0 ? "+" : "";
      lines.push(`${label} ${sign}${delta} points.`);
    }
  }

  // Penalty changes
  if (diff.penaltyChanges) {
    for (const flag of diff.penaltyChanges.added) {
      lines.push(`New confidence penalty: ${flag}.`);
    }
    for (const flag of diff.penaltyChanges.removed) {
      lines.push(`Confidence penalty resolved: ${flag}.`);
    }
  }

  return lines;
}
