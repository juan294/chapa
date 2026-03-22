/**
 * Shared admin route authentication guard.
 *
 * Combines rate limiting, session validation, and admin role check
 * into a single reusable helper. Used by all campaign admin API routes.
 */

import { type NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { isAdminHandle } from "@/lib/auth/admin";
import { rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";

/**
 * Authenticate an admin API request: rate-limit, session, admin check.
 *
 * Returns `null` when auth passes. Returns a `NextResponse` error
 * (429/401/403/500) to return directly when auth fails.
 *
 * @param request - Incoming Next.js request
 * @param rateLimitKey - Rate-limit key prefix (e.g. "ratelimit:admin-campaigns")
 * @param maxRequests - Max requests per window (default 10)
 * @param windowSeconds - Rate-limit window in seconds (default 60)
 */
export async function adminAuth(
  request: NextRequest,
  rateLimitKey: string = "ratelimit:admin-campaigns",
  maxRequests: number = 10,
  windowSeconds: number = 60,
): Promise<NextResponse | null> {
  const ip = getClientIp(request);
  const rl = await rateLimit(`${rateLimitKey}:${ip}`, maxRequests, windowSeconds);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(windowSeconds) } },
    );
  }

  const { session, error } = requireSession(request);
  if (error) return error as NextResponse;

  if (!isAdminHandle(session.login)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null; // auth passed
}
