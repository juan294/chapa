import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { dbGetUsers } from "@/lib/db/users";
import {
  dbInsertSnapshot,
  dbGetLatestSnapshotBatch,
} from "@/lib/db/snapshots";
import { updateSnapshotCache } from "@/lib/cache/snapshot-cache";
import { getStats } from "@/lib/github/client";
import { computeImpactV4 } from "@/lib/impact/v4";
import { buildSnapshot } from "@/lib/history/snapshot";
import { compareSnapshots } from "@/lib/history/diff";
import { isSignificantChange } from "@/lib/history/significant-change";
import { notifyScoreBump } from "@/lib/email/score-bump";
import { dbCleanExpiredVerifications } from "@/lib/db/verification";

/** Vercel Pro allows up to 300s for serverless functions. */
export const maxDuration = 300;

/** Maximum handles to warm per cron invocation (stay within GitHub rate limits). */
const MAX_HANDLES = 50;

/** Number of handles to process concurrently per batch. */
const BATCH_SIZE = 5;

/**
 * Process items in parallel batches of a fixed size.
 * Uses Promise.allSettled for error isolation — individual failures
 * do not block other items in the batch.
 */
async function processInBatches<T>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<unknown>,
): Promise<PromiseSettledResult<unknown>[]> {
  const results: PromiseSettledResult<unknown>[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

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
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token || !safeEqual(token, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();

  // Discover all known handles from Supabase (authoritative user list)
  const users = await dbGetUsers();
  const allHandles = users.map((u) => u.handle);

  // Cap the number of handles per run
  const toWarm = allHandles.slice(0, MAX_HANDLES);

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

  return NextResponse.json(
    {
      warmed,
      failed,
      snapshots,
      notifications,
      expiredVerificationsDeleted,
      total: toWarm.length,
      handles: toWarm,
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
      return { warmed: false, snapshotRecorded: false, notified: false };
    }

    let snapshotRecorded = false;
    let notified = false;

    // Record daily metrics snapshot (fire-and-forget, deduplicates by date)
    try {
      const impact = computeImpactV4(stats);
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
  } catch {
    return { warmed: false, snapshotRecorded: false, notified: false };
  }
}

/** Timing-safe string comparison to prevent timing attacks. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
