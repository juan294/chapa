import { type NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/auth/admin-route";
import { dbUpdateFeatureFlag } from "@/lib/db/feature-flags";
import { dbTimeoutOr504 } from "@/lib/async/with-timeout";

/**
 * PATCH /api/admin/feature-flags
 *
 * Admin-only endpoint to update a feature flag.
 * Body: { key: string, enabled?: boolean, config?: Record<string, unknown> }
 * Rate limited: 10 requests per IP per 60 seconds.
 */
export async function PATCH(request: NextRequest) {
  const authError = await adminAuth(request, "ratelimit:admin-feature-flags");
  if (authError) return authError;

  // Parse body
  let body: { key?: string; enabled?: boolean; config?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.key || typeof body.key !== "string") {
    return NextResponse.json(
      { error: "Missing required field: key" },
      { status: 400 },
    );
  }

  // Build update payload
  const updates: { enabled?: boolean; config?: Record<string, unknown> } = {};
  if (body.enabled !== undefined) updates.enabled = body.enabled;
  if (body.config !== undefined) updates.config = body.config;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No updates provided (need enabled or config)" },
      { status: 400 },
    );
  }

  const success = await dbTimeoutOr504(dbUpdateFeatureFlag(body.key, updates), "dbUpdateFeatureFlag");
  if (success instanceof NextResponse) return success;
  if (!success) {
    return NextResponse.json(
      { error: "Failed to update feature flag" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
