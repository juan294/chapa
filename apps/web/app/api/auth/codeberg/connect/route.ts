import { type NextRequest, NextResponse } from "next/server";
import { isCodebergEnabled } from "@/lib/feature-flags";
import { requireSession } from "@/lib/auth/require-session";
import {
  createCodebergStateCookie,
  buildCodebergAuthUrl,
} from "@/lib/auth/codeberg";

export async function GET(request: NextRequest) {
  // 1. Feature flag check
  if (!(await isCodebergEnabled())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 2. Require authenticated session (must be logged in with GitHub first)
  const { session, error } = requireSession(request);
  if (error) return error;

  // 3. Validate env vars
  const clientId = process.env.CODEBERG_CLIENT_ID?.trim();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (!clientId || !baseUrl) {
    return NextResponse.redirect(
      new URL(`/u/${session.login}?error=config`, request.url),
    );
  }

  // 4. Generate CSRF state + cookie
  const { state, cookie } = createCodebergStateCookie();
  const redirectUri = `${baseUrl}/api/auth/codeberg/callback`;
  const authUrl = buildCodebergAuthUrl(clientId, redirectUri, state);

  // 5. Redirect to Codeberg
  const response = NextResponse.redirect(authUrl);
  response.headers.append("Set-Cookie", cookie);
  return response;
}
