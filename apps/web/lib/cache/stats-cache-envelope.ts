import { canonicalJson } from "@chapa/shared";
import type { StatsData } from "@chapa/shared";

/**
 * Pure companions to `lib/cache/stats-cache.ts`, split out deliberately
 * without an `import "server-only"` guard.
 *
 * `stats-cache.ts` begins with `import "server-only"`, so any module that
 * imports it — even for a single type or a pure function — throws
 * immediately outside a Server Component context (`server-only`'s `index.js`
 * unconditionally throws under Node's default export condition). Disposable
 * browser/qualification fixtures (`apps/web/e2e/helpers/*`,
 * `scripts/quality/*`) run under plain `tsx`/Node, not the Next.js
 * `react-server` condition, so they cannot import `stats-cache.ts` at all —
 * confirmed by trying it directly. Before this split, that forced every
 * fixture writer to hand-duplicate the binding domain string and the
 * envelope shape, which is exactly how they drifted: a fixture kept writing
 * `{ binding, referenceDate, stats }` under the old `stats-cache-binding-v1`
 * domain after `stats-cache.ts` moved to the versioned `schemaVersion: 2`
 * envelope and the `-v2` domain.
 *
 * This module holds nothing but pure, side-effect-free shape logic, so it is
 * safe for both the server module and any disposable fixture to import
 * directly and stay byte-for-byte in sync with what `readCachedStats`
 * accepts.
 */

export const STATS_CACHE_BINDING_VERSION = "stats-cache-binding-v2";

export interface StatsCacheBindingInput {
  /** The private access context ID. Hashed again by the caller; never stored as-is. */
  readonly accessContextId: string;
  /** The linked-platform grant versions, as `getStats`/`readStats` already compute them. */
  readonly links: string;
}

/**
 * The exact canonical bytes `statsCacheBinding` HMACs. A caller that already
 * knows the signing secret (the server module, or a disposable local fixture
 * seeded with the same local-only secret) can sign these bytes directly
 * instead of re-deriving the domain string and field shape independently.
 */
export function statsCacheBindingBytes(input: StatsCacheBindingInput): string {
  return canonicalJson({
    version: STATS_CACHE_BINDING_VERSION,
    accessContextId: input.accessContextId,
    links: input.links,
  });
}

export interface CachedStatsEnvelopeV2 {
  readonly schemaVersion: 2;
  readonly authorizationBinding: string;
  readonly referenceDate: string;
  readonly capturedAt: string;
  readonly freshUntil: string;
  readonly stats: StatsData;
}

/**
 * Pure envelope builder — the exact shape `readCachedStats` accepts as
 * `fresh`/`stale`. `writeCachedStats` is the only production writer, but any
 * fixture that needs to seed a pre-warmed cache-hit row for tests must build
 * it the same way, through this function, rather than duplicating the shape.
 */
export function buildStatsCacheEnvelope(
  binding: string,
  referenceDate: string,
  stats: StatsData,
  now: Date,
  freshSeconds: number,
): CachedStatsEnvelopeV2 {
  const capturedAt = now.toISOString();
  const freshUntil = new Date(now.getTime() + freshSeconds * 1000).toISOString();
  return {
    schemaVersion: 2,
    authorizationBinding: binding,
    referenceDate,
    capturedAt,
    freshUntil,
    stats: structuredClone(stats),
  };
}
