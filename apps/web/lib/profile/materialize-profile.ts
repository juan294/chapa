import { readScoringRenderSelection, type ScoringRenderSelection } from "@/lib/scoring-render-selection";
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
import { readRenderableReceipt, scoreModelFrom } from "./score-model";
import type { ScoreViewModel } from "./score-view-model";
import { readStats } from "@/lib/github/client";
import { isGitHubUserNotFound, type GitHubUserNotFound } from "@/lib/github/not-found";
import { isValidLegacyStats } from "@/lib/github/stats-integrity";

/** Whether the stats an aggregate was drawn from were collected under the
 * exact current source authorization (`current`) or are a last-known-good
 * serve from a bounded retention window after a live refresh/collection
 * failure (`stale`). See `apps/web/lib/github/client.ts`'s `readStats` and
 * `apps/web/lib/cache/stats-cache.ts`. `stale` is structurally renderable but
 * never publication-eligible: `statsComplete` below is unconditionally false
 * for it, which is what keeps stale data out of snapshot persistence and v6
 * verification issuance (`persist-guard.ts`, `public-profile.ts`). */
export type StatsFreshness = "current" | "stale";

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
  /** Defaults to `"current"`. Set explicitly by `loadDisplayInputs` from
   * `readStats`'s result; a direct caller (tests, admin recompute paths that
   * already hold a freshly-fetched `StatsData`) gets the historical
   * always-eligible behavior when this is omitted. */
  statsFreshness?: StatsFreshness;
  /** Defaults to `new Date().toISOString()` when omitted. */
  statsCapturedAt?: string;
}

export interface MaterializedDisplayState {
  craftResult: CraftResult | null;
  rawImpact: ImpactV6Result;
  displayImpact: ImpactV6Result;
  /** Legacy compatibility name: structural validity for v6 persistence and
   * lookup-record issuance. It does not certify source coverage or v7 evidence.
   * Unconditionally `false` when `statsFreshness !== "current"` — a stale
   * last-known-good aggregate renders but is never publication-eligible.
   */
  statsComplete: boolean;
  /** See {@link StatsFreshness}. */
  statsFreshness: StatsFreshness;
  /** When the underlying stats were captured — the fresh-collection instant
   * for `current`, or the original capture instant for a `stale` serve. */
  statsCapturedAt: string;
}

export interface MaterializedImpactState extends MaterializedDisplayState {
  latestSnapshot: SnapshotScoreInput | null;
  snapshot: MetricsSnapshot;
  /** True when scoring inputs have changed since today's snapshot (#826). */
  inputsChanged: boolean;
}

/** Legacy persistence validity only. This boolean does not certify v7 source coverage. */
function statsLookComplete(stats: StatsData): boolean {
  return isValidLegacyStats(stats);
}

export interface MaterializeProfileOptions
  extends Omit<MaterializeImpactStateOptions, "craftResult" | "latestSnapshot"> {
  token?: string;
  readOnly?: boolean;
  scoringSelection?: ScoringRenderSelection;
  /**
   * #930 — Skip the snapshot lookup entirely. With no prior snapshot,
   * EMA smoothing is skipped and the raw adjusted score passes through.
   * Use for admin bulk-recalculate where the stored today-snapshot may
   * contain wrong data (e.g. from a timed-out platform fetch) and the
   * same-day EMA lock would otherwise freeze the bad value in place.
   */
  ignoreSnapshot?: boolean;
}

export interface MaterializedProfile extends MaterializedImpactState {
  stats: StatsData;
  /**
   * What every rendering surface draws (#1311). An issued observed receipt projects
   * to `policyVersion: "v7.2"`; a subject with no receipt gets the v6 aggregate
   * projected into the same shape and labelled `v6`. Resolving it here rather
   * than per surface is what stops the badge, the OG image, the share page and
   * the warm-cache pre-render from disagreeing about one revision.
   */
  scoring: ScoreViewModel;
}

export interface MaterializedDisplayProfile extends MaterializedDisplayState {
  stats: StatsData;
  scoring: ScoreViewModel;
}

interface DisplayInputs {
  stats: StatsData;
  craftResult: CraftResult | null;
  statsFreshness: StatsFreshness;
  statsCapturedAt: string;
}

function materializeDisplayState(
  stats: StatsData,
  craftResult: CraftResult | null,
  statsFreshness: StatsFreshness = "current",
  statsCapturedAt: string = new Date().toISOString(),
): MaterializedDisplayState {
  const rawImpact = computeImpactV6(stats, craftResult?.craftScore);
  return {
    craftResult,
    rawImpact,
    displayImpact: rawImpact,
    statsComplete: statsFreshness === "current" && statsLookComplete(stats),
    statsFreshness,
    statsCapturedAt,
  };
}

/**
 * `readStats` — never the collapsed `getStats` — so a last-known-good
 * `stale` serve is distinguishable from a fresh one (badge-source-outage-
 * resilience, 2026-09-22). A `not_found`/`unavailable` result collapses to
 * the same sentinel/`null` contract every existing caller already handles.
 */
async function loadDisplayInputs(
  handle: string,
  token: string | undefined,
  readOnly: boolean | undefined,
): Promise<DisplayInputs | GitHubUserNotFound | null> {
  const [statsSettled, craftSettled] = await Promise.allSettled([
    readStats(handle, token, { readOnly }),
    getCachedCraftScore(handle),
  ]);

  const statsResult = statsSettled.status === "fulfilled" ? statsSettled.value : { status: "unavailable" as const };
  // LE-8-2 — carried, not folded into the `null` an outage produces.
  if (statsResult.status === "not_found") return statsResult.value;
  if (statsResult.status === "unavailable") return null;

  return {
    stats: statsResult.stats,
    statsFreshness: statsResult.status,
    statsCapturedAt: statsResult.capturedAt,
    craftResult:
      craftSettled.status === "fulfilled" ? craftSettled.value : null,
  };
}

export function materializeImpactState(
  stats: StatsData,
  options: MaterializeImpactStateOptions = {},
): MaterializedImpactState {
  const craftResult = options.craftResult ?? null;
  const latestSnapshot = options.latestSnapshot ?? null;
  const inputsChanged = options.inputsChanged ?? false;
  const displayState = materializeDisplayState(stats, craftResult, options.statsFreshness, options.statsCapturedAt);

  // #1001 — The live headline shown to users (badge, dashboard, verification
  // record, emails) is the FRESH score, always internally consistent with the
  // dimensions displayed beside it. EMA smoothing — and the same-day lock /
  // #826 dirty-input bypass / #930 ignoreSnapshot machinery in
  // applyImpactScorePolicy — is retained ONLY for the persisted trend snapshot
  // and the day-over-day EMA prior. Previously the smoothed composite was shown
  // as the headline next to un-smoothed dimensions, so a real dimension change
  // (e.g. Delivery dropping) showed immediately on the radar while the headline
  // lagged for days — reading as "the number doesn't match the breakdown".
  const smoothedImpact = applyImpactScorePolicy(displayState.rawImpact, latestSnapshot, {
    policy: options.policy,
    today: options.today,
    inputsChanged,
  });

  return {
    ...displayState,
    latestSnapshot,
    // Persist the smoothed composite so the history sparkline stays smooth and
    // tomorrow's EMA has a stable prior; the headline stays fresh.
    snapshot: buildSnapshot(stats, smoothedImpact, options.today, displayState.rawImpact.adjustedComposite),
    inputsChanged,
  };
}

/**
 * Materialize the live display-only profile fields: fresh `displayImpact`
 * (and the verification HMAC it feeds) never depend on trend state, so this
 * deliberately omits the snapshot and dirty-marker reads `materializeProfile`
 * performs (#1001 — the headline is always the fresh `rawImpact`, never the
 * EMA-smoothed value those reads exist for).
 *
 * `readOnly` defaults to `false` (the original owner-studio call shape,
 * where a live GitHub fetch on a cold key is desired) but must be threaded
 * through as `true` for a public, unauthenticated caller (#1180 PE-L2) —
 * otherwise a cold-key read-only caller could trigger a live GitHub fetch,
 * which #1083 specifically forbids for that class of caller.
 *
 * A handle GitHub does not know is `null` here (LE-8-2): the owner's Studio,
 * the read-only profile API, the MCP tools and the leaderboard all treat an
 * unloadable subject the same way, and none of them is a 404 surface. The
 * public surfaces go through `materializeProfile`, which carries the sentinel.
 */
export async function materializeDisplayProfile(
  handle: string,
  options: { token?: string; readOnly?: boolean; scoringSelection?: ScoringRenderSelection } = {},
): Promise<MaterializedDisplayProfile | null> {
  const selection = options.scoringSelection ?? await readScoringRenderSelection();
  const [inputs, receipt] = await Promise.all([
    loadDisplayInputs(handle, options.token, options.readOnly ?? false),
    readRenderableReceipt(handle, selection),
  ]);
  if (!inputs || isGitHubUserNotFound(inputs)) return null;

  const displayState = materializeDisplayState(inputs.stats, inputs.craftResult, inputs.statsFreshness, inputs.statsCapturedAt);
  return {
    stats: inputs.stats,
    ...displayState,
    scoring: scoreModelFrom(handle, displayState.displayImpact, receipt, selection, displayState.statsFreshness),
  };
}

/**
 * Resolves to the `GitHubUserNotFound` sentinel when GitHub answered that
 * nobody owns the handle (LE-8-2), so the share page, badge and OG routes can
 * say so. `null` still means "could not load" — an outage, a rate limit, a
 * rejected fetch — and must keep every consumer's "try later" state.
 */
export async function materializeProfile(
  handle: string,
  options: MaterializeProfileOptions = {},
): Promise<MaterializedProfile | GitHubUserNotFound | null> {
  const selection = options.scoringSelection ?? await readScoringRenderSelection();
  // #800 — getStats and the three cache lookups all only need the handle, so
  // they run concurrently. On cache miss for stats, GitHub's GraphQL still
  // dominates; on cache hit, this saves a round-trip vs the previous serial
  // shape. Cache lookup failures fail open to defaults rather than rejecting
  // the whole profile fetch.
  const [displayInputsSettled, snapshotSettled, dirtySettled, receiptSettled] =
    await Promise.allSettled([
      loadDisplayInputs(handle, options.token, options.readOnly),
      // #930 — Skip snapshot lookup when the caller wants to force-recalculate
      // from scratch. Passing Promise.resolve(null) skips the Redis/Supabase
      // read so the EMA same-day lock never sees a stale today-snapshot.
      options.ignoreSnapshot ? Promise.resolve(null) : getCachedLatestSnapshot(handle),
      isStatsDirty(handle),
      // #1311 — the issued v7 receipt, read alongside stats rather than after
      // them. A failed read falls back to the labelled v6 aggregate, which is
      // the same answer this surface gave before a receipt existed.
      readRenderableReceipt(handle, selection),
    ]);

  const displayInputs =
    displayInputsSettled.status === "fulfilled"
      ? displayInputsSettled.value
      : null;
  if (isGitHubUserNotFound(displayInputs)) return displayInputs;
  if (!displayInputs) {
    return null;
  }
  const { stats, craftResult, statsFreshness, statsCapturedAt } = displayInputs;
  const latestSnapshot = options.ignoreSnapshot
    ? null
    : snapshotSettled.status === "fulfilled" ? snapshotSettled.value : null;
  // Dirty-signal lookup failures fail open — defaulting to false preserves
  // the existing same-day-lock behavior rather than introducing surprise
  // refreshes when Redis hiccups.
  const dirtyFromCache =
    dirtySettled.status === "fulfilled" && dirtySettled.value === true;
  const inputsChanged = options.inputsChanged ?? dirtyFromCache;

  const impactState = materializeImpactState(stats, {
    craftResult,
    latestSnapshot,
    policy: options.policy,
    today: options.today,
    inputsChanged,
    statsFreshness,
    statsCapturedAt,
  });
  return {
    stats,
    ...impactState,
    scoring: scoreModelFrom(
      handle,
      impactState.displayImpact,
      receiptSettled.status === "fulfilled" ? receiptSettled.value : { unavailable: true },
      selection,
      impactState.statsFreshness,
    ),
  };
}
