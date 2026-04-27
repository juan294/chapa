import { cacheDel } from "@/lib/cache/redis";
import { buildCraftKey } from "@/lib/cache/craft-cache";
import { buildSnapshotKey } from "@/lib/cache/snapshot-cache";
import { invalidateHistoryCache } from "@/lib/history/history";

type ProfileReadModelInvalidationOptions = {
  stats?: boolean;
  craft?: boolean;
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
