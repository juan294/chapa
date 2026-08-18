import { NextRequest, NextResponse } from "next/server";
import { captureServerError, withErrorCapture } from "@/lib/analytics/server-errors";
import { requireSession } from "@/lib/auth/require-session";
import { rateLimitStrict, refundRateLimit } from "@/lib/cache/redis";
import {
  isChallengeBody,
  MAX_CHALLENGE_BYTES,
  MAX_CHALLENGE_REASON_LENGTH,
  MIN_CHALLENGE_REASON_LENGTH,
} from "@/lib/challenge/validation";
import { sendChallengeEmail } from "@/lib/email/challenge";
import { getClientIp, NO_TRUSTED_IP } from "@/lib/http/client-ip";
import { isValidHandle } from "@/lib/validation";

export const POST = withErrorCapture("/api/challenge", async (request: NextRequest) => {
  const { session, error } = await requireSession(request);
  if (error) return error;

  const ip = getClientIp(request);
  const ipKey =
    ip === NO_TRUSTED_IP
      ? "ratelimit:challenge-ip:no-ip"
      : `ratelimit:challenge-ip:${ip}`;
  const ipRl = await rateLimitStrict(ipKey, 5, 3600);
  if (!ipRl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > MAX_CHALLENGE_BYTES) {
      return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
    }
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isChallengeBody(body)) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { handle, reason } = body;

  if (!handle || typeof handle !== "string") {
    return NextResponse.json({ error: "Missing required field: handle" }, { status: 400 });
  }

  if (!reason || typeof reason !== "string") {
    return NextResponse.json({ error: "Missing required field: reason" }, { status: 400 });
  }

  if (!isValidHandle(handle)) {
    return NextResponse.json({ error: "Invalid handle" }, { status: 400 });
  }

  const trimmedReason = reason.trim();
  if (trimmedReason.length < MIN_CHALLENGE_REASON_LENGTH) {
    return NextResponse.json(
      { error: `reason must be at least ${MIN_CHALLENGE_REASON_LENGTH} characters` },
      { status: 400 },
    );
  }

  if (trimmedReason.length > MAX_CHALLENGE_REASON_LENGTH) {
    return NextResponse.json(
      { error: `reason must be under ${MAX_CHALLENGE_REASON_LENGTH} characters` },
      { status: 400 },
    );
  }

  if (session.login.toLowerCase() !== handle.toLowerCase()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const lowerHandle = handle.toLowerCase();
  const handleRlKey = `ratelimit:challenge:${lowerHandle}`;
  const handleRl = await rateLimitStrict(handleRlKey, 3, 86400);
  if (!handleRl.allowed) {
    return NextResponse.json(
      { error: "Too many challenges submitted. Please try again tomorrow." },
      { status: 429, headers: { "Retry-After": "86400" } },
    );
  }

  const { success } = await sendChallengeEmail(handle, trimmedReason);
  if (!success) {
    console.error(`[challenge] email send failed for handle=${handle}`);
    void captureServerError({
      route: "/api/challenge",
      statusCode: 502,
      error: new Error(`Challenge dispute email send failed for handle=${handle}`),
    });
    // A failed send must not cost the user one of their limited daily
    // attempts — refund the quota consumed by the check above.
    const refunded = await refundRateLimit(handleRlKey);
    if (!refunded) {
      void captureServerError({
        route: "/api/challenge",
        statusCode: 502,
        error: new Error(`Challenge quota refund failed for handle=${handle}`),
      });
    }
    return NextResponse.json({ success: false, error: "delivery_failed" }, { status: 502 });
  }

  return NextResponse.json({ success: true });
});
