import { dbObservedReceiptManifest } from "@/lib/db/score-receipts-observed";
/**
 * Shared full-response SVG cache for the badge — read by both the
 * `/u/[handle]/badge.svg` route and the share page (#720). Centralizing
 * the key format here ensures both paths point at the same Redis slot and
 * one cannot drift away from the other.
 */
import { readScoringRenderSelection, sameScoringRenderSelection, type ScoringRenderSelection } from "@/lib/scoring-render-selection";
import { resolveBadgeConfigSnapshot } from "./badge-config";
import { cacheDel, cacheGet, cacheSet } from "@/lib/cache/redis";
import { CACHE_VERSION } from "@/lib/cache/version";
import { TimeoutError, withTimeout } from "@/lib/async/with-timeout";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/types";
import { BADGE_RENDER_VARIANT } from "@/lib/render/badge-render-variant";
import {
  badgeEdgeCacheTag,
  ogImageEdgeCacheTag,
  purgeEdgeCacheTag,
  type EdgePurgeOutcome,
} from "@/lib/cache/edge-cache";

/**
 * #1014 — this deadline was previously 250ms, which under Redis tail latency
 * (e.g. launch-traffic spikes) regularly misclassified a genuine cache-hit as
 * a miss, forcing an unnecessary full materialize+render (up to the 3000ms
 * cache-miss SLO budget) instead of a fast cache-hit response. 500ms leaves
 * enough headroom below the 800ms cache-hit SLO for the network round-trip
 * and response construction that follow a successful read.
 */
const CACHE_DEADLINE_MS = 500;
export { BADGE_RENDER_VARIANT };

/**
 * Base TTL for badge SVG cache entries.
 *
 * The key format includes the render variant and today's UTC date, so
 * the key already encodes freshness. The TTL is set slightly longer than 24h so
 * the entry survives into the next day and can be served as a "stale" fallback
 * for lock-losers (PE-M2) before the new day's SVG is rendered.
 *
 * A per-handle jitter of up to 2 hours is added on top of this base to spread
 * UTC-midnight recompute load across handles (PE-S1). The key shape is NOT
 * changed — only the expiry differs between handles.
 */
const CACHE_TTL_BASE_SECONDS = 86_400; // 24h
const CACHE_TTL_JITTER_MAX_SECONDS = 7_200; // up to +2h jitter (PE-S1)

/**
 * #1088 (PE-M1) — short TTL for a placeholder SVG cache write on a handle
 * whose stats carry no `avatarUrl` at all (a permanent condition until the
 * next stats refetch — distinct from a race-timeout on a real fetch, see
 * `finalizeMaterializedBadge` in the badge.svg route). Long enough to stop
 * every single request for such a handle from forcing a full
 * materialize+render (the bug — a README embed with real traffic never got
 * ANY cache population). Short enough that it can't shadow a later good
 * render (e.g. avatarUrl reappearing on a subsequent stats refetch) for
 * anywhere near the 24h+jitter a normal write gets, and far short of the
 * next UTC daily key rollover the cache key itself already encodes.
 */
export const AVATAR_ABSENT_CACHE_TTL_SECONDS = 20 * 60; // 20 minutes

/**
 * Compute a stable per-handle jitter offset (0 to CACHE_TTL_JITTER_MAX_SECONDS).
 *
 * Uses a simple sum-of-char-codes hash so that different handles get different
 * effective cache expiry times, spreading the UTC-midnight recompute herd.
 * The algorithm is intentionally trivial — we only need stable distribution
 * across handles, not cryptographic strength.
 */
export function handleCacheJitterSeconds(handle: string): number {
  const lower = handle.toLowerCase();
  let hash = 0;
  for (let i = 0; i < lower.length; i++) {
    hash = (hash * 31 + lower.charCodeAt(i)) >>> 0; // keep it 32-bit unsigned
  }
  return hash % (CACHE_TTL_JITTER_MAX_SECONDS + 1);
}

/**
 * @param locale - #1181 (UX-H3) — an es-rendered and en-rendered badge for the
 *   same handle/day must never share a cache slot. Defaults to DEFAULT_LOCALE
 *   ('en') so callers outside this issue's ownership that still pass only
 *   (handle, date) — the share page, warm-cache cron, platform-oauth
 *   invalidation, post-write-invalidation — keep compiling and land on the
 *   same slot the badge.svg route uses for an unqualified (no `?lang=`)
 *   request. Adding this segment doubles cache cardinality and invalidates
 *   every previously-warm key (expected, see #1181).
 */
export function buildBadgeSvgCacheKey(
  handle: string,
  date: string,
  locale: Locale = DEFAULT_LOCALE,
  machinePolicy: ScoringRenderSelection["machinePolicy"] = "v6",
): string {
  return `badge:${CACHE_VERSION}:${handle.toLowerCase()}:${BADGE_RENDER_VARIANT}:${machinePolicy}:${date}:${locale}`;
}

/**
 * Build the Redis key for the PNG rendered by `/u/:handle/og-image`.
 *
 * Kept beside the SVG key because Studio and profile writes must invalidate
 * both rendered representations together. Normalizing the handle ensures a
 * request and a write use the same slot regardless of URL/login casing.
 */
export function buildOgImageCacheKey(
  handle: string,
  date: string,
  locale: Locale = DEFAULT_LOCALE,
  machinePolicy: ScoringRenderSelection["machinePolicy"] = "v6",
): string {
  // A layout version changes PNG bytes just as it changes the inline SVG.
  return `og-image:v5:${handle.toLowerCase()}:${BADGE_RENDER_VARIANT}:${machinePolicy}:${date}:${locale}`;
}

/** Version shared by the OG metadata URL and its revision-fenced Redis value. */
export function buildOgImageCacheVersion(
  date: string,
  revision: number | null,
  machinePolicy: ScoringRenderSelection["machinePolicy"] = "v6",
): string {
  return `${BADGE_RENDER_VARIANT}-${machinePolicy}-${date}-${revision === null ? "default" : `r${revision}`}`;
}

export function buildBadgeSvgRenderLockKey(
  handle: string,
  date: string,
  locale: Locale = DEFAULT_LOCALE,
  machinePolicy: ScoringRenderSelection["machinePolicy"] = "v6",
): string {
  return buildBadgeSvgCacheKey(handle, date, locale, machinePolicy).replace(/^badge:/, "badge-lock:");
}

async function withCacheFallback<T>(
  promise: Promise<T>,
  fallback: T,
  label: string,
): Promise<T> {
  try {
    return await withTimeout(promise, CACHE_DEADLINE_MS, label);
  } catch {
    return fallback;
  }
}

export async function readBadgeSvgCache(key: string): Promise<string | null> {
  return withCacheFallback(
    cacheGet<string>(key),
    null,
    "badge cache read",
  );
}

export interface BadgeSvgCacheReadResult {
  /** The cached SVG, or null on a genuine miss, a Redis error, or a deadline timeout. */
  svg: string | null;
  /**
   * #1014 — true when the read did not resolve within CACHE_DEADLINE_MS. This
   * is NOT a genuine cache miss: the underlying Redis read may still complete
   * (with a hit) after we've already given up waiting on it. Callers that emit
   * Server-Timing metrics should surface this distinctly from a real miss so
   * the failure mode is observable instead of silently looking like normal
   * cache churn.
   */
  timedOut: boolean;
}

/**
 * Read the badge SVG cache and distinguish a deadline timeout from a genuine
 * miss or Redis error (#1014). Use this at the route's primary cache-hit check
 * so a timeout can be reported distinctly in Server-Timing; other call sites
 * that don't need this distinction can keep using {@link readBadgeSvgCache}.
 */
export async function readBadgeSvgCacheWithStatus(
  key: string,
): Promise<BadgeSvgCacheReadResult> {
  try {
    const svg = await withTimeout(
      cacheGet<string>(key),
      CACHE_DEADLINE_MS,
      "badge cache read",
    );
    return { svg, timedOut: false };
  } catch (err) {
    if (err instanceof TimeoutError) {
      return { svg: null, timedOut: true };
    }
    return { svg: null, timedOut: false };
  }
}

export type ScoringImageReceiptIdentity = { readonly revisionId: string; readonly contentHash: string };

/** Fence both an existing observed receipt and a genuine no-receipt fallback
 * against report publication or withdrawal while rendering. */
export async function isScoringImageReceiptCurrent(
  handle: string,
  selection: ScoringRenderSelection,
  identity: ScoringImageReceiptIdentity | null,
): Promise<boolean> {
  if (!selection.cacheable) return false;
  if (selection.machinePolicy === "v6") return true;
  try {
    const current = await withTimeout(dbObservedReceiptManifest(handle), CACHE_DEADLINE_MS, "image receipt fence");
    return identity === null ? current.status === "missing" : current.status === "found"
      && current.manifest.isCurrent && current.manifest.revisionId === identity.revisionId
      && current.manifest.contentHash === identity.contentHash;
  } catch { return false; }
}

/**
 * Write the rendered SVG to the badge cache.
 *
 * The TTL is base 24h + a per-handle jitter of up to 2h (PE-S1) to spread
 * UTC-midnight cache expiry across handles and avoid a recompute herd.
 * The render variant is part of the key so a visual contract change can
 * invalidate old SVGs. Within one variant, only expiry differs per handle.
 *
 * @param key  - Cache key built by {@link buildBadgeSvgCacheKey}
 * @param svg  - Rendered SVG string
 * @param handle - The GitHub handle (used to derive the jitter offset)
 * @param options.ttlSeconds - #1088 — explicit TTL override, used for a
 *   short-lived placeholder write (see {@link AVATAR_ABSENT_CACHE_TTL_SECONDS}).
 *   When omitted, falls back to the standard 24h+jitter TTL.
 */
export async function writeBadgeSvgCache(
  key: string,
  svg: string,
  handle: string,
  options: { ttlSeconds?: number; scoringSelection: ScoringRenderSelection; configRevision?: number | null; receiptIdentity?: ScoringImageReceiptIdentity | null },
): Promise<boolean> {
  const selection = options.scoringSelection;
  const current = async () => {
    if (!sameScoringRenderSelection(selection, await readScoringRenderSelection({ force: true }))) return false;
    if (!await isScoringImageReceiptCurrent(handle, selection, options.receiptIdentity ?? null)) return false;
    if ("configRevision" in options) {
      const config = await resolveBadgeConfigSnapshot(handle);
      if (!config.cacheable || config.revision !== options.configRevision) return false;
    }
    return true;
  };
  if (!await current()) return false;
  const ttl = options.ttlSeconds ?? CACHE_TTL_BASE_SECONDS + handleCacheJitterSeconds(handle);
  // Keep the fence attached to the underlying write, even if the foreground
  // deadline expires: a late Redis completion must not escape invalidation.
  const publication = (async () => {
    const written = await cacheSet(key, svg, ttl);
    if (!await current()) {
      await cacheDel(key);
      return false;
    }
    return written;
  })();
  return withCacheFallback(publication, false, "badge cache write");
}

export interface BadgeInvalidationResult {
  /** True unless a Redis delete threw outside `cacheDel`'s own error swallow. */
  redis: boolean;
  edge: EdgePurgeOutcome;
}

/**
 * Whether a caller can trust the badge is actually showing the new state
 * everywhere. `edge: "skipped"` (outside Vercel — local dev, unit tests, CI)
 * still counts: there is no edge cache there to be stale. Owned here, next to
 * the result shape it interprets, so a future caller that needs to report
 * success (the way the Studio save route reports `badgeRefreshed`) doesn't
 * re-derive this formula independently.
 */
export function isBadgeCacheRefreshed(result: BadgeInvalidationResult): boolean {
  return result.redis && result.edge !== "failed";
}

/**
 * Clear today's and yesterday's SVG/PNG slots for both machine policies and
 * every locale, then purge both per-handle edge tags. Yesterday must be cleared
 * because render-lock losers can serve it. Active locks are left intact.
 */
export async function invalidateBadgeSvgCacheForHandle(
  handle: string,
  date: string,
): Promise<BadgeInvalidationResult> {
  const [redisOutcomes, edgeOutcomes] = await Promise.all([
    Promise.all(
      [date, new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)].flatMap(day =>
        (["v6", "v7.2"] as const).flatMap(policy => SUPPORTED_LOCALES.flatMap(locale => [
          cacheDel(buildBadgeSvgCacheKey(handle, day, locale, policy)),
          cacheDel(buildOgImageCacheKey(handle, day, locale, policy)),
        ])),
      ),
    ),
    Promise.all([
      purgeEdgeCacheTag(badgeEdgeCacheTag(handle)),
      purgeEdgeCacheTag(ogImageEdgeCacheTag(handle)),
    ]),
  ]);
  const edge: EdgePurgeOutcome = edgeOutcomes.includes("failed")
    ? "failed"
    : edgeOutcomes.includes("purged")
      ? "purged"
      : "skipped";
  return {
    redis: redisOutcomes.every(Boolean),
    edge,
  };
}
