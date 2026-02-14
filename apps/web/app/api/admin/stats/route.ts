import { type NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getBadgeStats, rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";

/**
 * GET /api/admin/stats
 *
 * Returns badge generation stats (total + unique developers).
 * Protected by a Bearer token checked against the ADMIN_SECRET env var.
 */
export async function GET(request: NextRequest) {
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
  const secret = process.env.ADMIN_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token || !safeEqual(token, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const badges = await getBadgeStats();

  return NextResponse.json(
    { badges },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Timing-safe string comparison to prevent timing attacks on the secret. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
