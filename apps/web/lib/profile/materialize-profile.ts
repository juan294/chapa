import "server-only";
import type { CraftResult, StatsData } from "@chapa/shared";
import { getCachedCraftScore } from "@/lib/cache/craft-cache";
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
 * for it. */
export type StatsFreshness = "current" | "stale";

export interface MaterializeProfileOptions {
  token?: string;
  readOnly?: boolean;
}

export type MaterializeDisplayProfileOptions = Pick<
  MaterializeProfileOptions,
  "token" | "readOnly"
>;

interface MaterializedStatsState {
  stats: StatsData;
  craftResult: CraftResult | null;
  /** Whether the raw `StatsData` payload looks structurally complete.
   * Unconditionally `false` when `statsFreshness !== "current"` — a stale
   * last-known-good aggregate renders but is never publication-eligible. */
  statsComplete: boolean;
  /** See {@link StatsFreshness}. */
  statsFreshness: StatsFreshness;
  /** When the underlying stats were captured — the fresh-collection instant
   * for `current`, or the original capture instant for a `stale` serve. */
  statsCapturedAt: string;
}

export interface MaterializedProfile extends MaterializedStatsState {
  /**
   * The v7.2 receipt view model, when a current receipt exists (#1335 phase
   * 5). `undefined` means there is nothing to draw: the caller's own
   * `ScoringStatus` placeholder (collecting/action_needed/unregistered/
   * unavailable, `lib/collection/read-scoring-status.ts`) governs what
   * renders instead of a normal score.
   */
  scoring?: ScoreViewModel;
}

export type MaterializedDisplayProfile = MaterializedProfile;

function statsLookComplete(stats: StatsData): boolean {
  return isValidLegacyStats(stats);
}

interface DisplayInputs {
  stats: StatsData;
  craftResult: CraftResult | null;
  statsFreshness: StatsFreshness;
  statsCapturedAt: string;
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

function materializeStatsState(
  stats: StatsData,
  craftResult: CraftResult | null,
  statsFreshness: StatsFreshness = "current",
  statsCapturedAt: string = new Date().toISOString(),
): MaterializedStatsState {
  return {
    stats,
    craftResult,
    statsComplete: statsFreshness === "current" && statsLookComplete(stats),
    statsFreshness,
    statsCapturedAt,
  };
}

/**
 * Materialize the live display-only profile fields.
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
  options: MaterializeDisplayProfileOptions = {},
): Promise<MaterializedDisplayProfile | null> {
  const [inputs, receipt] = await Promise.all([
    loadDisplayInputs(handle, options.token, options.readOnly ?? false),
    readRenderableReceipt(handle),
  ]);
  if (!inputs || isGitHubUserNotFound(inputs)) return null;

  return {
    ...materializeStatsState(inputs.stats, inputs.craftResult, inputs.statsFreshness, inputs.statsCapturedAt),
    scoring: scoreModelFrom(handle, receipt),
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
  // #800 — stats and the receipt read only need the handle, so they run
  // concurrently.
  const [displayInputsSettled, receiptSettled] = await Promise.allSettled([
    loadDisplayInputs(handle, options.token, options.readOnly),
    readRenderableReceipt(handle),
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

  return {
    ...materializeStatsState(stats, craftResult, statsFreshness, statsCapturedAt),
    scoring: receiptSettled.status === "fulfilled" ? scoreModelFrom(handle, receiptSettled.value) : undefined,
  };
}
