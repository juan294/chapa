import { NextResponse } from "next/server";
import { cacheGet, cacheDel } from "@/lib/cache/redis";
import { generateCliToken } from "@/lib/auth/cli-token";

interface DeviceSession {
  status: "pending" | "approved";
  handle?: string;
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session");

  if (!sessionId || !/^[a-f0-9-]{36}$/.test(sessionId)) {
    return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
  }

  const session = await cacheGet<DeviceSession>(`cli:device:${sessionId}`);

  if (!session) {
    return NextResponse.json({ status: "pending" });
  }

  if (session.status === "approved" && session.handle) {
    const secret = process.env.NEXTAUTH_SECRET?.trim();
    if (!secret) {
      return NextResponse.json(
        { error: "Server misconfigured" },
        { status: 500 },
      );
    }

    const token = generateCliToken(session.handle, secret);

    // Clean up — one-time use
    await cacheDel(`cli:device:${sessionId}`);

    return NextResponse.json({
      status: "approved",
      token,
      handle: session.handle,
    });
  }

  return NextResponse.json({ status: "pending" });
}
