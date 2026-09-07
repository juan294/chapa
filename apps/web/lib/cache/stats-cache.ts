import "server-only";
import { createHmac } from "node:crypto";
import { canonicalJson } from "@chapa/shared";
import type { StatsData } from "@chapa/shared";
import { cacheGet, cacheSet } from "@/lib/cache/redis";
import { getNextauthSecret } from "@/lib/env";
import { githubUserNotFound, isGitHubUserNotFound } from "@/lib/github/not-found";

/**
 * The read-through cache for composed legacy stats.
 *
 * S08 (#1302) removed the pre-existing `stats:v2:merged:` cache because its key
 * was the bare handle, which carried no authorization binding: a fetch made
 * with one credential could be served back to a caller holding a different
 * one. The removal was correct and the replacement is here rather than in the
 * old shape.
 *
 * **The binding lives in the value, not in the key.** A key of
 * `stats:v3:<handle>` keeps invalidation exactly as simple as it was — one
 * `cacheDel` per handle, which is what every `invalidateProfileReadModels`
 * caller already does — while `readCachedStats` refuses any entry whose
 * binding or scoring day does not match the caller's. Putting the binding in
 * the key instead would make a targeted delete impossible without a per-handle
 * index or an epoch counter, and would cost a second Redis round trip on every
 * read to resolve it.
 *
 * The cost of that choice: one handle holds one binding at a time, so an owner
 * fetching with their session token and the badge route fetching with the
 * server `GITHUB_TOKEN` evict each other. Each still pays at most one live
 * fetch, and neither is ever served the other's data, which is the property
 * S08 established. The anonymous badge path — the overwhelming majority of
 * reads — uses a single binding and stays warm.
 *
 * The binding itself is a domain-separated HMAC, so `accessContextId` (an HMAC
 * over the credential itself) never leaves the process, per the rule stated on
 * `PrivateSourceContext`. The fingerprint is still an equality oracle over
 * "same handle, same grant, same day" for anyone who can read Redis; that is
 * unavoidable for any correct authorization-bound cache and is the point.
 */
export const STATS_CACHE_TTL_SECONDS = 21_600; // 6 hours, the pre-S08 TTL.

export function buildStatsCacheKey(handle: string): string {
  return `stats:v3:${handle.toLowerCase()}`;
}

interface CachedStatsEntry {
  readonly binding: string;
  readonly referenceDate: string;
  readonly stats: StatsData;
}

export interface StatsCacheBindingInput {
  /** The private access context ID. Hashed again here; never stored as-is. */
  readonly accessContextId: string;
  /** The linked-platform grant versions, as `getStats` already computes them. */
  readonly links: string;
  /** The UTC scoring day, so a cached entry cannot outlive its own window. */
  readonly referenceDate: string;
}

/**
 * Returns the cache binding for a source context, or `null` when the signing
 * secret is unavailable — in which case the caller skips caching rather than
 * falling back to an unbound key.
 */
export function statsCacheBinding(input: StatsCacheBindingInput): string | null {
  const secret = getNextauthSecret();
  if (!secret) return null;

  return createHmac("sha256", secret)
    .update(
      canonicalJson({
        version: "stats-cache-binding-v1",
        accessContextId: input.accessContextId,
        links: input.links,
        referenceDate: input.referenceDate,
      }),
      "utf8",
    )
    .digest("hex");
}

/** A hit only when the stored entry was written by this exact binding on this
 * exact scoring day. Anything else is a miss, never a downgrade. */
export async function readCachedStats(
  handle: string,
  binding: string,
  referenceDate: string,
): Promise<StatsData | null> {
  const entry = await cacheGet<CachedStatsEntry>(buildStatsCacheKey(handle));
  if (!entry || typeof entry !== "object") return null;
  if (entry.binding !== binding || entry.referenceDate !== referenceDate) return null;
  return entry.stats ?? null;
}

export async function writeCachedStats(
  handle: string,
  binding: string,
  referenceDate: string,
  stats: StatsData,
): Promise<void> {
  const entry: CachedStatsEntry = { binding, referenceDate, stats };
  await cacheSet(buildStatsCacheKey(handle), entry, STATS_CACHE_TTL_SECONDS);
}

// ---------------------------------------------------------------------------
// LE-8-2 — the not-found marker
// ---------------------------------------------------------------------------

/**
 * Short on purpose. The marker only exists so that repeat hits on a handle
 * nobody owns (a crawler, GitHub's camo proxy retrying an embed, a typo
 * someone keeps refreshing) stop reaching GitHub; five minutes is plenty for
 * that, and short enough that a handle claimed today is a real profile
 * within minutes rather than hours.
 */
export const STATS_NOT_FOUND_TTL_SECONDS = 300;

/** Its own key: `stats:v3:` holds stats and nothing else. */
export function buildStatsNotFoundKey(handle: string): string {
  return `stats:notfound:${handle.toLowerCase()}`;
}

/**
 * True only for the sentinel shape. A stray or mistyped value under this key
 * must never 404 a real user, and the tests that mock Redis with one value
 * for every key depend on the same discrimination.
 */
export async function readStatsNotFound(handle: string): Promise<boolean> {
  return isGitHubUserNotFound(await cacheGet<unknown>(buildStatsNotFoundKey(handle)));
}

export async function writeStatsNotFound(handle: string): Promise<void> {
  await cacheSet(
    buildStatsNotFoundKey(handle),
    { ...githubUserNotFound(handle.toLowerCase()), observedAt: new Date().toISOString() },
    STATS_NOT_FOUND_TTL_SECONDS,
  );
}
