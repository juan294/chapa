import { type NextRequest, NextResponse } from "next/server";
import {
  getOptionalRequestSession,
  getSessionSecret,
  requireRequestSession,
} from "@/lib/auth/session";
import { cacheGet, cacheSet, rateLimit } from "@/lib/cache/redis";
import { isValidBadgeConfig } from "@/lib/validation";
import { isStudioEnabled } from "@/lib/feature-flags";
import type { BadgeConfig } from "@chapa/shared";
import { withErrorCapture } from "@/lib/analytics/server-errors";

/**
 * GET /api/studio/config — Load the authenticated user's badge config.
 * Returns { config: BadgeConfig | null }.
 */
export const GET = withErrorCapture("/api/studio/config", async (request: NextRequest) => {
  if (!(await isStudioEnabled())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!getSessionSecret()) {
    return NextResponse.json({ config: null });
  }

  const session = getOptionalRequestSession(request);
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  const config = await cacheGet<BadgeConfig>(`config:${session.login}`);
  return NextResponse.json({ config });
});

/**
 * PUT /api/studio/config — Save the authenticated user's badge config.
 * Auth required. Rate limited: 30 requests/hour per user.
 */
export const PUT = withErrorCapture("/api/studio/config", async (request: NextRequest) => {
  if (!(await isStudioEnabled())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { session, error } = requireRequestSession(request);
  if (error) return error;

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate config shape
  if (!isValidBadgeConfig(body)) {
    return NextResponse.json({ error: "Invalid badge config" }, { status: 400 });
  }

  // Rate limit: 30 saves per hour per user
  const rl = await rateLimit(`ratelimit:config:${session.login}`, 30, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many saves. Please try again later." },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  // Persist config (365-day TTL — user-authored content)
  await cacheSet(`config:${session.login}`, body as BadgeConfig, 31536000);

  return NextResponse.json({ success: true });
});
