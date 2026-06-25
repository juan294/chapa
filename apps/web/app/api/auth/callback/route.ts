import { type NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForToken,
  fetchGitHubUser,
  fetchGitHubUserEmail,
  createSessionCookie,
  validateState,
  clearStateCookie,
} from "@/lib/auth/github";
import { buildAuthCookieFlags } from "@/lib/auth/cookie-policy";
import { getBaseUrl, getGithubClientId, getGithubClientSecret, getNextauthSecret } from "@/lib/env";
import { consumeOauthState } from "@/lib/auth/oauth-state";
import { rateLimitStrict } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";
import { dbUpsertUser } from "@/lib/db/users";
import { addContact } from "@/lib/email/audience";
import { captureServerError, withErrorCapture } from "@/lib/analytics/server-errors";
import { getRequestId } from "@/lib/log";
import { storeGitHubToken } from "@/lib/auth/github-session-token";

const OAUTH_STATE_STORE_COOKIE = "chapa_oauth_state_store";

function cookieFlags(): string {
  return buildAuthCookieFlags(getBaseUrl());
}

function isLocalDevRequest(request: NextRequest): boolean {
  const hostname = request.nextUrl.hostname;
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/**
 * Validate that a redirect URL is on the explicit allow-list.
 * Restricts post-login redirects to a known set of safe prefixes to prevent
 * open-redirect attacks via the chapa_redirect cookie.
 *
 * Allow-list: exactly "/", or paths starting with "/u/", "/studio", "/about".
 */
function isSafeRedirect(url: string): boolean {
  if (url === "/") return true;
  if (
    url.startsWith("/u/") ||
    url.startsWith("/studio") ||
    url.startsWith("/about")
  ) {
    return true;
  }
  return false;
}

/**
 * Read and consume the post-login redirect cookie, if present.
 */
function readRedirectCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("chapa_redirect="));
  if (!match) return null;
  const raw = match.slice("chapa_redirect=".length);
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

function readOauthStateStoreCookie(
  cookieHeader: string | null,
): "shared" | "fallback" | null {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${OAUTH_STATE_STORE_COOKIE}=`));
  if (!match) return null;
  const value = match.slice(`${OAUTH_STATE_STORE_COOKIE}=`.length);
  return value === "shared" || value === "fallback" ? value : null;
}

export const GET = withErrorCapture("/api/auth/callback", async (request: NextRequest) => {
  const requestId = getRequestId(request);
  // Rate limit: 10 requests per IP per 15 minutes
  const ip = getClientIp(request);
  const rl = await rateLimitStrict(`ratelimit:callback:${ip}`, 10, 900);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "900" } },
    );
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/?error=no_code", request.url));
  }

  const queryState = request.nextUrl.searchParams.get("state");
  const cookieHeader = request.headers.get("cookie");
  if (!validateState(cookieHeader, queryState)) {
    return NextResponse.redirect(new URL("/?error=invalid_state", request.url));
  }
  const stateStoreMode = readOauthStateStoreCookie(cookieHeader);
  const mustConsumeSharedState =
    !isLocalDevRequest(request) && stateStoreMode === "shared";
  const consumed = mustConsumeSharedState && queryState
    ? await consumeOauthState(queryState)
    : true;
  if (mustConsumeSharedState && !consumed) {
    return NextResponse.json({ error: "state_already_used" }, { status: 400 });
  }

  const clientId = getGithubClientId();
  const clientSecret = getGithubClientSecret();
  const sessionSecret = getNextauthSecret();

  if (!clientId || !clientSecret || !sessionSecret) {
    void captureServerError({
      route: "/api/auth/callback",
      statusCode: 500,
      error: new Error("OAuth config incomplete: missing required env vars"),
      requestId,
    });
    return NextResponse.redirect(new URL("/?error=config", request.url));
  }

  const token = await exchangeCodeForToken(code, clientId, clientSecret);
  if (!token) {
    void captureServerError({
      route: "/api/auth/callback",
      statusCode: 502,
      error: new Error("GitHub token exchange failed"),
      requestId,
    });
    return NextResponse.redirect(new URL("/?error=token_exchange", request.url));
  }

  const user = await fetchGitHubUser(token);
  if (!user) {
    void captureServerError({
      route: "/api/auth/callback",
      statusCode: 502,
      error: new Error("GitHub user fetch failed after token exchange"),
      requestId,
    });
    return NextResponse.redirect(new URL("/?error=user_fetch", request.url));
  }

  const storedToken = await storeGitHubToken(user.login, token);
  if (!storedToken) {
    void captureServerError({
      route: "/api/auth/callback",
      statusCode: 500,
      error: new Error("GitHub token storage failed"),
      requestId,
    });
    return NextResponse.redirect(new URL("/?error=session_storage", request.url));
  }

  // Capture email and profile, register user (fire-and-forget, non-blocking)
  const email = await fetchGitHubUserEmail(token).catch(() => null);
  void dbUpsertUser(user.login, {
    email: email ?? undefined,
    displayName: user.name ?? null,
    avatarUrl: user.avatar_url ?? null,
  }).catch((err: unknown) => {
    void captureServerError({
      route: "/api/auth/callback",
      statusCode: 500,
      error: err,
      requestId,
    });
  });

  // Sync to Resend audience (fire-and-forget, non-blocking)
  if (email) {
    void addContact(email, {
      firstName: user.name ?? undefined,
      handle: user.login,
    }).catch((err: unknown) => {
      void captureServerError({
        route: "/api/auth/callback",
        statusCode: 500,
        error: err,
        requestId,
      });
    });
  }

  const cookie = createSessionCookie(
    {
      login: user.login,
      name: user.name,
      avatar_url: user.avatar_url,
    },
    sessionSecret,
  );

  // Use post-login redirect if available and safe, otherwise show the
  // generating progress page which warms the cache before redirecting
  // to the share page.
  const postLoginRedirect = readRedirectCookie(cookieHeader);
  const redirectUrl =
    postLoginRedirect && isSafeRedirect(postLoginRedirect)
      ? postLoginRedirect
      : `/generating/${user.login}`;

  const response = NextResponse.redirect(
    new URL(redirectUrl, request.url),
  );
  response.headers.append("Set-Cookie", cookie);
  response.headers.append("Set-Cookie", clearStateCookie());
  response.headers.append(
    "Set-Cookie",
    `${OAUTH_STATE_STORE_COOKIE}=; ${cookieFlags()}; Max-Age=0`,
  );
  // Clear the redirect cookie
  response.headers.append(
    "Set-Cookie",
    `chapa_redirect=; ${cookieFlags()}; Max-Age=0`,
  );
  return response;
});
