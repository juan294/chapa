import { type NextRequest, NextResponse } from "next/server";
import { isBitbucketEnabled } from "@/lib/feature-flags";
import { requireSession } from "@/lib/auth/require-session";
import { dbDeleteLinkedPlatform } from "@/lib/db/user-platforms";
import { cacheDel, rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";

export async function POST(request: NextRequest) {
  // 1. Feature flag check
  if (!(await isBitbucketEnabled())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 2. Rate limit: 10 requests per IP per 15 minutes
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:bb:disconnect:${ip}`, 10, 900);
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

  // 4. Delete linked platform
  const success = await dbDeleteLinkedPlatform(handle, "bitbucket");

  // 5. Invalidate stats cache (force re-fetch without Bitbucket data)
  const lh = handle.toLowerCase();
  void cacheDel(`stats:v2:merged:${lh}`);
  void cacheDel(`stats:v2:bitbucket:${lh}`);

  // 6. Return result
  return NextResponse.json({ success });
}
