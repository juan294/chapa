import { cacheDel } from "@/lib/cache/redis";
import { buildCraftKey } from "@/lib/cache/craft-cache";
import { buildSnapshotKey } from "@/lib/cache/snapshot-cache";
import { invalidateHistoryCache } from "@/lib/history/history";
import { invalidateBadgeSvgCacheForHandle } from "@/lib/render/badge-svg-cache";
import { toDateString } from "@/lib/utils/date";

type ProfileReadModelInvalidationOptions = {
  stats?: boolean;
  craft?: boolean;
  badgeSvg?: boolean;
  snapshot?: boolean;
  history?: boolean;
};

async function runInvalidationStep(step: () => Promise<void>): Promise<void> {
  try {
    await step();
  } catch {
    // Cache invalidation is best-effort. Keep moving through the sequence.
  }
}

export async function invalidateProfileReadModels(
  handle: string,
  options: ProfileReadModelInvalidationOptions,
): Promise<void> {
  const normalizedHandle = handle.toLowerCase();

  // Each step targets an independent cache key, so none needs the others to
  // finish first — run them concurrently rather than one-at-a-time.
  // #1191 hotfix (v2.29.2) made this matter: the badgeSvg step now includes a
  // network-bound Vercel edge purge (up to EDGE_PURGE_DEADLINE_MS) alongside
  // its Redis deletes, so sequencing it in front of snapshot/history added up
  // to that long to every caller's wall time for no reason — including
  // bulk-recalculate's per-handle loop, none of whose callers read a
  // "did the badge actually refresh" result the way the Studio save route
  // does (that's `apps/web/lib/render/badge-svg-cache.ts`'s
  // `isBadgeCacheRefreshed`, consumed only by `app/api/studio/config/route.ts`).
  await Promise.allSettled([
    options.stats &&
      runInvalidationStep(() => cacheDel(`stats:v2:merged:${normalizedHandle}`)),

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

    options.snapshot &&
      runInvalidationStep(() => cacheDel(buildSnapshotKey(normalizedHandle))),

    options.history &&
      runInvalidationStep(() => invalidateHistoryCache(normalizedHandle)),
  ]);
}
