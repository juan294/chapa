import { type NextRequest, NextResponse } from "next/server";
import { dbGetFeatureFlags } from "@/lib/db/feature-flags";
import { rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";

/**
 * GET /api/feature-flags
 *
 * Public, read-only endpoint returning all feature flags.
 * Rate limited: 30 requests per IP per 60 seconds.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:feature-flags:${ip}`, 30, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const flags = await dbGetFeatureFlags();

  return NextResponse.json(
    { flags },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
