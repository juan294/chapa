import { NextResponse } from "next/server";
import { fetchGitHubUser } from "@/lib/auth/github";
import { cacheSet, cacheDel, rateLimit } from "@/lib/cache/redis";
import { isValidHandle, isValidEmuHandle, isValidStats90dShape } from "@/lib/validation";
import type { SupplementalStats } from "@chapa/shared";

const CACHE_TTL = 86400; // 24 hours

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

  if (!isValidStats90dShape(stats)) {
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

  // 4. Verify token ownership
  const user = await fetchGitHubUser(token);
  if (!user) {
    return NextResponse.json({ error: "Invalid GitHub token" }, { status: 401 });
  }

  if (user.login.toLowerCase() !== targetHandle.toLowerCase()) {
    return NextResponse.json({ error: "Token does not match targetHandle" }, { status: 403 });
  }

  // 5. Store in Redis
  const supplemental: SupplementalStats = {
    targetHandle,
    sourceHandle,
    stats: stats as SupplementalStats["stats"],
    uploadedAt: new Date().toISOString(),
  };

  await cacheSet(`supplemental:${targetHandle}`, supplemental, CACHE_TTL);

  // 6. Invalidate primary stats cache (forces re-merge on next badge request)
  await cacheDel(`stats:${targetHandle}`);

  return NextResponse.json({ success: true });
}
