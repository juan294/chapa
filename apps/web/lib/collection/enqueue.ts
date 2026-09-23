import "server-only";
import { after } from "next/server";
import { enqueueCollectionJob, type CollectionJob, type EnqueueReason } from "@/lib/db/collection-queue";
import { readSourceAuthorization, type SourceProvider } from "@/lib/platform/source-authorization";
import { captureServerError } from "@/lib/analytics/server-errors";
import { runCollectionTick } from "./worker";

const ALL_PROVIDERS: readonly SourceProvider[] = ["github", "bitbucket", "gitlab", "codeberg"];

/**
 * Enqueues a collection job for every one of an owner's *connected*
 * providers -- GitHub always (the primary identity a registered subject is
 * built on), the others only when their feature flag is on and the owner has
 * a linked account (`readSourceAuthorization`). Pass `provider` to enqueue
 * one provider only (e.g. a single platform's reconnect callback).
 *
 * Called only from the authenticated/durable-write side of the app --
 * signup, an owner's own refresh/recalculate/generate, a platform reconnect,
 * the warm-cache cron, or an admin action (#1335 phase 4). Never from a
 * public read: `/u/:handle` and `/u/:handle/badge.svg` accept any handle on
 * earth, and enqueueing there would be the same mistake #1239 fixed for the
 * `users` table.
 *
 * A per-provider enqueue failure is captured and skipped rather than failing
 * the whole call -- one platform's transient DB error must not stop the
 * owner's GitHub collection from being enqueued.
 */
export async function enqueueCollection(
  owner: string,
  reason: EnqueueReason,
  provider?: SourceProvider,
): Promise<readonly CollectionJob[]> {
  const referenceTime = new Date().toISOString();
  const candidates = provider ? [provider] : ALL_PROVIDERS;
  const jobs: CollectionJob[] = [];

  for (const candidate of candidates) {
    try {
      const authorization = await readSourceAuthorization(owner, candidate);
      if (authorization.status !== "authorized") continue;
      jobs.push(await enqueueCollectionJob(owner, candidate, reason, referenceTime));
    } catch (error) {
      void captureServerError({
        route: "lib/collection/enqueue",
        statusCode: 500,
        error: new Error(`enqueueCollection failed for ${owner}/${candidate}: ${(error as Error).message}`),
      });
    }
  }

  return jobs;
}

/** Bounded enough to leave headroom under a route's own response deadline;
 * generous enough to make real progress on a newly enqueued job before the
 * next 5-minute collect-evidence cron tick would have picked it up anyway. */
const DEFAULT_ADVANCE_BUDGET_MS = 60_000;

/**
 * Runs a bounded collection tick in the background so a newly enqueued job
 * gets its first slice soon, without the write route waiting on it (#1335
 * phase 4: "enqueue, then run one slice via after()"). Registers the work
 * with Next's `after()` before the caller returns its response, per
 * `.claude/rules/post-response-work.md`; the next `collect-evidence` cron
 * tick (every 5 minutes) still carries the job the rest of the way if this
 * budget runs out.
 *
 * Callers already inside their own `after()` (e.g. the OAuth callback) must
 * not call this -- `after()` cannot usefully nest -- and should instead
 * `await runCollectionTick(...)` directly in their existing callback.
 */
export function scheduleCollectionAdvance(budgetMs = DEFAULT_ADVANCE_BUDGET_MS): void {
  after(async () => {
    try {
      await runCollectionTick(budgetMs);
    } catch (error) {
      await captureServerError({
        route: "lib/collection/enqueue:scheduleCollectionAdvance",
        statusCode: 500,
        error,
      });
    }
  });
}
