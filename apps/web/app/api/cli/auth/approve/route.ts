import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { cacheSet } from "@/lib/cache/redis";

const DEVICE_SESSION_TTL = 300; // 5 minutes

export async function POST(request: Request): Promise<Response> {
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
