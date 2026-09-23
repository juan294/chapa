import "server-only";
import type { StatsData } from "@chapa/shared";
import type { ScoringRenderSelection } from "@/lib/scoring-render-selection";
import { readPublicObservedScore } from "./post-write-score";
import { readStats } from "@/lib/github/client";
import type { ScoreViewModel } from "./score-view-model";
import { interpolate } from "@/lib/i18n/interpolate";

/**
 * A badge-only durable projection (#1335 phase 5, superseding the
 * 2026-09-22 snapshot-backed design): the last committed v7.2 receipt plus
 * the exact-bound stale `StatsData` envelope, when one is still available.
 * It no longer depends on `metrics_snapshots` at all.
 *
 * Deliberately never a `MaterializedProfile` — it structurally omits
 * `statsFreshness`/`statsComplete`/`craftResult`, so it cannot accidentally
 * reach `runPublicProfileSideEffects` or receipt issuance, either of which
 * requires a real `MaterializedProfile`. `kind: "stored"` is the discriminant
 * a caller checks before treating this as anything other than a read-only
 * fallback.
 */
export interface StoredBadgeProfile {
  readonly kind: "stored";
  readonly handle: string;
  /** The receipt's own recorded time — the disclosed "last known" date. */
  readonly observedAt: string;
  /**
   * The sole scoring authority for this projection. Always forced to
   * `stale` (or the stricter `"unavailable"` the receipt model itself
   * already reported) — a stored fallback never claims a current live read,
   * regardless of what the underlying receipt window says.
   */
  readonly scoring: ScoreViewModel;
  /**
   * The exact-bound stale `StatsData` envelope, read cache-only (never a
   * live GitHub fetch) via `readStats(handle, undefined, { readOnly: true })`
   * — the same last-known-good binding recheck a live caller uses, without
   * ever re-attempting the failed live fetch this fallback exists to
   * replace. `null` when even a stale envelope is unavailable:
   * {@link storedBadgeRenderInputs} then renders every count as unavailable,
   * never as a fabricated zero.
   */
  readonly stats: StatsData | null;
}

/** A stored fallback never claims a current live read: force `stale` unless
 * the model already reported the stricter `unavailable`. */
function withStaleFreshness(model: ScoreViewModel): ScoreViewModel {
  return model.freshness === "unavailable" ? model : { ...model, freshness: "stale" as const };
}

/**
 * Read the durable last-known-good badge projection for `handle`: the
 * committed current v7.2 receipt is the sole scoring authority. Returns
 * `null` only when there is nothing to draw at all — no current receipt — or
 * when `selection` is not a known/cacheable policy; an unknown policy
 * authority is never a fallback opportunity. A receipt with no backing stats
 * envelope still returns a profile — {@link storedBadgeRenderInputs} renders
 * its counts as unavailable rather than refusing the fallback entirely.
 */
export async function readStoredBadgeProfile(
  handle: string,
  selection: ScoringRenderSelection,
): Promise<StoredBadgeProfile | null> {
  if (!selection.cacheable) return null;

  const observed = await readPublicObservedScore(handle, selection);
  if (observed.status !== "current") return null;

  const statsRead = await readStats(handle, undefined, { readOnly: true });
  const stats = statsRead.status === "current" || statsRead.status === "stale" ? statsRead.stats : null;

  return {
    kind: "stored",
    handle: handle.toLowerCase(),
    observedAt: observed.projection.scoring.identity?.recordedAt ?? new Date().toISOString(),
    scoring: withStaleFreshness(observed.projection.scoring),
    stats,
  };
}

/**
 * Build `renderBadgeSvg`'s render inputs from a stored projection.
 * `heatmapData` is always `[]` — never zero-filled per day — because a
 * stored render always pairs this with the `degraded` render option, which
 * replaces the heatmap with an explicit disclosure instead of drawing an
 * (empty, and therefore false) activity grid.
 *
 * `countsAvailable: false` (no stats envelope backs this render at all)
 * forces every repo/star/fork/watch pill to an explicit "unavailable" glyph
 * instead of a fabricated zero — see `BadgeOptions.degraded.countsAvailable`.
 */
export function storedBadgeRenderInputs(
  stored: StoredBadgeProfile,
): { stats: StatsData; countsAvailable: boolean } {
  if (stored.stats) {
    return {
      stats: { ...stored.stats, heatmapData: [] },
      countsAvailable: true,
    };
  }
  return {
    stats: {
      handle: stored.handle,
      heatmapData: [],
      commitsTotal: 0,
      activeDays: 0,
      prsMergedCount: 0,
      prsMergedWeight: 0,
      reviewsSubmittedCount: 0,
      issuesClosedCount: 0,
      linesAdded: 0,
      linesDeleted: 0,
      reposContributed: 0,
      topRepoShare: 0,
      maxCommitsIn10Min: 0,
      totalStars: 0,
      totalForks: 0,
      totalWatchers: 0,
      fetchedAt: stored.observedAt,
    },
    countsAvailable: false,
  };
}

/**
 * The stored-badge fallback's activity disclosure, date-interpolated from
 * `stored.observedAt`. Shared by every stored-fallback renderer (the badge
 * route's SVG and the share page's inline SVG + breakdown notice) so they
 * never independently reformat the same fact — `t` is the caller's own
 * already-resolved translator (`getServerT(locale)` on the server), and the
 * dictionary key is `badge.activityUnavailable`.
 */
export function storedBadgeActivityUnavailable(t: (key: string) => string, observedAt: string): string {
  return interpolate(t("badge.activityUnavailable"), {
    date: observedAt.slice(0, 10),
  });
}
