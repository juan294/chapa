import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { cacheMergeJson, rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";
import { withErrorCapture } from "@/lib/analytics/server-errors";
import {
  type CliDeviceSession,
  cliDeviceSessionKey,
} from "@/lib/auth/cli-device-session";

const DEVICE_SESSION_TTL = 300; // 5 minutes

/**
 * POST /api/cli/auth/approve
 *
 * Approves a CLI device auth session.
 * Rate limited: 10 requests per IP per 60 seconds.
 */
export const POST = withErrorCapture("/api/cli/auth/approve", async (request: NextRequest) => {
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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sessionId } = body as { sessionId?: unknown };
  if (typeof sessionId !== "string" || !/^[a-f0-9-]{36}$/.test(sessionId)) {
    return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
  }

  // 3. Atomically merge approval into the Redis session.
  // (BE-H3 / SE-H1, #1078 / #1097). The poll route's device_code binding
  // (`deviceCode` / `deviceCodeConfirmed`) lives on this same session object.
  // A plain `cacheSet({ status, handle })` here would drop those fields,
  // silently disabling the poll route's `if (session.deviceCode)`
  // enforcement on the very next (redeeming) poll — letting anyone who learns
  // the bare sessionId redeem a token even for a confirmed session. If no
  // session exists yet (approve called before any poll), there's nothing to
  // preserve — that's the legacy path the poll route's own comments describe.
  const key = cliDeviceSessionKey(sessionId);
  const approval: Partial<CliDeviceSession> = {
    status: "approved",
    handle: session.login,
  };
  const stored = await cacheMergeJson<CliDeviceSession>(
    key,
    approval,
    DEVICE_SESSION_TTL,
  );

  if (!stored) {
    return NextResponse.json(
      { error: "Service temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }

  return NextResponse.json({ success: true, handle: session.login });
});
