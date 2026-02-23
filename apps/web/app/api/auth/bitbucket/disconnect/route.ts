import { type NextRequest, NextResponse } from "next/server";
import { isBitbucketEnabled } from "@/lib/feature-flags";
import { requireSession } from "@/lib/auth/require-session";
import { dbDeleteLinkedPlatform } from "@/lib/db/user-platforms";
import { cacheDel } from "@/lib/cache/redis";

export async function POST(request: NextRequest) {
  // 1. Feature flag check
  if (!(await isBitbucketEnabled())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 2. Require authenticated session
  const { session, error } = requireSession(request);
  if (error) return error;

  const handle = session.login;

  // 3. Delete linked platform
  const success = await dbDeleteLinkedPlatform(handle, "bitbucket");

  // 4. Invalidate stats cache (force re-fetch without Bitbucket data)
  void cacheDel(`stats:v2:${handle.toLowerCase()}`);

  // 5. Return result
  return NextResponse.json({ success });
}
