import "server-only";
import type { StatsData, ImpactV6Result, DimensionScores } from "@chapa/shared";
import type { MetricsSnapshot } from "@/lib/history/types";
import type { ScoringRenderSelection } from "@/lib/scoring-render-selection";
import { readPublicObservedScore } from "./post-write-score";
import { getCachedLatestSnapshot } from "@/lib/cache/snapshot-cache";
import { legacyViewModel, type ScoreViewModel } from "./score-view-model";

/**
 * The durable, non-activity counts a stored badge can truthfully draw — the
 * subset of `StatsData` a `MetricsSnapshot` actually records. Deliberately
 * excludes `heatmapData` (never persisted in the snapshot — a stored badge
 * never fabricates activity), `avatarUrl`/`displayName` (mutable display
 * fields the snapshot explicitly omits, see `packages/shared/src/types.ts`),
 * and `fetchedAt` (there is no live fetch behind this projection).
 */
export type StoredBadgeStatsContext = Pick<
  StatsData,
  | "commitsTotal"
  | "prsMergedCount"
  | "prsMergedWeight"
  | "reviewsSubmittedCount"
  | "issuesClosedCount"
  | "reposContributed"
  | "activeDays"
  | "linesAdded"
  | "linesDeleted"
  | "totalStars"
  | "totalForks"
  | "totalWatchers"
  | "topRepoShare"
  | "maxCommitsIn10Min"
>;

/**
 * A badge-only durable projection: the last committed score plus the
 * non-activity counts the `MetricsSnapshot` recorded alongside it.
 *
 * Deliberately never a `MaterializedProfile` — it structurally omits
 * `stats`/`snapshot`/`statsComplete`/`statsFreshness`/`inputsChanged`/
 * `latestSnapshot`, so it cannot satisfy that type and cannot accidentally
 * reach `runPublicProfileSideEffects`, `persistProfileSnapshot`, or v6 HMAC
 * verification issuance — every one of which requires a real
 * `MaterializedProfile`. `kind: "stored"` is the discriminant a caller
 * checks before treating this as anything other than a read-only fallback.
 */
export interface StoredBadgeProfile {
  readonly kind: "stored";
  readonly handle: string;
  readonly policyVersion: "v6" | "v7.2";
  /** When the underlying `MetricsSnapshot` was captured — never "now". */
  readonly observedAt: string;
  /**
   * The sole scoring authority for this projection. Always carries
   * `freshness: "stale"` (or the stricter `"unavailable"` the receipt model
   * itself already reported) — a stored fallback never claims a current
   * live read, regardless of what the underlying receipt window says.
   */
  readonly scoring: ScoreViewModel;
  /**
   * Structural companion for `renderBadgeSvg`'s legacy `impact` parameter.
   * Always sourced from the same stored `MetricsSnapshot`; `scoring` — never
   * this — is the number/tier/archetype authority a v7.2 stored badge draws
   * (`renderBadgeSvg` only reads from `impact` on the v6 craft-radar branch).
   */
  readonly legacyImpact: ImpactV6Result;
  readonly context: StoredBadgeStatsContext;
}

/** Pure projection shared with `/api/profile/[handle]` so the two never
 * compute a stored snapshot's dimensions differently. */
export function snapshotDimensions(snapshot: MetricsSnapshot): DimensionScores {
  return {
    delivery: snapshot.delivery,
    quality: snapshot.quality,
    consistency: snapshot.consistency,
    breadth: snapshot.breadth,
    ...(snapshot.craft != null && { craft: snapshot.craft }),
  };
}

function snapshotStatsContext(snapshot: MetricsSnapshot): StoredBadgeStatsContext {
  return {
    commitsTotal: snapshot.commitsTotal,
    prsMergedCount: snapshot.prsMergedCount,
    prsMergedWeight: snapshot.prsMergedWeight,
    reviewsSubmittedCount: snapshot.reviewsSubmittedCount,
    issuesClosedCount: snapshot.issuesClosedCount,
    reposContributed: snapshot.reposContributed,
    activeDays: snapshot.activeDays,
    linesAdded: snapshot.linesAdded,
    linesDeleted: snapshot.linesDeleted,
    totalStars: snapshot.totalStars,
    totalForks: snapshot.totalForks,
    totalWatchers: snapshot.totalWatchers,
    topRepoShare: snapshot.topRepoShare,
    maxCommitsIn10Min: snapshot.maxCommitsIn10Min,
  };
}

/** Never calls `computeImpactV6` on reconstructed data — every field here is
 * copied verbatim from the durably stored snapshot. */
function legacyImpactFromSnapshot(handle: string, snapshot: MetricsSnapshot): ImpactV6Result {
  return {
    handle: handle.toLowerCase(),
    profileType: snapshot.profileType,
    dimensions: snapshotDimensions(snapshot),
    archetype: snapshot.archetype,
    compositeScore: snapshot.compositeScore,
    confidence: snapshot.confidence,
    // `MetricsSnapshot.confidencePenalties` (`SnapshotPenalty[]`) deliberately
    // drops the `reason` string to save bytes; it cannot be reconstructed
    // truthfully, so this structural companion carries none rather than
    // fabricating one. `renderBadgeSvg` never reads `impact.confidencePenalties`.
    confidencePenalties: [],
    adjustedComposite: snapshot.adjustedComposite,
    tier: snapshot.tier,
    computedAt: snapshot.capturedAt,
  };
}

/** A stored fallback never claims a current live read: force `stale` unless
 * the model already reported the stricter `unavailable`. */
function withStaleFreshness(model: ScoreViewModel): ScoreViewModel {
  return model.freshness === "unavailable" ? model : { ...model, freshness: "stale" as const };
}

/**
 * Read the durable last-known-good badge projection for `handle`: the
 * committed current v7.2 receipt when one exists and is selected, else the
 * durable legacy `MetricsSnapshot`. Returns `null` when neither authority is
 * available, or when `selection` is not a known/cacheable policy — an
 * unknown policy authority is never a fallback opportunity.
 */
export async function readStoredBadgeProfile(
  handle: string,
  selection: ScoringRenderSelection,
): Promise<StoredBadgeProfile | null> {
  if (!selection.cacheable) return null;

  const [observed, snapshot] = await Promise.all([
    readPublicObservedScore(handle, selection),
    getCachedLatestSnapshot(handle),
  ]);

  if (!snapshot) return null;

  const legacyImpact = legacyImpactFromSnapshot(handle, snapshot);
  const context = snapshotStatsContext(snapshot);

  if (observed.status === "current") {
    return {
      kind: "stored",
      handle: handle.toLowerCase(),
      policyVersion: "v7.2",
      // The receipt is the scoring authority here, so the disclosed date is
      // the receipt's own. The snapshot row is written by a separate path.
      observedAt: observed.projection.scoring.identity?.recordedAt ?? snapshot.capturedAt,
      scoring: withStaleFreshness(observed.projection.scoring),
      legacyImpact,
      context,
    };
  }

  return {
    kind: "stored",
    handle: handle.toLowerCase(),
    policyVersion: "v6",
    observedAt: snapshot.capturedAt,
    scoring: withStaleFreshness(legacyViewModel(legacyImpact)),
    legacyImpact,
    context,
  };
}

/**
 * Build `renderBadgeSvg`'s positional `(stats, impact)` inputs from a stored
 * projection. `heatmapData` is always `[]` — never zero-filled per day —
 * because a stored render always pairs this with the `degraded` render
 * option, which replaces the heatmap with an explicit disclosure instead of
 * drawing an (empty, and therefore false) activity grid.
 */
export function storedBadgeRenderInputs(
  stored: StoredBadgeProfile,
): { stats: StatsData; impact: ImpactV6Result } {
  return {
    stats: {
      handle: stored.handle,
      ...stored.context,
      heatmapData: [],
      fetchedAt: stored.observedAt,
    },
    impact: stored.legacyImpact,
  };
}
