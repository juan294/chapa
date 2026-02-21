import { type NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { cacheDel, rateLimit } from "@/lib/cache/redis";
import { getStats } from "@/lib/github/client";
import { computeImpactV4 } from "@/lib/impact/v4";
import { isValidHandle } from "@/lib/validation";
import { buildSnapshot } from "@/lib/history/snapshot";
import { dbInsertSnapshot } from "@/lib/db/snapshots";
import { updateSnapshotCache } from "@/lib/cache/snapshot-cache";

/**
 * POST /api/refresh?handle=:handle
 *
 * Force-refresh a user's badge data by clearing the cache and
 * fetching fresh stats from GitHub. Auth required — only the
 * badge owner can refresh their own badge.
 *
 * Rate limited: 5 refreshes per handle per hour.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const handle = request.nextUrl.searchParams.get("handle");
  if (!handle || !isValidHandle(handle)) {
    return NextResponse.json(
      { error: "Missing or invalid handle parameter" },
      { status: 400 },
    );
  }

  // Auth: require session cookie
  const { session, error } = requireSession(request);
  if (error) return error;

  // Only the badge owner can refresh their own badge (case-insensitive)
  if (session.login.toLowerCase() !== handle.toLowerCase()) {
    return NextResponse.json(
      { error: "You can only refresh your own badge" },
      { status: 403 },
    );
  }

  // Rate limit: 5 refreshes per handle per hour (normalize key)
  const normalizedHandle = handle.toLowerCase();
  const rl = await rateLimit(`ratelimit:refresh:${normalizedHandle}`, 5, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many refreshes. Please try again later." },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  // Clear cached stats so getStats fetches fresh from GitHub
  // Key must match lib/github/client.ts cache key: "stats:v2:<handle>" (lowercase)
  await cacheDel(`stats:v2:${normalizedHandle}`);

  // Fetch fresh stats with the user's OAuth token for better rate limits
  const stats = await getStats(handle, session.token);
  if (!stats) {
    return NextResponse.json(
      { error: "Failed to fetch stats from GitHub. Try again later." },
      { status: 502 },
    );
  }

  const impact = computeImpactV4(stats);

  // Record daily metrics snapshot (fire-and-forget, deduplicates by date)
  const snapshot = buildSnapshot(stats, impact);
  dbInsertSnapshot(handle, snapshot)
    .then((inserted) => {
      if (inserted) updateSnapshotCache(handle, snapshot);
    })
    .catch(() => {});

  return NextResponse.json({ stats, impact });
}
