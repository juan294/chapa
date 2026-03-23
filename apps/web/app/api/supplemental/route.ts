import { NextResponse } from "next/server";
import { resolveRequestAuth } from "@/lib/auth/resolve-request-auth";
import { cacheSet, cacheDel, rateLimit } from "@/lib/cache/redis";
import { isValidHandle, isValidEmuHandle, isValidStatsShape } from "@/lib/validation";
import type { SupplementalStats } from "@chapa/shared";

const CACHE_TTL = 86400; // 24 hours

export async function POST(request: Request): Promise<Response> {
  // 1. Require Bearer token (supplemental is CLI-only, no session cookie fallback)
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 });
  }

  // 2. Parse body
  let body: { targetHandle?: string; sourceHandle?: string; stats?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { targetHandle, sourceHandle, stats } = body;

  // 3. Validate required fields
  if (!targetHandle || !sourceHandle || !stats) {
    return NextResponse.json({ error: "Missing required fields: targetHandle, sourceHandle, stats" }, { status: 400 });
  }

  if (!isValidHandle(targetHandle)) {
    return NextResponse.json({ error: "Invalid targetHandle" }, { status: 400 });
  }

  if (!isValidEmuHandle(sourceHandle)) {
    return NextResponse.json({ error: "Invalid sourceHandle" }, { status: 400 });
  }

  if (!isValidStatsShape(stats)) {
    return NextResponse.json({ error: "Invalid stats shape" }, { status: 400 });
  }

  // 3b. Rate limit: 10 requests per targetHandle per 24 hours
  const rl = await rateLimit(`ratelimit:supplemental:${targetHandle}`, 10, 86400);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests for this handle. Please try again later." },
      { status: 429, headers: { "Retry-After": "86400" } },
    );
  }

  // 4. Verify token ownership via shared auth resolver
  const auth = await resolveRequestAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  if (auth.handle.toLowerCase() !== targetHandle.toLowerCase()) {
    return NextResponse.json({ error: "Token does not match targetHandle" }, { status: 403 });
  }

  // 5. Store in Redis
  const supplemental: SupplementalStats = {
    targetHandle,
    sourceHandle,
    stats: stats as SupplementalStats["stats"],
    uploadedAt: new Date().toISOString(),
  };

  await cacheSet(`supplemental:${targetHandle.toLowerCase()}`, supplemental, CACHE_TTL);

  // 6. Invalidate primary stats cache (forces re-merge on next badge request)
  // Key must match lib/github/client.ts cache key: "stats:v2:merged:<handle>"
  await cacheDel(`stats:v2:merged:${targetHandle.toLowerCase()}`);

  return NextResponse.json({ success: true });
}
