import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/cache/redis";
import { isValidTelemetryPayload } from "@/lib/validation";
import { dbInsertTelemetry, type TelemetryPayload } from "@/lib/db/telemetry";
import { getClientIp } from "@/lib/http/client-ip";
import { fireAndForget } from "@/lib/async/fire-and-forget";
import { captureServerEvent, withErrorCapture } from "@/lib/analytics/server-errors";
import { log } from "@/lib/log";

// Trust model: this endpoint intentionally remains unauthenticated for CLI compatibility.
// Every accepted row is stored with verified=false until the CLI sends an auth token in a follow-up phase.
export const POST = withErrorCapture("/api/telemetry", async (request: NextRequest) => {
  // 1. Parse JSON body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (isClientErrorTelemetryPayload(body)) {
    void captureServerEvent(body.event, {
      category: body.category,
      message: body.message.slice(0, 500),
      ...(body.stack && { stack: body.stack.slice(0, 1000) }),
      ...(body.digest && { digest: body.digest.slice(0, 128) }),
      ...(body.path && { path: body.path.slice(0, 300) }),
      source: body.source,
    });
    return NextResponse.json({ ok: true });
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
        log("error", "[telemetry] insert failed", { route: "/api/telemetry", handle: payload.targetHandle });
      }
    },
    (err) => {
      log("error", "[telemetry] insert failed", { route: "/api/telemetry", handle: payload.targetHandle, error: err instanceof Error ? err.message : String(err) });
    },
  );

  // 5. Always return success — telemetry is a best-effort analytics sink.
  return NextResponse.json({ ok: true });
});

function isClientErrorTelemetryPayload(value: unknown): value is {
  event: "client_error" | "client_api_error";
  category: string;
  message: string;
  stack?: string;
  digest?: string;
  path?: string;
  source?: string;
} {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    (obj.event === "client_error" || obj.event === "client_api_error") &&
    typeof obj.category === "string" &&
    obj.category.length > 0 &&
    typeof obj.message === "string" &&
    obj.message.length > 0 &&
    (obj.stack === undefined || typeof obj.stack === "string") &&
    (obj.digest === undefined || typeof obj.digest === "string") &&
    (obj.path === undefined || typeof obj.path === "string") &&
    (obj.source === undefined || typeof obj.source === "string")
  );
}
