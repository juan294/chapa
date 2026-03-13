import { type NextRequest, NextResponse, after } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { rateLimit, cacheDel } from "@/lib/cache/redis";
import { invalidateSnapshotCache } from "@/lib/cache/snapshot-cache";
import { isInsightsEnabled } from "@/lib/feature-flags";
import { isValidInsightsUpload } from "@/lib/insights/validation";
import { computeCraftScore } from "@/lib/insights/scoring";
import { dbUpsertToolInsights } from "@/lib/db/tool-insights";
import type { InsightsUpload } from "@chapa/shared";

/**
 * POST /api/insights — Upload an insights report and compute craft score.
 * Auth required. Rate limited: 10 requests/handle/24h.
 */
export async function POST(request: NextRequest): Promise<Response> {
  if (!(await isInsightsEnabled())) {
    return NextResponse.json({ error: "Feature not available" }, { status: 403 });
  }

  const { session, error } = requireSession(request);
  if (error) return error;

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate InsightsUpload shape
  const validation = isValidInsightsUpload(body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: "Invalid insights data", reason: validation.reason },
      { status: 400 },
    );
  }

  // Rate limit: 10 uploads per handle per 24h
  const rl = await rateLimit(
    `ratelimit:insights:${session.login.toLowerCase()}`,
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
  const stored = await dbUpsertToolInsights(session.login, data, scores);

  // Defer cache invalidation to post-response (non-blocking)
  after(async () => {
    const handle = session.login.toLowerCase();
    await Promise.allSettled([
      cacheDel(`stats:v2:merged:${handle}`),
      invalidateSnapshotCache(handle),
    ]);
  });

  return NextResponse.json({
    success: true,
    craftScore: stored ?? scores,
  });
}
