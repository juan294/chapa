import { type NextRequest, NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/github";
import { isAdminHandle } from "@/lib/auth/admin";
import { dbUpdateFeatureFlag } from "@/lib/db/feature-flags";
import { rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";

/**
 * PATCH /api/admin/feature-flags
 *
 * Admin-only endpoint to update a feature flag.
 * Body: { key: string, enabled?: boolean, config?: Record<string, unknown> }
 * Rate limited: 10 requests per IP per 60 seconds.
 */
export async function PATCH(request: NextRequest) {
  // Rate limit
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:admin-feature-flags:${ip}`, 10, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  // Auth: require session cookie
  const sessionSecret = process.env.NEXTAUTH_SECRET?.trim();
  if (!sessionSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookieHeader = request.headers.get("cookie");
  const session = readSessionCookie(cookieHeader, sessionSecret);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Admin check
  if (!isAdminHandle(session.login)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  const success = await dbUpdateFeatureFlag(body.key, updates);
  if (!success) {
    return NextResponse.json(
      { error: "Failed to update feature flag" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
