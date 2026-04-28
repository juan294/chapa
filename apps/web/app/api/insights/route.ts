import { type NextRequest, NextResponse, after } from "next/server";
import { revalidatePath } from "next/cache";
import { resolveRequestAuth } from "@/lib/auth/resolve-request-auth";
import { rateLimit } from "@/lib/cache/redis";
import { isInsightsEnabled } from "@/lib/feature-flags";
import {
  isValidInsightsUpload,
  MAX_INSIGHTS_BYTES,
} from "@/lib/insights/validation";
import { computeCraftScore } from "@/lib/insights/scoring";
import { dbUpsertToolInsights } from "@/lib/db/tool-insights";
import { invalidateProfileReadModels } from "@/lib/profile/post-write-invalidation";
import type { InsightsUpload } from "@chapa/shared";
import { withErrorCapture } from "@/lib/analytics/server-errors";

/**
 * POST /api/insights — Upload an insights report and compute craft score.
 * Auth: Bearer token (CLI token or GitHub PAT) or session cookie.
 * Rate limited: 10 requests/handle/24h.
 */
export const POST = withErrorCapture("/api/insights", async (request: NextRequest) => {
  if (!(await isInsightsEnabled())) {
    return NextResponse.json({ error: "Feature not available" }, { status: 403 });
  }

  const auth = await resolveRequestAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Parse body
  let rawBody: string;
  let body: unknown;
  try {
    rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > MAX_INSIGHTS_BYTES) {
      return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
    }
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate InsightsUpload shape
  const validation = isValidInsightsUpload(body);
  if (!validation.valid) {
    console.warn("[insights] Validation failed:", validation.reason);
    return NextResponse.json({ error: "Invalid insights data" }, { status: 400 });
  }

  // Rate limit: 10 uploads per handle per 24h
  const rl = await rateLimit(
    `ratelimit:insights:${auth.handle.toLowerCase()}`,
    10,
    86400,
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many uploads. Please try again later." },
      { status: 429, headers: { "Retry-After": "86400" } },
    );
  }

  const data = body as InsightsUpload;
  const scores = computeCraftScore(data);

  // Store in database (synchronous — response needs the stored result)
  const stored = await dbUpsertToolInsights(auth.handle, data, scores);

  // Defer cache invalidation until after the durable write completes.
  after(async () => {
    const handle = auth.handle.toLowerCase();
    await invalidateProfileReadModels(handle, {
      stats: true,
      craft: true,
      snapshot: true,
      history: true,
    });
    revalidatePath(`/u/${handle}`);
  });

  return NextResponse.json({
    success: true,
    craftScore: stored ?? scores,
  });
});
