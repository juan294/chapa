import { type NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForToken,
  fetchGitHubUser,
  createSessionCookie,
  validateState,
  clearStateCookie,
} from "@/lib/auth/github";
import { rateLimit } from "@/lib/cache/redis";

function isSecureOrigin(): boolean {
  const base = process.env.NEXT_PUBLIC_BASE_URL?.trim() ?? "";
  return base.startsWith("https://");
}

function cookieFlags(): string {
  const secure = isSecureOrigin() ? " Secure;" : "";
  return `HttpOnly;${secure} SameSite=Lax; Path=/`;
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

export async function GET(request: NextRequest) {
  // Rate limit: 10 requests per IP per 15 minutes
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await rateLimit(`ratelimit:callback:${ip}`, 10, 900);
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

  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
  const sessionSecret = process.env.NEXTAUTH_SECRET?.trim();

  if (!clientId || !clientSecret || !sessionSecret) {
    return NextResponse.redirect(new URL("/?error=config", request.url));
  }

  const token = await exchangeCodeForToken(code, clientId, clientSecret);
  if (!token) {
    return NextResponse.redirect(new URL("/?error=token_exchange", request.url));
  }

  const user = await fetchGitHubUser(token);
  if (!user) {
    return NextResponse.redirect(new URL("/?error=user_fetch", request.url));
  }

  const cookie = createSessionCookie(
    {
      token,
      login: user.login,
      name: user.name,
      avatar_url: user.avatar_url,
    },
    sessionSecret,
  );

  // Use post-login redirect if available, otherwise default to profile page
  const postLoginRedirect = readRedirectCookie(cookieHeader);
  const redirectUrl = postLoginRedirect ?? `/u/${user.login}`;

  const response = NextResponse.redirect(
    new URL(redirectUrl, request.url),
  );
  response.headers.append("Set-Cookie", cookie);
  response.headers.append("Set-Cookie", clearStateCookie());
  // Clear the redirect cookie
  response.headers.append(
    "Set-Cookie",
    `chapa_redirect=; ${cookieFlags()}; Max-Age=0`,
  );
  return response;
}
