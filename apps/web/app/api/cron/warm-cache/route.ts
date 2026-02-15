import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { scanKeys } from "@/lib/cache/redis";
import { getStats } from "@/lib/github/client";
import { computeImpactV4 } from "@/lib/impact/v4";
import { buildSnapshot } from "@/lib/history/snapshot";
import { recordSnapshot } from "@/lib/history/history";

/** Vercel Pro allows up to 300s for serverless functions. */
export const maxDuration = 300;

/** Maximum handles to warm per cron invocation (stay within GitHub rate limits). */
const MAX_HANDLES = 50;

/**
 * GET /api/cron/warm-cache
 *
 * Vercel Cron endpoint that pre-warms the stats cache for all known users.
 * Scans Redis for existing cache keys, deduplicates handles, and calls
 * getStats() for each to refresh their 6-hour cache window.
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

  // Discover all known handles from both primary and stale cache keys
  const [primaryKeys, staleKeys] = await Promise.all([
    scanKeys("stats:v2:*"),
    scanKeys("stats:stale:*"),
  ]);

  // Deduplicate handles
  const handles = new Set<string>();
  for (const key of primaryKeys) {
    handles.add(key.replace("stats:v2:", ""));
  }
  for (const key of staleKeys) {
    handles.add(key.replace("stats:stale:", ""));
  }

  // Cap the number of handles per run
  const toWarm = [...handles].slice(0, MAX_HANDLES);

  // Use fallback GitHub token for server-side fetches (no user session)
  const githubToken = process.env.GITHUB_TOKEN?.trim() || undefined;

  // Warm caches sequentially to be gentle on GitHub rate limits
  let warmed = 0;
  let failed = 0;
  let snapshots = 0;

  for (const handle of toWarm) {
    try {
      const stats = await getStats(handle, githubToken);
      if (stats) {
        warmed++;
        // Record daily metrics snapshot (fire-and-forget, deduplicates by date)
        try {
          const impact = computeImpactV4(stats);
          const snapshot = buildSnapshot(stats, impact);
          const recorded = await recordSnapshot(handle, snapshot);
          if (recorded) snapshots++;
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

  return NextResponse.json(
    {
      warmed,
      failed,
      snapshots,
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
