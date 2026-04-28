import { type NextRequest, NextResponse } from "next/server";
import { verifyAdminSecret } from "@/lib/auth/admin";
import { getBadgeStats, rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";
import { dbTimeoutOr504 } from "@/lib/async/with-timeout";
import { withErrorCapture } from "@/lib/analytics/server-errors";

/**
 * GET /api/admin/stats
 *
 * Returns badge generation stats (total + unique developers).
 * Protected by a Bearer token checked against the ADMIN_SECRET env var.
 */
export const GET = withErrorCapture("/api/admin/stats", async (request: NextRequest) => {
  // Rate limit: 10 requests per IP per 60 seconds
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:admin-stats:${ip}`, 10, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  // Auth: Bearer token must match ADMIN_SECRET
  const denied = verifyAdminSecret(request);
  if (denied) return denied;

  const badges = await dbTimeoutOr504(getBadgeStats(), "getBadgeStats");
  if (badges instanceof NextResponse) return badges;

  return NextResponse.json(
    { badges },
    { headers: { "Cache-Control": "no-store" } },
  );
});

