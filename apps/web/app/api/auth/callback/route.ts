import { type NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForToken,
  fetchGitHubUser,
  createSessionCookie,
  validateState,
  clearStateCookie,
} from "@/lib/auth/github";
import { rateLimit } from "@/lib/cache/redis";

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

  const response = NextResponse.redirect(
    new URL(`/u/${user.login}`, request.url),
  );
  response.headers.append("Set-Cookie", cookie);
  response.headers.append("Set-Cookie", clearStateCookie());
  return response;
}
