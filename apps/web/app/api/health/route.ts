import { NextResponse } from "next/server";
import { pingRedis } from "@/lib/cache/redis";

export async function GET() {
  const redisStatus = await pingRedis();

  const status = redisStatus === "ok" ? "ok" : "degraded";

  return NextResponse.json({
    status,
    timestamp: new Date().toISOString(),
    dependencies: {
      redis: redisStatus,
    },
  });
}
