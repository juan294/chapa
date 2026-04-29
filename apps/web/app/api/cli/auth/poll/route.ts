import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheDel, rateLimit } from "@/lib/cache/redis";
import { getNextauthSecret } from "@/lib/env";
import { generateCliToken } from "@/lib/auth/cli-token";
import { getClientIp } from "@/lib/http/client-ip";
import { withErrorCapture } from "@/lib/analytics/server-errors";

interface DeviceSession {
  status: "pending" | "approved";
  handle?: string;
}

export const GET = withErrorCapture("/api/cli/auth/poll", async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session");

  if (!sessionId || !/^[a-f0-9-]{36}$/.test(sessionId)) {
    return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
  }

  const sessionRl = await rateLimit(
    `ratelimit:cli-poll-session:${sessionId}`,
    120,
    300,
  );
  if (!sessionRl.allowed) {
    return NextResponse.json(
      { error: "poll_rate_exceeded" },
      { status: 429, headers: { "Retry-After": "30" } },
    );
  }

  const ip = getClientIp(request);
  const ipRl = await rateLimit(`ratelimit:cli-poll-ip:${ip}`, 600, 300);
  if (!ipRl.allowed) {
    return NextResponse.json(
      { error: "poll_rate_exceeded" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const session = await cacheGet<DeviceSession>(`cli:device:${sessionId}`);

  if (!session) {
    return NextResponse.json({ status: "pending" });
  }

  if (session.status === "approved" && session.handle) {
    const secret = getNextauthSecret();
    if (!secret) {
      return NextResponse.json(
        { error: "Server misconfigured" },
        { status: 500 },
      );
    }

    const token = generateCliToken(session.handle, secret);

    // Clean up — one-time use
    await cacheDel(`cli:device:${sessionId}`);

    return NextResponse.json({
      status: "approved",
      token,
      handle: session.handle,
    });
  }

  return NextResponse.json({ status: "pending" });
});
