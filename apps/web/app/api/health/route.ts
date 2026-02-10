import { NextResponse } from "next/server";
import { pingRedis } from "@/lib/cache/redis";
import packageJson from "../../../package.json";

export async function GET() {
  const redisStatus = await pingRedis();

  const status = redisStatus === "ok" ? "ok" : "degraded";

  return NextResponse.json({
    status,
    timestamp: new Date().toISOString(),
    version: packageJson.version,
    dependencies: {
      redis: redisStatus,
    },
  });
}
