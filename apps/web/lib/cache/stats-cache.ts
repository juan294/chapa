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
 * binding does not match the caller's. Putting the binding in the key instead
 * would make a targeted delete impossible without a per-handle index or an
 * epoch counter, and would cost a second Redis round trip on every read to
 * resolve it.
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
 * "same handle, same grant" for anyone who can read Redis; that is
 * unavoidable for any correct authorization-bound cache and is the point.
 *
 * **Fresh vs. stale (2026-09-22, the badge-source-outage-resilience plan).**
 * A production outage on one linked source's token refresh (an ambiguous,
 * durably-claimed "busy" result — see `source-refresh.ts`) used to turn the
 * whole badge into the generic load-error artifact, even though a complete
 * aggregate had been collected minutes earlier under the exact same grants.
 * The envelope below is versioned and carries its own capture/freshness
 * timestamps so a caller can serve that last-known-good aggregate as
 * explicitly stale rather than nothing at all:
 *
 * - `referenceDate` LEFT the authorization binding. The binding now covers
 *   only the GitHub access context and the exact linked-source states, so a
 *   record written yesterday is still exactly-bound today — it is just no
 *   longer "fresh" by clock time.
 * - A same-`referenceDate` record is `fresh` for `FRESH_SECONDS` after
 *   capture (six hours, the pre-existing TTL).
 * - Any exactly-bound record is eligible as `stale` for up to
 *   `RETENTION_SECONDS` after capture (seven days) — old enough that Redis
 *   itself, not this module, is the outer bound (the key's TTL is set to the
 *   retention window).
 * - `schemaVersion` is checked exactly. An old `{ binding, referenceDate,
 *   stats }` row, or anything with a missing/invalid field, is a miss rather
 *   than an implicit upgrade. `statsCacheBinding`'s HMAC domain string was
 *   also bumped (`-v2`), so even a byte-identical old row cannot collide with
 *   a new binding.
 *
 * Serving `stale` is a cache-module concern only: this module does not decide
 * whether a caller may act on a stale read. `client.ts` re-checks the exact
 * current authorization before trusting either result, and the profile
 * materializer (`lib/profile/materialize-profile.ts`) propagates the
 * distinction so publication/verification gates can refuse anything not
 * `current`.
 */
export const FRESH_SECONDS = 6 * 60 * 60; // 6 hours: a same-day hit stays "fresh".
export const RETENTION_SECONDS = 7 * 24 * 60 * 60; // 7 days: the outer bound for a "stale" last-known-good serve.

export function buildStatsCacheKey(handle: string): string {
  return `stats:v3:${handle.toLowerCase()}`;
}

interface CachedStatsEnvelopeV2 {
  readonly schemaVersion: 2;
  readonly authorizationBinding: string;
  readonly referenceDate: string;
  readonly capturedAt: string;
  readonly freshUntil: string;
  readonly stats: StatsData;
}

export interface StatsCacheBindingInput {
  /** The private access context ID. Hashed again here; never stored as-is. */
  readonly accessContextId: string;
  /** The linked-platform grant versions, as `getStats`/`readStats` already compute them. */
  readonly links: string;
}

/**
 * Returns the cache binding for a source context, or `null` when the signing
 * secret is unavailable — in which case the caller skips caching rather than
 * falling back to an unbound key.
 *
 * Deliberately excludes the scoring day: the day now lives only in the
 * envelope's `referenceDate`/freshness fields, so the same grant's binding is
 * stable across a UTC-day rollover and a stale-but-exactly-bound record from
 * yesterday can still be matched and served as stale.
 */
export function statsCacheBinding(input: StatsCacheBindingInput): string | null {
  const secret = getNextauthSecret();
  if (!secret) return null;

  return createHmac("sha256", secret)
    .update(
      canonicalJson({
        version: "stats-cache-binding-v2",
        accessContextId: input.accessContextId,
        links: input.links,
      }),
      "utf8",
    )
    .digest("hex");
}

export type CachedStatsRead =
  | { readonly status: "fresh"; readonly stats: StatsData; readonly capturedAt: string }
  | { readonly status: "stale"; readonly stats: StatsData; readonly capturedAt: string }
  | { readonly status: "miss" };

function isValidEnvelope(value: unknown): value is CachedStatsEnvelopeV2 {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<CachedStatsEnvelopeV2>;
  return (
    entry.schemaVersion === 2 &&
    typeof entry.authorizationBinding === "string" &&
    typeof entry.referenceDate === "string" &&
    typeof entry.capturedAt === "string" &&
    typeof entry.freshUntil === "string" &&
    !Number.isNaN(Date.parse(entry.capturedAt)) &&
    !Number.isNaN(Date.parse(entry.freshUntil)) &&
    !!entry.stats &&
    typeof entry.stats === "object"
  );
}

/**
 * A `fresh` result only when the stored entry was written by this exact
 * binding, on this exact scoring day, within the fresh window. A `stale`
 * result for any other exactly-bound entry still inside the retention window.
 * Anything else — a foreign binding, an unversioned/legacy row, a corrupt
 * timestamp, an expired entry — is a `miss`, never a silent downgrade.
 */
export async function readCachedStats(
  handle: string,
  binding: string,
  referenceDate: string,
  now: Date = new Date(),
): Promise<CachedStatsRead> {
  const entry = await cacheGet<unknown>(buildStatsCacheKey(handle));
  if (!isValidEnvelope(entry)) return { status: "miss" };
  if (entry.authorizationBinding !== binding) return { status: "miss" };

  const nowMs = now.getTime();
  const capturedMs = Date.parse(entry.capturedAt);
  const freshUntilMs = Date.parse(entry.freshUntil);

  if (entry.referenceDate === referenceDate && nowMs <= freshUntilMs) {
    return { status: "fresh", stats: structuredClone(entry.stats), capturedAt: entry.capturedAt };
  }
  if (nowMs - capturedMs <= RETENTION_SECONDS * 1000) {
    return { status: "stale", stats: structuredClone(entry.stats), capturedAt: entry.capturedAt };
  }
  return { status: "miss" };
}

export async function writeCachedStats(
  handle: string,
  binding: string,
  referenceDate: string,
  stats: StatsData,
  now: Date = new Date(),
): Promise<void> {
  const capturedAt = now.toISOString();
  const freshUntil = new Date(now.getTime() + FRESH_SECONDS * 1000).toISOString();
  const entry: CachedStatsEnvelopeV2 = {
    schemaVersion: 2,
    authorizationBinding: binding,
    referenceDate,
    capturedAt,
    freshUntil,
    stats: structuredClone(stats),
  };
  // The Redis TTL is the outer retention bound, not the fresh window — a
  // record must survive past `freshUntil` so a later failure can still serve
  // it as stale.
  await cacheSet(buildStatsCacheKey(handle), entry, RETENTION_SECONDS);
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
