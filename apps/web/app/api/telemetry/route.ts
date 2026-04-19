import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/cache/redis";
import { isValidTelemetryPayload } from "@/lib/validation";
import { dbInsertTelemetry } from "@/lib/db/telemetry";
import { getClientIp } from "@/lib/http/client-ip";

export async function POST(request: Request): Promise<Response> {
  // 1. Parse JSON body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // 2. Validate payload structure
  if (!isValidTelemetryPayload(body)) {
    return NextResponse.json({ error: "Invalid telemetry payload" }, { status: 400 });
  }

  const payload = body as {
    operationId: string;
    targetHandle: string;
    sourceHandle: string;
    success: boolean;
    errorCategory?: string;
    stats: {
      commitsTotal: number;
      reposContributed: number;
      prsMergedCount: number;
      activeDays: number;
      reviewsSubmittedCount: number;
    };
    timing: {
      fetchMs: number;
      uploadMs: number;
      totalMs: number;
    };
    cliVersion: string;
  };

  // 3a. IP-based floor rate limit: 60 requests per IP per 60 seconds.
  // This prevents an attacker from rotating targetHandle to bypass per-handle limits.
  const clientIp = getClientIp(request);
  const ipRl = await rateLimit(`ratelimit:telemetry-ip:${clientIp}`, 60, 60);
  if (!ipRl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  // 3b. Per-handle rate limit: 10 requests per targetHandle per 60 seconds.
  // targetHandle has already been validated as a safe GitHub handle by isValidTelemetryPayload.
  const rl = await rateLimit(`ratelimit:telemetry:${payload.targetHandle}`, 10, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests for this handle. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  // 4. Fire-and-forget: telemetry is non-critical — do not await the insert.
  // The response must not be held up by DB latency or failures.
  void dbInsertTelemetry(payload);

  // 5. Always return success — telemetry is a best-effort analytics sink.
  return NextResponse.json({ ok: true });
}
