import { cacheDel } from "@/lib/cache/redis";
import { buildCraftKey } from "@/lib/cache/craft-cache";
import { buildSnapshotKey } from "@/lib/cache/snapshot-cache";
import { invalidateHistoryCache } from "@/lib/history/history";
import { buildBadgeSvgCacheKey } from "@/lib/render/badge-svg-cache";
import { SUPPORTED_LOCALES } from "@/lib/i18n/types";
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
    // 24h+jitter TTL rolls over. There are two locales; delete both rather
    // than reasoning about which one a given visitor will ask for.
    const today = toDateString(new Date());
    for (const locale of SUPPORTED_LOCALES) {
      await runInvalidationStep(() =>
        cacheDel(buildBadgeSvgCacheKey(normalizedHandle, today, locale)),
      );
    }
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
