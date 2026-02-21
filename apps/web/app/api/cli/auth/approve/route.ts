import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { cacheSet, rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";

const DEVICE_SESSION_TTL = 300; // 5 minutes

/**
 * POST /api/cli/auth/approve
 *
 * Approves a CLI device auth session.
 * Rate limited: 10 requests per IP per 60 seconds.
 */
export async function POST(request: Request): Promise<Response> {
  // 0. Rate limit
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:cli-approve:${ip}`, 10, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  // 1. Verify the user is logged in via web session
  const { session, error } = requireSession(request);
  if (error) return error;

  // 2. Parse body
  let body: { sessionId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sessionId } = body;
  if (!sessionId || !/^[a-f0-9-]{36}$/.test(sessionId)) {
    return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
  }

  // 3. Store approval in Redis
  const stored = await cacheSet(
    `cli:device:${sessionId}`,
    { status: "approved", handle: session.login },
    DEVICE_SESSION_TTL,
  );

  if (!stored) {
    return NextResponse.json(
      { error: "Service temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }

  return NextResponse.json({ success: true, handle: session.login });
}
