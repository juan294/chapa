import { type NextRequest, NextResponse } from "next/server";
import { pingRedis, rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";
import { pingSupabase } from "@/lib/db/supabase";

/**
 * GET /api/health
 *
 * Health check endpoint for monitoring.
 * Rate limited: 30 requests per IP per 60 seconds.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:health:${ip}`, 30, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const [redisStatus, supabaseStatus] = await Promise.all([
    pingRedis(),
    pingSupabase(),
  ]);

  // Both Redis and Supabase are critical — either failing triggers degraded
  const status =
    redisStatus === "ok" && supabaseStatus === "ok" ? "ok" : "degraded";
  const httpStatus = status === "ok" ? 200 : 503;

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      dependencies: {
        redis: redisStatus,
        supabase: supabaseStatus,
      },
    },
    { status: httpStatus }
  );
}
