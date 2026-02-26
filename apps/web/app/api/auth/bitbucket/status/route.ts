import { type NextRequest, NextResponse } from "next/server";
import { isBitbucketEnabled } from "@/lib/feature-flags";
import { requireSession } from "@/lib/auth/require-session";
import { dbGetLinkedPlatforms } from "@/lib/db/user-platforms";
import { rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";

export async function GET(request: NextRequest) {
  // 1. Feature flag check — return soft "not enabled" (not 404)
  if (!(await isBitbucketEnabled())) {
    return NextResponse.json({ enabled: false });
  }

  // 2. Rate limit: 20 requests per IP per 15 minutes
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:bb:status:${ip}`, 20, 900);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "900" } },
    );
  }

  // 3. Require authenticated session
  const { session, error } = requireSession(request);
  if (error) return error;

  // 4. Get linked platforms
  const platforms = await dbGetLinkedPlatforms(session.login);
  const bitbucket = platforms.find((p) => p.platform === "bitbucket");

  return NextResponse.json({
    enabled: true,
    linked: !!bitbucket,
    remoteLogin: bitbucket?.remoteLogin ?? null,
    connectedAt: bitbucket?.connectedAt ?? null,
  });
}
