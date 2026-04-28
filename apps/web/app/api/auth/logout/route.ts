import { type NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/github";
import { rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";
import { withErrorCapture } from "@/lib/analytics/server-errors";

/**
 * POST /api/auth/logout
 *
 * Clears the session cookie and redirects to /.
 * Rate limited: 10 requests per IP per 60 seconds.
 */
export const POST = withErrorCapture("/api/auth/logout", async (request: NextRequest) => {
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:logout:${ip}`, 10, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const response = NextResponse.redirect(new URL("/", request.url));
  response.headers.append("Set-Cookie", clearSessionCookie());
  return response;
});
