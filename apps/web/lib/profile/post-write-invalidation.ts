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

  if (options.stats) {
    await runInvalidationStep(() =>
      cacheDel(`stats:v2:merged:${normalizedHandle}`),
    );
  }

  if (options.craft) {
    await runInvalidationStep(() =>
      cacheDel(buildCraftKey(normalizedHandle)),
    );
  }

  if (options.badgeSvg) {
    // #1190 — the rendered badge is cached per locale, so clearing only the
    // default slot leaves every other locale serving pre-write data until the
    // 24h+jitter TTL rolls over. #1191 hotfix (v2.29.2) — delegates to the
    // shared helper, which also purges the Vercel edge tag; Redis alone left
    // the edge serving a pre-write badge for up to a day.
    await runInvalidationStep(async () => {
      await invalidateBadgeSvgCacheForHandle(normalizedHandle, toDateString(new Date()));
    });
  }

  if (options.snapshot) {
    await runInvalidationStep(() =>
      cacheDel(buildSnapshotKey(normalizedHandle)),
    );
  }

  if (options.history) {
    await runInvalidationStep(() =>
      invalidateHistoryCache(normalizedHandle),
    );
  }
}
