import { type NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth/cron";
import { withErrorCapture } from "@/lib/analytics/server-errors";
import { runCollectionTick } from "@/lib/collection/worker";
import { cacheSet } from "@/lib/cache/redis";

/**
 * GET /api/cron/collect-evidence
 *
 * Durable resumable evidence collection worker (#1335 phase 3). Every 5
 * minutes, claims runnable `scoring_collection_jobs` rows (queued, retrying,
 * waiting_rate_limit, or a `running` row whose lease has expired) and runs
 * one collector slice each -- bounded by a per-slice request budget and
 * deadline, never by "the whole 365-day window in one call". A job that
 * cannot finish within its slice is checkpointed and released, so the next
 * claim (in this same tick, or the next cron invocation) resumes it rather
 * than starting over. See
 * docs/plans/2026-09-23-universal-v72-reliable-collection-phases/phase-3.md.
 *
 * Protected by CRON_SECRET -- Vercel sends this automatically as a Bearer
 * token, matching every other route under `/api/cron/*`.
 */
export const maxDuration = 300;

const HEARTBEAT_KEY = "cron:lastrun:collect-evidence";
const HEARTBEAT_TTL_SECONDS = 60 * 60 * 48;

/** Leaves headroom under `maxDuration` for the response to actually return. */
const TICK_BUDGET_MS = (maxDuration - 30) * 1000;

export const GET = withErrorCapture("/api/cron/collect-evidence", async (request: NextRequest) => {
  const denied = verifyCronSecret(request);
  if (denied) return denied;

  const start = Date.now();
  const { slicesRun } = await runCollectionTick(TICK_BUDGET_MS);
  const durationMs = Date.now() - start;

  await cacheSet(HEARTBEAT_KEY, Date.now(), HEARTBEAT_TTL_SECONDS);

  return NextResponse.json(
    { slicesRun, durationMs },
    { headers: { "Cache-Control": "no-store" } },
  );
});
