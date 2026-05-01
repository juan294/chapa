import { type NextRequest, NextResponse } from "next/server";
import { buildAuthUrl, createStateCookie } from "@/lib/auth/github";
import { buildAuthCookieFlags } from "@/lib/auth/cookie-policy";
import { getBaseUrl, getGithubClientId } from "@/lib/env";
import { issueOauthState } from "@/lib/auth/oauth-state";
import { rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";
import { captureServerError, withErrorCapture } from "@/lib/analytics/server-errors";
import { getRequestId } from "@/lib/log";

const OAUTH_STATE_STORE_COOKIE = "chapa_oauth_state_store";

function cookieFlags(): string {
  return buildAuthCookieFlags(getBaseUrl());
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
    return url.startsWith("/") && !url.startsWith("//");
  }
}

export const GET = withErrorCapture("/api/auth/login", async (request: NextRequest) => {
  const requestId = getRequestId(request);
  // Rate limit: 20 requests per IP per 15 minutes
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:login:${ip}`, 20, 900);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "900" } },
    );
  }

  const clientId = getGithubClientId();
  if (!clientId) {
    void captureServerError({
      route: "/api/auth/login",
      statusCode: 500,
      error: new Error("GitHub OAuth not configured: GITHUB_CLIENT_ID missing"),
      requestId,
    });
    return NextResponse.json(
      { error: "GitHub OAuth not configured" },
      { status: 500 },
    );
  }

  const baseUrl = getBaseUrl();
  const redirectUri = `${baseUrl}/api/auth/callback`;

  const { state, cookie: stateCookie } = createStateCookie();
  const stateStoreMode = await issueOauthState(state);
  const authUrl = buildAuthUrl(clientId, redirectUri, state);

  const response = NextResponse.redirect(authUrl);
  response.headers.append("Set-Cookie", stateCookie);
  response.headers.append(
    "Set-Cookie",
    `${OAUTH_STATE_STORE_COOKIE}=${stateStoreMode}; ${cookieFlags()}; Max-Age=600`,
  );

  // Store post-login redirect URL if provided (same-origin only)
  const postLoginRedirect = request.nextUrl.searchParams.get("redirect");
  if (postLoginRedirect && isSafeRedirect(postLoginRedirect, baseUrl)) {
    response.headers.append(
      "Set-Cookie",
      `chapa_redirect=${encodeURIComponent(postLoginRedirect)}; ${cookieFlags()}; Max-Age=600`,
    );
  }

  return response;
});
