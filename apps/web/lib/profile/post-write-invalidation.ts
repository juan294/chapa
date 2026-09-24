import { cacheDel } from "@/lib/cache/redis";
import { buildStatsCacheKey } from "@/lib/cache/stats-cache";
import { buildCraftKey } from "@/lib/cache/craft-cache";
import { invalidateBadgeSvgCacheForHandle } from "@/lib/render/badge-svg-cache";
import { toDateString } from "@/lib/utils/date";

type ProfileReadModelInvalidationOptions = {
  stats?: boolean;
  craft?: boolean;
  badgeSvg?: boolean;
};

async function runInvalidationStep(step: () => Promise<unknown>): Promise<void> {
  try {
    await step();
  } catch {
    // Cache invalidation is best-effort. Keep moving through the sequence.
  }
}

/**
 * #1335 phase 5 ("delete v6") — the `snapshot`/`history` invalidation steps
 * this used to run (`metrics_snapshots`'s Redis mirror and the v6 lifetime
 * history cache) are retired along with those stores. There is no snapshot
 * or history cache left to invalidate: the v7.2 receipt is the durable
 * artifact, minted and read directly, with no separate cache layer of its
 * own to bust here.
 */
export async function invalidateProfileReadModels(
  handle: string,
  options: ProfileReadModelInvalidationOptions,
): Promise<void> {
  const normalizedHandle = handle.toLowerCase();

  // Each step targets an independent cache key, so none needs the others to
  // finish first — run them concurrently rather than one-at-a-time.
  // #1191 hotfix (v2.29.2) made this matter: the badgeSvg step now includes a
  // network-bound Vercel edge purge (up to EDGE_PURGE_DEADLINE_MS) alongside
  // its Redis deletes, so sequencing it in front of the other steps added up
  // to that long to every caller's wall time for no reason — including
  // bulk-recalculate's per-handle loop, none of whose callers read a
  // "did the badge actually refresh" result the way the Studio save route
  // does (that's `apps/web/lib/render/badge-svg-cache.ts`'s
  // `isBadgeCacheRefreshed`, consumed only by `app/api/studio/config/route.ts`).
  await Promise.allSettled([
    options.stats &&
      runInvalidationStep(() => cacheDel(buildStatsCacheKey(normalizedHandle))),

    options.craft &&
      runInvalidationStep(() => cacheDel(buildCraftKey(normalizedHandle))),

    // #1190 — the rendered badge is cached per locale, so clearing only the
    // default slot leaves every other locale serving pre-write data until the
    // 24h+jitter TTL rolls over. Delegates to the shared helper, which also
    // purges the Vercel edge tag; Redis alone left the edge serving a
    // pre-write badge for up to a day.
    options.badgeSvg &&
      runInvalidationStep(async () => {
        await invalidateBadgeSvgCacheForHandle(normalizedHandle, toDateString(new Date()));
      }),
  ]);
}
