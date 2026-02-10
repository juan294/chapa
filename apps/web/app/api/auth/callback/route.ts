import { type NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForToken,
  fetchGitHubUser,
  createSessionCookie,
} from "@/lib/auth/github";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/?error=no_code", request.url));
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
  return response;
}
