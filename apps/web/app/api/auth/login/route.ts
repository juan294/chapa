import { type NextRequest, NextResponse } from "next/server";
import { buildAuthUrl, createStateCookie } from "@/lib/auth/github";
import { rateLimit } from "@/lib/cache/redis";

export async function GET(request: NextRequest) {
  // Rate limit: 20 requests per IP per 15 minutes
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await rateLimit(`ratelimit:login:${ip}`, 20, 900);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "900" } },
    );
  }

  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  if (!clientId) {
    return NextResponse.json(
      { error: "GitHub OAuth not configured" },
      { status: 500 },
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim() || "http://localhost:3001";
  const redirectUri = `${baseUrl}/api/auth/callback`;

  const { state, cookie: stateCookie } = createStateCookie();
  const authUrl = buildAuthUrl(clientId, redirectUri, state);

  const response = NextResponse.redirect(authUrl);
  response.headers.append("Set-Cookie", stateCookie);
  return response;
}
