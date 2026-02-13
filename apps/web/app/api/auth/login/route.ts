import { type NextRequest, NextResponse } from "next/server";
import { buildAuthUrl, createStateCookie } from "@/lib/auth/github";
import { rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";

function isSecureOrigin(): boolean {
  const base = process.env.NEXT_PUBLIC_BASE_URL?.trim() ?? "";
  return base.startsWith("https://");
}

function cookieFlags(): string {
  const secure = isSecureOrigin() ? " Secure;" : "";
  return `HttpOnly;${secure} SameSite=Lax; Path=/`;
}

/**
 * Validate that a redirect URL is safe (same-origin only).
 */
function isSafeRedirect(url: string, baseUrl: string): boolean {
  try {
    const parsed = new URL(url);
    const base = new URL(baseUrl);
    return parsed.origin === base.origin;
  } catch {
    // Relative paths are OK
    return url.startsWith("/");
  }
}

export async function GET(request: NextRequest) {
  // Rate limit: 20 requests per IP per 15 minutes
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:login:${ip}`, 20, 900);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "900" } },
    );
  }

  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  if (!clientId) {
    return NextResponse.json(
      { error: "GitHub OAuth not configured" },
      { status: 500 },
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim() || "http://localhost:3001";
  const redirectUri = `${baseUrl}/api/auth/callback`;

  const { state, cookie: stateCookie } = createStateCookie();
  const authUrl = buildAuthUrl(clientId, redirectUri, state);

  const response = NextResponse.redirect(authUrl);
  response.headers.append("Set-Cookie", stateCookie);

  // Store post-login redirect URL if provided (same-origin only)
  const postLoginRedirect = request.nextUrl.searchParams.get("redirect");
  if (postLoginRedirect && isSafeRedirect(postLoginRedirect, baseUrl)) {
    response.headers.append(
      "Set-Cookie",
      `chapa_redirect=${encodeURIComponent(postLoginRedirect)}; ${cookieFlags()}; Max-Age=600`,
    );
  }

  return response;
}
