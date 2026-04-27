import { type NextRequest, NextResponse } from "next/server";
import { getOptionalRequestSession } from "@/lib/auth/session";
import { isAdminHandle } from "@/lib/auth/admin";
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

  const session = getOptionalRequestSession(request);

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
      isAdmin: isAdminHandle(session.login),
    },
  });
  res.headers.set("Cache-Control", "no-store, private");
  return res;
}
