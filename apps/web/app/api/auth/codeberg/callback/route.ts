import { type NextRequest, NextResponse } from "next/server";
import { isCodebergEnabled } from "@/lib/feature-flags";
import { requireSession } from "@/lib/auth/require-session";
import {
  validateCodebergState,
  clearCodebergStateCookie,
  exchangeCodebergCode,
  fetchCodebergUser,
} from "@/lib/auth/codeberg";
import { computeTokenExpiry } from "@/lib/auth/bitbucket";
import { dbUpsertLinkedPlatform } from "@/lib/db/user-platforms";
import { cacheDel, rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";

export async function GET(request: NextRequest) {
  // 1. Feature flag check
  if (!(await isCodebergEnabled())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 2. Rate limit: 10 requests per IP per 15 minutes
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:cb:callback:${ip}`, 10, 900);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "900" } },
    );
  }

  // 3. Require authenticated session
  const { session, error } = requireSession(request);
  if (error) return error;

  const handle = session.login;
  const errorRedirectBase = `/u/${handle}`;

  // 4. Validate authorization code
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(
      new URL(`${errorRedirectBase}?error=codeberg_no_code`, request.url),
    );
  }

  // 5. Validate CSRF state
  const queryState = request.nextUrl.searchParams.get("state");
  const cookieHeader = request.headers.get("cookie");
  if (!validateCodebergState(cookieHeader, queryState)) {
    return NextResponse.redirect(
      new URL(`${errorRedirectBase}?error=codeberg_invalid_state`, request.url),
    );
  }

  // 6. Validate env vars
  const clientId = process.env.CODEBERG_CLIENT_ID?.trim();
  const clientSecret = process.env.CODEBERG_CLIENT_SECRET?.trim();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (!clientId || !clientSecret || !baseUrl) {
    return NextResponse.redirect(
      new URL(`${errorRedirectBase}?error=codeberg_config`, request.url),
    );
  }

  // 7. Exchange code for tokens
  const redirectUri = `${baseUrl}/api/auth/codeberg/callback`;
  const tokens = await exchangeCodebergCode(
    code,
    clientId,
    clientSecret,
    redirectUri,
  );
  if (!tokens) {
    return NextResponse.redirect(
      new URL(`${errorRedirectBase}?error=codeberg_token_exchange`, request.url),
    );
  }

  // 8. Fetch Codeberg user profile
  const cbUser = await fetchCodebergUser(tokens.access_token);
  if (!cbUser) {
    return NextResponse.redirect(
      new URL(`${errorRedirectBase}?error=codeberg_user_fetch`, request.url),
    );
  }

  // 9. Store encrypted tokens in user_platforms
  // Handle optional expires_in: if absent, pass null for expiresAt
  const expiresAt = tokens.expires_in
    ? computeTokenExpiry(tokens.expires_in)
    : null;
  const stored = await dbUpsertLinkedPlatform(
    handle,
    "codeberg",
    cbUser.login,
    tokens.access_token,
    tokens.refresh_token ?? null,
    expiresAt,
  );
  if (!stored) {
    return NextResponse.redirect(
      new URL(`${errorRedirectBase}?error=codeberg_storage`, request.url),
    );
  }

  // 10. Invalidate stats cache (force re-merge on next badge request)
  const lh = handle.toLowerCase();
  void cacheDel(`stats:v2:merged:${lh}`);
  void cacheDel(`stats:v2:codeberg:${lh}`);

  // 11. Clear state cookie and redirect to share page
  const response = NextResponse.redirect(
    new URL(`/u/${handle}?codeberg=linked`, request.url),
  );
  response.headers.append("Set-Cookie", clearCodebergStateCookie());
  return response;
}
