import { type NextRequest, NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/github";
import { isAdminHandle } from "@/lib/auth/admin";
import { dbGetFeatureFlags } from "@/lib/db/feature-flags";
import { rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";

/** Feature flag keys that belong to the Engagement section. */
const ENGAGEMENT_KEYS = new Set(["score_notifications"]);

/**
 * GET /api/admin/engagement-flags
 *
 * Admin-only endpoint that returns engagement-related feature flags.
 * Rate limited: 10 requests per IP per 60 seconds.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:admin-engagement:${ip}`, 10, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const sessionSecret = process.env.NEXTAUTH_SECRET?.trim();
  if (!sessionSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookieHeader = request.headers.get("cookie");
  const session = readSessionCookie(cookieHeader, sessionSecret);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminHandle(session.login)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allFlags = await dbGetFeatureFlags();
  const engagementFlags = allFlags
    .filter((f) => ENGAGEMENT_KEYS.has(f.key))
    .map((f) => ({
      key: f.key,
      enabled: f.enabled,
      description: f.description ?? "",
    }));

  return NextResponse.json({ flags: engagementFlags });
}
