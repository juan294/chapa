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
import { getStats } from "@/lib/github/client";
import { isValidLegacyStats } from "@/lib/github/stats-integrity";

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
}

export interface MaterializedDisplayState {
  craftResult: CraftResult | null;
  rawImpact: ImpactV6Result;
  displayImpact: ImpactV6Result;
  /** Legacy compatibility name: structural validity for v6 persistence and
   * lookup-record issuance. It does not certify source coverage or v7 evidence.
   */
  statsComplete: boolean;
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
}

export interface MaterializedDisplayProfile extends MaterializedDisplayState {
  stats: StatsData;
}

interface DisplayInputs {
  stats: StatsData;
  craftResult: CraftResult | null;
}

function materializeDisplayState(
  stats: StatsData,
  craftResult: CraftResult | null,
): MaterializedDisplayState {
  const rawImpact = computeImpactV6(stats, craftResult?.craftScore);
  return {
    craftResult,
    rawImpact,
    displayImpact: rawImpact,
    statsComplete: statsLookComplete(stats),
  };
}

async function loadDisplayInputs(
  handle: string,
  token: string | undefined,
  readOnly: boolean | undefined,
): Promise<DisplayInputs | null> {
  const [statsSettled, craftSettled] = await Promise.allSettled([
    getStats(handle, token, { readOnly }),
    getCachedCraftScore(handle),
  ]);

  const stats = statsSettled.status === "fulfilled" ? statsSettled.value : null;
  if (!stats) return null;

  return {
    stats,
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
  const displayState = materializeDisplayState(stats, craftResult);

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
    snapshot: buildSnapshot(stats, smoothedImpact, options.today),
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
 */
export async function materializeDisplayProfile(
  handle: string,
  options: { token?: string; readOnly?: boolean } = {},
): Promise<MaterializedDisplayProfile | null> {
  const inputs = await loadDisplayInputs(handle, options.token, options.readOnly ?? false);
  if (!inputs) return null;

  return {
    stats: inputs.stats,
    ...materializeDisplayState(inputs.stats, inputs.craftResult),
  };
}

export async function materializeProfile(
  handle: string,
  options: MaterializeProfileOptions = {},
): Promise<MaterializedProfile | null> {
  // #800 — getStats and the three cache lookups all only need the handle, so
  // they run concurrently. On cache miss for stats, GitHub's GraphQL still
  // dominates; on cache hit, this saves a round-trip vs the previous serial
  // shape. Cache lookup failures fail open to defaults rather than rejecting
  // the whole profile fetch.
  const [displayInputsSettled, snapshotSettled, dirtySettled] =
    await Promise.allSettled([
      loadDisplayInputs(handle, options.token, options.readOnly),
      // #930 — Skip snapshot lookup when the caller wants to force-recalculate
      // from scratch. Passing Promise.resolve(null) skips the Redis/Supabase
      // read so the EMA same-day lock never sees a stale today-snapshot.
      options.ignoreSnapshot ? Promise.resolve(null) : getCachedLatestSnapshot(handle),
      isStatsDirty(handle),
    ]);

  const displayInputs =
    displayInputsSettled.status === "fulfilled"
      ? displayInputsSettled.value
      : null;
  if (!displayInputs) {
    return null;
  }
  const { stats, craftResult } = displayInputs;
  const latestSnapshot = options.ignoreSnapshot
    ? null
    : snapshotSettled.status === "fulfilled" ? snapshotSettled.value : null;
  // Dirty-signal lookup failures fail open — defaulting to false preserves
  // the existing same-day-lock behavior rather than introducing surprise
  // refreshes when Redis hiccups.
  const dirtyFromCache =
    dirtySettled.status === "fulfilled" && dirtySettled.value === true;
  const inputsChanged = options.inputsChanged ?? dirtyFromCache;

  return {
    stats,
    ...materializeImpactState(stats, {
      craftResult,
      latestSnapshot,
      policy: options.policy,
      today: options.today,
      inputsChanged,
    }),
  };
}
