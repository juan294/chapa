import { type NextRequest, NextResponse } from "next/server";
import { isBitbucketEnabled } from "@/lib/feature-flags";
import { requireSession } from "@/lib/auth/require-session";
import {
  validateBitbucketState,
  clearBitbucketStateCookie,
  exchangeBitbucketCode,
  fetchBitbucketUser,
  computeTokenExpiry,
} from "@/lib/auth/bitbucket";
import { dbUpsertLinkedPlatform } from "@/lib/db/user-platforms";
import { cacheDel, rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";

export async function GET(request: NextRequest) {
  // 1. Feature flag check
  if (!(await isBitbucketEnabled())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 2. Rate limit: 10 requests per IP per 15 minutes
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:bb:callback:${ip}`, 10, 900);
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
      new URL(`${errorRedirectBase}?error=bitbucket_no_code`, request.url),
    );
  }

  // 5. Validate CSRF state
  const queryState = request.nextUrl.searchParams.get("state");
  const cookieHeader = request.headers.get("cookie");
  if (!validateBitbucketState(cookieHeader, queryState)) {
    return NextResponse.redirect(
      new URL(`${errorRedirectBase}?error=bitbucket_invalid_state`, request.url),
    );
  }

  // 6. Validate env vars
  const clientId = process.env.BITBUCKET_CLIENT_ID?.trim();
  const clientSecret = process.env.BITBUCKET_CLIENT_SECRET?.trim();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (!clientId || !clientSecret || !baseUrl) {
    return NextResponse.redirect(
      new URL(`${errorRedirectBase}?error=bitbucket_config`, request.url),
    );
  }

  // 7. Exchange code for tokens
  const redirectUri = `${baseUrl}/api/auth/bitbucket/callback`;
  const tokens = await exchangeBitbucketCode(
    code,
    clientId,
    clientSecret,
    redirectUri,
  );
  if (!tokens) {
    return NextResponse.redirect(
      new URL(`${errorRedirectBase}?error=bitbucket_token_exchange`, request.url),
    );
  }

  // 8. Fetch Bitbucket user profile
  const bbUser = await fetchBitbucketUser(tokens.access_token);
  if (!bbUser) {
    return NextResponse.redirect(
      new URL(`${errorRedirectBase}?error=bitbucket_user_fetch`, request.url),
    );
  }

  // 9. Store encrypted tokens in user_platforms
  const expiresAt = computeTokenExpiry(tokens.expires_in);
  const stored = await dbUpsertLinkedPlatform(
    handle,
    "bitbucket",
    bbUser.username,
    tokens.access_token,
    tokens.refresh_token,
    expiresAt,
  );
  if (!stored) {
    return NextResponse.redirect(
      new URL(`${errorRedirectBase}?error=bitbucket_storage`, request.url),
    );
  }

  // 10. Invalidate stats cache (force re-merge on next badge request)
  const lh = handle.toLowerCase();
  void cacheDel(`stats:v2:merged:${lh}`);
  void cacheDel(`stats:v2:bitbucket:${lh}`);

  // 11. Clear state cookie and redirect to share page
  const response = NextResponse.redirect(
    new URL(`/u/${handle}?bitbucket=linked`, request.url),
  );
  response.headers.append("Set-Cookie", clearBitbucketStateCookie());
  return response;
}
