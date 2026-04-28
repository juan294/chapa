import { type NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/auth/admin-route";
import { dbGetFeatureFlags } from "@/lib/db/feature-flags";
import { dbTimeoutOr504 } from "@/lib/async/with-timeout";
import { withErrorCapture } from "@/lib/analytics/server-errors";

/** Feature flag keys that belong to the Engagement section. */
const ENGAGEMENT_KEYS = new Set(["score_notifications"]);

/**
 * GET /api/admin/engagement-flags
 *
 * Admin-only endpoint that returns engagement-related feature flags.
 * Rate limited: 10 requests per IP per 60 seconds.
 */
export const GET = withErrorCapture("/api/admin/engagement-flags", async (request: NextRequest) => {
  const authError = await adminAuth(request, "ratelimit:admin-engagement");
  if (authError) return authError;

  const allFlags = await dbTimeoutOr504(dbGetFeatureFlags(), "dbGetFeatureFlags");
  if (allFlags instanceof NextResponse) return allFlags;
  const engagementFlags = allFlags
    .filter((f) => ENGAGEMENT_KEYS.has(f.key))
    .map((f) => ({
      key: f.key,
      enabled: f.enabled,
      description: f.description ?? "",
    }));

  return NextResponse.json({ flags: engagementFlags });
});
