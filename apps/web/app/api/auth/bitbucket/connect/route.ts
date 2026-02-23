import { type NextRequest, NextResponse } from "next/server";
import { isBitbucketEnabled } from "@/lib/feature-flags";
import { requireSession } from "@/lib/auth/require-session";
import {
  createBitbucketStateCookie,
  buildBitbucketAuthUrl,
} from "@/lib/auth/bitbucket";

export async function GET(request: NextRequest) {
  // 1. Feature flag check
  if (!(await isBitbucketEnabled())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 2. Require authenticated session (must be logged in with GitHub first)
  const { session, error } = requireSession(request);
  if (error) return error;

  // 3. Validate env vars
  const clientId = process.env.BITBUCKET_CLIENT_ID?.trim();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (!clientId || !baseUrl) {
    return NextResponse.redirect(
      new URL(`/u/${session.login}?error=config`, request.url),
    );
  }

  // 4. Generate CSRF state + cookie
  const { state, cookie } = createBitbucketStateCookie();
  const redirectUri = `${baseUrl}/api/auth/bitbucket/callback`;
  const authUrl = buildBitbucketAuthUrl(clientId, redirectUri, state);

  // 5. Redirect to Bitbucket
  const response = NextResponse.redirect(authUrl);
  response.headers.append("Set-Cookie", cookie);
  return response;
}
