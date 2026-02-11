import { type NextRequest, NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/github";

export async function GET(request: NextRequest) {
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
