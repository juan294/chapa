import { NextResponse } from "next/server";
import { buildAuthUrl, createStateCookie } from "@/lib/auth/github";

export async function GET() {
  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  if (!clientId) {
    return NextResponse.json(
      { error: "GitHub OAuth not configured" },
      { status: 500 },
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim() ?? "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/auth/callback`;

  const { state, cookie: stateCookie } = createStateCookie();
  const authUrl = buildAuthUrl(clientId, redirectUri, state);

  const response = NextResponse.redirect(authUrl);
  response.headers.append("Set-Cookie", stateCookie);
  return response;
}
