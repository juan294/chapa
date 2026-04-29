import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth/cron";
import { getGithubToken, getWarmCachePriorityHandles } from "@/lib/env";
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

/** Maximum handles to warm per cron invocation (stay within GitHub rate limits). */
const MAX_HANDLES = 50;

/** Number of handles to process concurrently per batch. */
const BATCH_SIZE = 5;

/** Redis key storing the rotation offset for round-robin handle processing. */
const ROTATION_KEY = "cron:warm-cache:offset";

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
 * refresh their 6-hour cache window.
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

  // Priority handles: always included regardless of rotation (e.g. "juan294,alice")
  const priorityHandles = parsePriorityHandles(allHandles);

  let toWarm: string[];
  if (allHandles.length <= MAX_HANDLES) {
    // All users fit in one run — no rotation needed
    toWarm = allHandles;
  } else if (offset + MAX_HANDLES > allHandles.length) {
    // Wraps around: take remaining + start from beginning
    const remaining = allHandles.slice(offset);
    const fromStart = allHandles.slice(0, MAX_HANDLES - remaining.length);
    toWarm = [...remaining, ...fromStart];
  } else {
    toWarm = allHandles.slice(offset, offset + MAX_HANDLES);
  }

  // Merge priority handles into the warm list (no duplicates)
  if (priorityHandles.length > 0) {
    const warmSet = new Set(toWarm);
    for (const h of priorityHandles) {
      if (!warmSet.has(h)) {
        toWarm.push(h);
        warmSet.add(h);
      }
    }
  }

  const nextOffset = allHandles.length <= MAX_HANDLES
    ? 0
    : (offset + MAX_HANDLES) % allHandles.length;

  // Persist rotation offset for next cron run (TTL=0 means no expiry)
  await cacheSet(ROTATION_KEY, nextOffset, 0);

  // Use fallback GitHub token for server-side fetches (no user session)
  const githubToken = getGithubToken();

  // Pre-fetch all previous snapshots in one batch query (instead of N+1 individual calls)
  const previousSnapshots = await dbGetLatestSnapshotBatch(toWarm);

  // Counters aggregated from per-handle results
  let warmed = 0;
  let failed = 0;
  let snapshots = 0;
  let notifications = 0;

  // Process handles in parallel batches for throughput.
  // processInBatches returns { succeeded, failed } so we can identify which handles failed.
  const { succeeded: warmResults, failed: warmFailures } = await processInBatches(
    toWarm,
    BATCH_SIZE,
    async (handle) => {
      const result = await warmHandle(handle, githubToken, previousSnapshots, requestId);
      return { handle, ...result };
    },
  );

  // Aggregate succeeded results
  for (const { warmed: w, snapshotRecorded, notified } of warmResults) {
    if (w) {
      warmed++;
      if (snapshotRecorded) snapshots++;
      if (notified) notifications++;
    } else {
      failed++;
    }
  }

  // Aggregate unexpected failures (warmHandle catches internally, but guard against
  // any unhandled throws that bypass the internal catch)
  if (warmFailures.length > 0) {
    failed += warmFailures.length;
    for (const { item: handle, error } of warmFailures) {
      void captureServerError({
        route: "/api/cron/warm-cache",
        statusCode: 500,
        error: new Error(`Unexpected failure for handle "${handle}": ${error.message}`),
        requestId,
      });
    }
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

  return NextResponse.json(
    {
      warmed,
      failed,
      snapshots,
      notifications,
      expiredVerificationsDeleted,
      expiredMergeOpsDeleted,
      expiredSnapshotsDeleted,
      processedCount: toWarm.length,
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
  githubToken: string | undefined,
  previousSnapshots: Map<string, unknown>,
  requestId?: string,
): Promise<HandleResult> {
  try {
    const materialized = await materializeOrchestratedProfile(handle, {
      token: githubToken,
    });
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
