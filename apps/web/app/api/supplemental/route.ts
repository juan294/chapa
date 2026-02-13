import { NextResponse } from "next/server";
import { fetchGitHubUser } from "@/lib/auth/github";
import { isCliToken, verifyCliToken } from "@/lib/auth/cli-token";
import { cacheSet, cacheDel, rateLimit } from "@/lib/cache/redis";
import { isValidHandle, isValidEmuHandle, isValidStatsShape } from "@/lib/validation";
import type { SupplementalStats } from "@chapa/shared";

const CACHE_TTL = 86400; // 24 hours

/**
 * Resolve the authenticated handle from a Bearer token.
 * Supports both Chapa CLI tokens (HMAC-signed) and GitHub PATs.
 */
async function resolveHandle(token: string): Promise<string | null> {
  if (isCliToken(token)) {
    const secret = process.env.NEXTAUTH_SECRET?.trim();
    if (!secret) return null;
    const result = verifyCliToken(token, secret);
    return result?.handle ?? null;
  }

  // Fallback: verify as GitHub PAT
  const user = await fetchGitHubUser(token);
  return user?.login ?? null;
}

export async function POST(request: Request): Promise<Response> {
  // 1. Extract Bearer token
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 });
  }
  const token = authHeader.slice(7);

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

  // 4. Verify token ownership (CLI token or GitHub PAT)
  const authenticatedHandle = await resolveHandle(token);
  if (!authenticatedHandle) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  if (authenticatedHandle.toLowerCase() !== targetHandle.toLowerCase()) {
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
  // Key must match lib/github/client.ts cache key: "stats:v2:<handle>"
  await cacheDel(`stats:v2:${targetHandle.toLowerCase()}`);

  return NextResponse.json({ success: true });
}
