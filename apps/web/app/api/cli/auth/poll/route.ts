import { NextRequest, NextResponse } from "next/server";
import {
  cacheGet,
  cacheSet,
  cacheDel,
  cacheMergeJson,
  rateLimit,
} from "@/lib/cache/redis";
import { getNextauthSecret } from "@/lib/env";
import { generateCliToken } from "@/lib/auth/cli-token";
import { getClientIp, NO_TRUSTED_IP } from "@/lib/http/client-ip";
import { withErrorCapture } from "@/lib/analytics/server-errors";
import {
  CLI_DEVICE_SESSION_TTL_SECONDS,
  CLI_DEVICE_SESSION_UNAVAILABLE_PAYLOAD,
  type CliDeviceSession as DeviceSession,
  cliDeviceSessionKey,
} from "@/lib/auth/cli-device-session";
import { randomBytes, timingSafeEqual } from "crypto";

// BE-M1 (#868): When no trusted IP header is present, all such requests would
// collapse into a single "unknown" rate-limit bucket, defeating per-IP limiting.
// Instead, apply a separate strict global cap with a much tighter limit.
// Normal per-IP cap: 600 polls / 300s. No-trusted-IP global cap: 50 / 300s.
const NO_IP_POLL_LIMIT = 50;
const NO_IP_POLL_WINDOW = 300; // seconds

// BE-M4 (#953): 300s (5 minutes) caps the window during which a passive attacker
// who learns the sessionId can redeem via the legacy path on an unconfirmed session.
// TODO: Remove legacy sessionId-only path once CLI v2.x ships device_code universally. Track: #953

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

  // BE-M1 (#868): Fail safe when no trusted proxy IP is available.
  // Use a separate stricter global bucket (key suffix ":no-ip") instead of
  // collapsing all headerless requests into a shared "unknown" bucket.
  // Trusted proxy assumption: x-vercel-forwarded-for is set by Vercel's edge
  // and cannot be spoofed; x-forwarded-for rightmost-hop is a secondary fallback.
  const ipRlKey =
    ip === NO_TRUSTED_IP
      ? "ratelimit:cli-poll-ip:no-ip"
      : `ratelimit:cli-poll-ip:${ip}`;
  const ipRlLimit = ip === NO_TRUSTED_IP ? NO_IP_POLL_LIMIT : 600;
  const ipRlWindow = ip === NO_TRUSTED_IP ? NO_IP_POLL_WINDOW : 300;

  const ipRl = await rateLimit(ipRlKey, ipRlLimit, ipRlWindow);
  if (!ipRl.allowed) {
    return NextResponse.json(
      { error: "poll_rate_exceeded" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const session = await cacheGet<DeviceSession>(cliDeviceSessionKey(sessionId));

  // BE-M2 (#869): RFC 8628-style device_code split — FULLY BACKWARD-COMPATIBLE.
  //
  // The Chapa CLI is an EXTERNAL binary whose source is not in this repo, so we
  // cannot require all clients to send device_code without breaking already-
  // distributed binaries on new authorization flows. Enforcement is therefore
  // OPT-IN, gated on the client demonstrating it possesses the code:
  //
  //   First poll (no session in Redis): generate a 160-bit device_code, store it,
  //     and return it. An updated CLI will echo it back; a legacy CLI ignores it.
  //
  //   A poll that ECHOES the correct device_code: mark the session "confirmed".
  //     From then on, device_code is REQUIRED and validated (timing-safe) on every
  //     subsequent poll — missing or wrong → 401. This gives updated CLIs the full
  //     RFC 8628 guarantee (whoever later learns only the sessionId cannot redeem).
  //
  //   A poll that presents a WRONG device_code (even before confirmation): 401.
  //     Presenting a code is an active possession claim; an incorrect claim is rejected.
  //
  //   A poll with NO device_code on an UNCONFIRMED session (or a session with no
  //     deviceCode at all): fall back to the legacy sessionId-only behavior — NO 401.
  //     This is the critical path that keeps existing CLI binaries working unchanged.
  //
  // RESIDUAL (tracked separately): full enforcement — removing the legacy
  // sessionId-only fallback so device_code is mandatory for ALL flows — is gated on
  // shipping an updated CLI that always sends device_code. Until then, a passive
  // attacker who learns the sessionId before any device_code is confirmed can still
  // redeem via the legacy path. Confirmed flows are not affected.
  const incomingDeviceCode = searchParams.get("device_code");

  if (!session) {
    // First poll: generate and store a device_code, return it in the response.
    const newDeviceCode = randomBytes(20).toString("hex"); // 40 hex chars = 160 bits
    const pendingSession: DeviceSession = {
      status: "pending",
      deviceCode: newDeviceCode,
    };
    const stored = await cacheSet(
      cliDeviceSessionKey(sessionId),
      pendingSession,
      CLI_DEVICE_SESSION_TTL_SECONDS,
    );
    if (!stored) {
      return NextResponse.json(
        CLI_DEVICE_SESSION_UNAVAILABLE_PAYLOAD,
        { status: 503 },
      );
    }
    return NextResponse.json({ status: "pending", device_code: newDeviceCode });
  }

  // device_code validation (only meaningful when the session carries a deviceCode).
  if (session.deviceCode) {
    const storedBuf = Buffer.from(session.deviceCode, "utf8");

    if (incomingDeviceCode) {
      // Client presents a code → it MUST be correct (timing-safe), regardless of
      // confirmation state. A correct code (re)confirms the session.
      const incomingBuf = Buffer.from(incomingDeviceCode, "utf8");
      const match =
        storedBuf.length === incomingBuf.length &&
        timingSafeEqual(storedBuf, incomingBuf);
      if (!match) {
        return NextResponse.json(
          { error: "Invalid device_code" },
          { status: 401 },
        );
      }
      // Correct code: confirm the session so future polls must keep presenting it.
      if (!session.deviceCodeConfirmed) {
        // Merge only the confirmation latch. A concurrent approval can update
        // status/handle without either request overwriting the other's fields.
        const confirmed = await cacheMergeJson<DeviceSession>(
          cliDeviceSessionKey(sessionId),
          { deviceCodeConfirmed: true },
          CLI_DEVICE_SESSION_TTL_SECONDS,
        );
        if (!confirmed) {
          return NextResponse.json(
            CLI_DEVICE_SESSION_UNAVAILABLE_PAYLOAD,
            { status: 503 },
          );
        }
      }
    } else if (session.deviceCodeConfirmed) {
      // No code presented, but the client previously proved possession → enforce.
      // Do NOT allow a silent downgrade back to sessionId-only.
      return NextResponse.json(
        { error: "device_code required" },
        { status: 401 },
      );
    }
    // else: unconfirmed session + no code presented → legacy CLI. Fall through to
    // sessionId-only behavior below (NO 401). This is the backward-compat path.
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
    await cacheDel(cliDeviceSessionKey(sessionId));

    return NextResponse.json({
      status: "approved",
      token,
      handle: session.handle,
    });
  }

  return NextResponse.json({ status: "pending" });
});
