import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/cache/redis";
import { isValidTelemetryPayload } from "@/lib/validation";
import { dbInsertTelemetry } from "@/lib/db/telemetry";

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

  // 3. Rate limit: 10 requests per targetHandle per 60 seconds
  const rl = await rateLimit(`ratelimit:telemetry:${payload.targetHandle}`, 10, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests for this handle. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  // 4. Insert into Supabase (fire-and-forget — telemetry is non-critical)
  await dbInsertTelemetry(payload);

  // 5. Always return success — even if DB insert failed (graceful degradation)
  return NextResponse.json({ ok: true });
}
