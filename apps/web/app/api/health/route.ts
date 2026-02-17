import { NextResponse } from "next/server";
import { pingRedis } from "@/lib/cache/redis";
import { pingSupabase } from "@/lib/db/supabase";

export async function GET() {
  const [redisStatus, supabaseStatus] = await Promise.all([
    pingRedis(),
    pingSupabase(),
  ]);

  // Only Redis affects degraded status in Phase 1 — Supabase is optional
  const status = redisStatus === "ok" ? "ok" : "degraded";
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
