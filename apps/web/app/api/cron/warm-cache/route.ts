import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth/cron";
import { dbGetUsers } from "@/lib/db/users";
import {
  dbInsertSnapshot,
  dbGetLatestSnapshotBatch,
  dbCleanOldSnapshots,
} from "@/lib/db/snapshots";
import { updateSnapshotCache } from "@/lib/cache/snapshot-cache";
import { getStats } from "@/lib/github/client";
import { computeImpactV4 } from "@/lib/impact/v4";
import { buildSnapshot } from "@/lib/history/snapshot";
import { compareSnapshots } from "@/lib/history/diff";
import { isSignificantChange } from "@/lib/history/significant-change";
import { notifyScoreBump } from "@/lib/email/score-bump";
import { dbCleanExpiredVerifications } from "@/lib/db/verification";
import { dbCleanExpiredMergeOperations } from "@/lib/db/telemetry";
import { cacheGet, cacheSet } from "@/lib/cache/redis";
import { processInBatches } from "@/lib/async/process-in-batches";
import { captureServerError } from "@/lib/analytics/server-errors";
import { getCachedCraftScore } from "@/lib/cache/craft-cache";
import { getAvatarBase64 } from "@/lib/render/avatar";

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
export async function GET(request: NextRequest) {
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

  const nextOffset = allHandles.length <= MAX_HANDLES
    ? 0
    : (offset + MAX_HANDLES) % allHandles.length;

  // Persist rotation offset for next cron run (TTL=0 means no expiry)
  await cacheSet(ROTATION_KEY, nextOffset, 0);

  // Use fallback GitHub token for server-side fetches (no user session)
  const githubToken = process.env.GITHUB_TOKEN?.trim() || undefined;

  // Pre-fetch all previous snapshots in one batch query (instead of N+1 individual calls)
  const previousSnapshots = await dbGetLatestSnapshotBatch(toWarm);

  // Counters aggregated from per-handle results
  let warmed = 0;
  let failed = 0;
  let snapshots = 0;
  let notifications = 0;

  // Process handles in parallel batches for throughput
  const results = await processInBatches(toWarm, BATCH_SIZE, async (handle) => {
    const result = await warmHandle(handle, githubToken, previousSnapshots);
    return { handle, ...result };
  });

  // Aggregate results from all settled promises
  for (const r of results) {
    if (r.status === "fulfilled") {
      const { warmed: w, snapshotRecorded, notified } =
        r.value as HandleResult & { handle: string };
      if (w) {
        warmed++;
        if (snapshotRecorded) snapshots++;
        if (notified) notifications++;
      } else {
        failed++;
      }
    } else {
      // Promise rejected — should not happen since warmHandle catches internally,
      // but guard against unexpected throws
      failed++;
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

  return NextResponse.json(
    {
      warmed,
      failed,
      snapshots,
      notifications,
      expiredVerificationsDeleted,
      expiredMergeOpsDeleted,
      expiredSnapshotsDeleted,
      total: toWarm.length,
      handles: toWarm,
      rotation: {
        offset,
        nextOffset,
        totalUsers: allHandles.length,
        coversAll: allHandles.length <= MAX_HANDLES,
      },
      durationMs: Date.now() - start,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Warm a single handle: fetch stats, record snapshot, check for score bumps.
 * All errors are caught internally — this function never throws.
 */
async function warmHandle(
  handle: string,
  githubToken: string | undefined,
  previousSnapshots: Map<string, unknown>,
): Promise<HandleResult> {
  try {
    const stats = await getStats(handle, githubToken);
    if (!stats) {
      void captureServerError({
        route: "/api/cron/warm-cache",
        statusCode: 502,
        error: new Error(`Stats fetch returned null for handle: ${handle}`),
      });
      return { warmed: false, snapshotRecorded: false, notified: false };
    }

    let snapshotRecorded = false;
    let notified = false;

    // Pre-warm avatar + craft caches in parallel (both are non-critical)
    const [craftSettled] = await Promise.allSettled([
      getCachedCraftScore(handle),
      stats.avatarUrl ? getAvatarBase64(handle, stats.avatarUrl) : Promise.resolve(undefined),
    ]);
    const craftResult = craftSettled.status === "fulfilled" ? craftSettled.value : null;

    // Record daily metrics snapshot (fire-and-forget, deduplicates by date)
    try {
      const impact = computeImpactV4(stats, craftResult?.craftScore ?? undefined);
      const snapshot = buildSnapshot(stats, impact);

      const previousSnapshot = previousSnapshots.get(handle.toLowerCase());

      const recorded = await dbInsertSnapshot(handle, snapshot);
      if (recorded) {
        snapshotRecorded = true;
        // Update snapshot cache so subsequent reads hit Redis
        await updateSnapshotCache(handle, snapshot).catch(() => {});

        // Score bump notification: compare new vs previous snapshot
        if (previousSnapshot) {
          try {
            const diff = compareSnapshots(
              previousSnapshot as Parameters<typeof compareSnapshots>[0],
              snapshot,
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
    });
    return { warmed: false, snapshotRecorded: false, notified: false };
  }
}

