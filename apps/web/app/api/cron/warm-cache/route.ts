import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { dbGetUsers } from "@/lib/db/users";
import { dbInsertSnapshot, dbGetLatestSnapshot } from "@/lib/db/snapshots";
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

/**
 * GET /api/cron/warm-cache
 *
 * Vercel Cron endpoint that pre-warms the stats cache for all known users.
 * Reads the user list from Supabase, and calls getStats() for each to
 * refresh their 6-hour cache window.
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

  // Warm caches sequentially to be gentle on GitHub rate limits
  let warmed = 0;
  let failed = 0;
  let snapshots = 0;
  let notifications = 0;

  for (const handle of toWarm) {
    try {
      const stats = await getStats(handle, githubToken);
      if (stats) {
        warmed++;
        // Record daily metrics snapshot (fire-and-forget, deduplicates by date)
        try {
          const impact = computeImpactV4(stats);
          const snapshot = buildSnapshot(stats, impact);

          // Fetch previous snapshot BEFORE inserting new one (for comparison)
          const previousSnapshot = await dbGetLatestSnapshot(handle);

          const recorded = await dbInsertSnapshot(handle, snapshot);
          if (recorded) {
            snapshots++;

            // Score bump notification: compare new vs previous snapshot
            if (previousSnapshot) {
              try {
                const diff = compareSnapshots(previousSnapshot, snapshot);
                const result = isSignificantChange(diff);
                if (result.significant) {
                  await notifyScoreBump(handle, diff, result);
                  notifications++;
                }
              } catch {
                // Notification is non-critical — don't fail the warm
              }
            }
          }
        } catch {
          // Snapshot recording is non-critical — don't fail the warm
        }
      } else {
        failed++;
      }
    } catch {
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

/** Timing-safe string comparison to prevent timing attacks. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
