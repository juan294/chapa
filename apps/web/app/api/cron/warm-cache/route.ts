import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth/cron";
import { getWarmCachePriorityHandles } from "@/lib/env";
import { dbGetUsers } from "@/lib/db/users";
import {
  dbGetLatestSnapshotBatch,
  dbCleanOldSnapshots,
} from "@/lib/db/snapshots";
import { compareSnapshots } from "@/lib/history/diff";
import { isSignificantChange } from "@/lib/history/significant-change";
import { notifyScoreBump } from "@/lib/email/score-bump";
import { dbCleanExpiredVerifications } from "@/lib/db/verification";
import { dbCleanExpiredMergeOperations } from "@/lib/db/telemetry";
import { cacheGet, cacheSet } from "@/lib/cache/redis";
import { fireAndForget } from "@/lib/async/fire-and-forget";
import { processInBatches } from "@/lib/async/process-in-batches";
import {
  captureServerError,
  captureServerEvent,
  captureOperationalAlert,
  withErrorCapture,
} from "@/lib/analytics/server-errors";
import { getRequestId } from "@/lib/log";
import { getAvatarBase64 } from "@/lib/render/avatar";
import {
  materializeOrchestratedProfile,
  persistOrchestratedSnapshot,
} from "@/lib/profile/orchestrated-profile";

/** Vercel Pro allows up to 300s for serverless functions. */
export const maxDuration = 300;

/**
 * Maximum handles to warm per cron invocation (stay within GitHub rate
 * limits and the maxDuration budget above).
 *
 * #1010 — rate-limit math: each handle warm makes at most one GitHub
 * GraphQL call (contribution data + the authoritative merged-PR search are
 * both fields on a single `fetchContributionData` request — see
 * `lib/github/queries.ts`), and only on a stats-cache miss (6h TTL, see
 * `lib/github/client.ts`'s CACHE_TTL) — a warm re-run inside that window is
 * a cache hit and makes zero GitHub calls. Since the Vercel cron schedule
 * (`vercel.json`) was bumped from once daily to hourly, worst case this cron
 * now makes up to MAX_HANDLES GraphQL calls *per hour* instead of per day —
 * at 50/hour that's ~1,200/day, still only ~1% of GitHub's 5,000/hr
 * authenticated budget (`GITHUB_TOKEN`; 50 ÷ 5,000, not the daily total
 * compared against the hourly budget), leaving ample headroom for real user traffic
 * hitting `getStats()` on the same token pool. MAX_HANDLES was deliberately
 * left unchanged rather than raised alongside the frequency bump — the
 * per-run batch count (MAX_HANDLES / BATCH_SIZE) is what bounds worst-case
 * duration against `maxDuration`, and hourly cadence alone already shrinks
 * the full-rotation gap ~24x (see the `warm_cache_ceiling_approached` alert
 * below for what that gap now means).
 */
const MAX_HANDLES = 50;

/** Number of handles to process concurrently per batch. */
const BATCH_SIZE = 5;

/** Redis key storing the rotation offset for round-robin handle processing. */
const ROTATION_KEY = "cron:warm-cache:offset";
const HEARTBEAT_KEY = "cron:lastrun:warm-cache";
const HEARTBEAT_TTL_SECONDS = 60 * 60 * 48;

/** Per-handle result from warmHandle, used to aggregate counters. */
interface HandleResult {
  warmed: boolean;
  snapshotRecorded: boolean;
  notified: boolean;
}

/**
 * GET /api/cron/warm-cache
 *
 * Vercel Cron endpoint that pre-warms the stats cache for all known users.
 * Reads the user list from Supabase, and calls getStats() for each to
 * refresh their 6-hour cache window. Runs hourly (#1010; was once daily) —
 * see MAX_HANDLES above for the GitHub rate-limit math behind that cadence.
 *
 * Handles are processed in parallel batches of 5 for throughput while
 * staying gentle on GitHub rate limits. Individual failures are isolated
 * — one handle failing does not block the rest.
 *
 * Protected by CRON_SECRET — Vercel sends this automatically as a Bearer token.
 */
export const GET = withErrorCapture("/api/cron/warm-cache", async (request: NextRequest) => {
  const requestId = getRequestId(request);
  // Auth: Vercel sends CRON_SECRET as Authorization: Bearer <secret>
  const denied = verifyCronSecret(request);
  if (denied) return denied;

  const start = Date.now();

  // Discover all known handles from Supabase (authoritative user list)
  const users = await dbGetUsers();
  const allHandles = users.map((u) => u.handle);

  // Rotation: read stored offset, slice with wrap-around, store next offset
  const storedOffset = await cacheGet<number>(ROTATION_KEY);
  const offset = (storedOffset != null && storedOffset < allHandles.length)
    ? storedOffset
    : 0;

  // Priority handles are always included, while the rotating scan fills every
  // remaining seat. Scanning past overlaps is important: reserving a seat for a
  // priority handle that is also in the rotation would otherwise underfill the run.
  const priorityHandles = parsePriorityHandles(allHandles);
  let toWarm: string[];
  let nextOffset: number;
  if (allHandles.length <= MAX_HANDLES) {
    // All users fit in one run — no rotation needed
    toWarm = [...allHandles];
    nextOffset = 0;
  } else {
    toWarm = priorityHandles.slice(0, MAX_HANDLES);
    const warmSet = new Set(toWarm);
    let inspected = 0;
    while (toWarm.length < MAX_HANDLES && inspected < allHandles.length) {
      const handle = allHandles[(offset + inspected) % allHandles.length];
      inspected++;
      if (handle === undefined) break;
      if (!warmSet.has(handle)) {
        warmSet.add(handle);
        toWarm.push(handle);
      }
    }
    nextOffset = (offset + inspected) % allHandles.length;
  }

  // Pre-fetch all previous snapshots in one batch query (instead of N+1 individual calls)
  const previousSnapshots = await dbGetLatestSnapshotBatch(toWarm);

  // Counters aggregated from per-handle results
  let warmed = 0;
  let snapshots = 0;
  let notifications = 0;

  // Process handles in parallel batches for throughput.
  // processInBatches returns { succeeded, failed } so we can identify which handles failed.
  const { succeeded: warmResults, failed: warmFailures } = await processInBatches(
    toWarm,
    BATCH_SIZE,
    async (handle) => {
      const result = await warmHandle(handle, previousSnapshots, requestId);
      return { handle, ...result };
    },
  );

  // Aggregate succeeded results
  for (const { warmed: w, snapshotRecorded, notified } of warmResults) {
    if (w) {
      warmed++;
      if (snapshotRecorded) snapshots++;
      if (notified) notifications++;
    }
  }

  // Only advance rotation after processInBatches completes, and only if at least one
  // handle was processed — prevents a timeout from advancing the offset past handles
  // that were never warmed (#750).
  if (warmResults.length > 0) {
    await cacheSet(ROTATION_KEY, nextOffset, 0);
  }

  // Log unexpected hard failures (warmHandle catches internally; these guard against
  // any unhandled throws that bypass the internal catch)
  for (const { item: handle, error } of warmFailures) {
    void captureServerError({
      route: "/api/cron/warm-cache",
      statusCode: 500,
      error: new Error(`Unexpected failure for handle "${handle}": ${error.message}`),
      requestId,
    });
  }

  // Build structured failure list for response observability (#702)
  const failures = [
    ...warmFailures.map(({ item, error }) => ({ handle: item, reason: error.message })),
    ...warmResults.filter((r) => !r.warmed).map((r) => ({ handle: r.handle, reason: "warm returned false" })),
  ];
  const failed = failures.length;
  const processedCount = toWarm.length;

  // DO-L1 (#751): P2 alert when failure rate exceeds 50% of processed handles.
  // A cron run where every handle silently fails returns HTTP 200 with a non-empty
  // failures[] array — without this alert, the on-call team would not be paged.
  if (processedCount > 0 && failed > processedCount / 2) {
    void captureOperationalAlert({
      signal: "warm_cache_high_failure_rate",
      severity: "P2",
      summary: `warm-cache: ${failed}/${processedCount} handles failed (>${Math.round((failed / processedCount) * 100)}% failure rate)`,
      route: "/api/cron/warm-cache",
      properties: { failed, processedCount },
    });
  }

  // DO-S1 (#773): P2 alert when total active users are at or above the per-run ceiling.
  // When allHandles.length >= MAX_HANDLES, only a subset is warmed per run and a full
  // round-robin rotation takes ceil(totalUsers / MAX_HANDLES) *runs* to cover everyone.
  //
  // #1010 — this alert predates the hourly cadence and was written when a "run" meant
  // a day: at 50 users/run daily, exceeding the ceiling meant some handles went DAYS
  // between proactive warms (and, since warmHandle also records the daily lifetime-
  // history snapshot, days of gapped history). Now that the cron runs hourly (see
  // MAX_HANDLES above), the same numeric threshold means a full rotation takes
  // ceil(totalUsers / MAX_HANDLES) HOURS instead of days — a ~24x smaller worst-case
  // gap for the same active-user count. The threshold and severity are left as-is
  // (still worth knowing when not every handle is covered every run), but
  // `rotationHours` is now included so on-call can see the actual staleness bound
  // rather than assuming the old daily-cadence blast radius. (Full fix — tiered
  // freshness by popularity, or decoupling snapshot recording from warm rotation
  // entirely — is tracked as a follow-up infra task.)
  if (allHandles.length >= MAX_HANDLES) {
    const rotationHours = Math.ceil(allHandles.length / MAX_HANDLES);
    void captureOperationalAlert({
      signal: "warm_cache_ceiling_approached",
      severity: "P2",
      summary: `warm-cache ceiling: ${allHandles.length} active users vs ${MAX_HANDLES}/run (hourly) — full rotation takes ~${rotationHours}h`,
      route: "/api/cron/warm-cache",
      properties: { totalUsers: allHandles.length, ceiling: MAX_HANDLES, rotationHours },
    });
  }

  // Clean expired verification records from Supabase (fire-and-forget safe)
  let expiredVerificationsDeleted = 0;
  try {
    expiredVerificationsDeleted = await dbCleanExpiredVerifications();
  } catch {
    // Non-critical — don't fail the cron response
  }

  // Clean merge_operations rows older than 90 days (fire-and-forget safe)
  let expiredMergeOpsDeleted = 0;
  try {
    expiredMergeOpsDeleted = await dbCleanExpiredMergeOperations();
  } catch {
    // Non-critical — don't fail the cron response
  }

  // Clean metrics_snapshots older than retention period (fire-and-forget safe)
  let expiredSnapshotsDeleted = 0;
  try {
    expiredSnapshotsDeleted = await dbCleanOldSnapshots();
  } catch {
    // Non-critical — don't fail the cron response
  }

  const durationMs = Date.now() - start;

  // Emit observability event to PostHog (fire-and-forget)
  void captureServerEvent("cron_warm_cache_complete", {
    warmed,
    failed,
    durationMs,
  });

  await cacheSet(HEARTBEAT_KEY, Date.now(), HEARTBEAT_TTL_SECONDS);

  return NextResponse.json(
    {
      warmed,
      failed,
      failures,
      snapshots,
      notifications,
      expiredVerificationsDeleted,
      expiredMergeOpsDeleted,
      expiredSnapshotsDeleted,
      processedCount,
      processedSample: toWarm.slice(0, 10),
      rotation: {
        offset,
        nextOffset,
        totalUsers: allHandles.length,
        coversAll: allHandles.length <= MAX_HANDLES,
      },
      durationMs,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
});

/**
 * Parse WARM_CACHE_PRIORITY_HANDLES env var into a list of handles
 * that must be included in every warm-cache run. Only returns handles
 * that exist in the authoritative user list (allHandles).
 */
function parsePriorityHandles(allHandles: string[]): string[] {
  const handleSet = new Set(allHandles);
  return getWarmCachePriorityHandles().filter((h) => handleSet.has(h));
}

/**
 * Warm a single handle: fetch stats, record snapshot, check for score bumps.
 * All errors are caught internally — this function never throws.
 */
async function warmHandle(
  handle: string,
  previousSnapshots: Map<string, unknown>,
  requestId?: string,
): Promise<HandleResult> {
  try {
    const materialized = await materializeOrchestratedProfile(handle);
    if (!materialized) {
      void captureServerError({
        route: "/api/cron/warm-cache",
        statusCode: 502,
        error: new Error(`Stats fetch returned null for handle: ${handle}`),
        requestId,
      });
      return { warmed: false, snapshotRecorded: false, notified: false };
    }

    let snapshotRecorded = false;
    let notified = false;

    // Pre-warm avatar cache opportunistically for later public renders.
    const avatarUrl = materialized.stats.avatarUrl;
    if (avatarUrl) {
      fireAndForget(
        () => getAvatarBase64(handle, avatarUrl),
        () => undefined,
      );
    }

    // Record daily metrics snapshot (fire-and-forget, deduplicates by date)
    try {
      const previousSnapshot = previousSnapshots.get(handle.toLowerCase());

      const recorded = await persistOrchestratedSnapshot(handle, materialized, {
        mode: "insert",
      });
      if (recorded) {
        snapshotRecorded = true;

        // Score bump notification: compare new vs previous snapshot
        if (previousSnapshot) {
          try {
            const diff = compareSnapshots(
              previousSnapshot as Parameters<typeof compareSnapshots>[0],
              materialized.snapshot,
            );
            const result = isSignificantChange(diff);
            if (result.significant) {
              await notifyScoreBump(handle, diff, result);
              notified = true;
            }
          } catch {
            // Notification is non-critical — don't fail the warm
          }
        }
      }
    } catch {
      // Snapshot recording is non-critical — don't fail the warm
    }

    return { warmed: true, snapshotRecorded, notified };
  } catch (err) {
    void captureServerError({
      route: "/api/cron/warm-cache",
      statusCode: 500,
      error: err,
      requestId,
    });
    return { warmed: false, snapshotRecorded: false, notified: false };
  }
}
