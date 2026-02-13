import { type NextRequest, NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/github";
import { rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";

export async function GET(request: NextRequest) {
  // Rate limit: 60 requests per IP per 60 seconds
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:session:${ip}`, 60, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const sessionSecret = process.env.NEXTAUTH_SECRET?.trim();
  if (!sessionSecret) {
    const res = NextResponse.json({ user: null });
    res.headers.set("Cache-Control", "no-store, private");
    return res;
  }

  const cookieHeader = request.headers.get("cookie");
  const session = readSessionCookie(cookieHeader, sessionSecret);

  if (!session) {
    const res = NextResponse.json({ user: null });
    res.headers.set("Cache-Control", "no-store, private");
    return res;
  }

  const res = NextResponse.json({
    user: {
      login: session.login,
      name: session.name,
      avatar_url: session.avatar_url,
    },
  });
  res.headers.set("Cache-Control", "no-store, private");
  return res;
}
