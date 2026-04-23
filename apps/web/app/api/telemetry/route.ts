import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/cache/redis";
import { isValidTelemetryPayload } from "@/lib/validation";
import { dbInsertTelemetry, type TelemetryPayload } from "@/lib/db/telemetry";
import { getClientIp } from "@/lib/http/client-ip";
import { fireAndForget } from "@/lib/async/fire-and-forget";

// Trust model: this endpoint intentionally remains unauthenticated for CLI compatibility.
// Every accepted row is stored with verified=false until the CLI sends an auth token in a follow-up phase.
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

  const payload = body as Omit<TelemetryPayload, "verified">;

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

  // 3b. IP/day ceiling: 600 requests per IP per 24 hours.
  // This keeps the route open for CLI use while bounding sustained abuse from a single source.
  const ipDailyRl = await rateLimit(`ratelimit:telemetry-ip-day:${clientIp}`, 600, 86400);
  if (!ipDailyRl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  // 3c. Per-handle rate limit: 10 requests per targetHandle per 60 seconds.
  // targetHandle has already been validated as a safe GitHub handle by isValidTelemetryPayload.
  const rl = await rateLimit(`ratelimit:telemetry:${payload.targetHandle}`, 10, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests for this handle. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const dbPayload: TelemetryPayload = {
    ...payload,
    verified: false,
  };

  // 4. Fire-and-forget: telemetry is non-critical — do not await the insert.
  // The response must not be held up by DB latency or failures.
  fireAndForget(
    async () => {
      const ok = await dbInsertTelemetry(dbPayload);
      if (!ok) {
        console.error("[telemetry] insert failed", { handle: payload.targetHandle });
      }
    },
    (err) => {
      console.error("[telemetry] insert failed", { handle: payload.targetHandle, err });
    },
  );

  // 5. Always return success — telemetry is a best-effort analytics sink.
  return NextResponse.json({ ok: true });
}
