import { type NextRequest, NextResponse } from "next/server";
import { isCodebergEnabled } from "@/lib/feature-flags";
import { requireSession } from "@/lib/auth/require-session";
import { dbDeleteLinkedPlatform } from "@/lib/db/user-platforms";
import { cacheDel } from "@/lib/cache/redis";

export async function POST(request: NextRequest) {
  // 1. Feature flag check
  if (!(await isCodebergEnabled())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 2. Require authenticated session
  const { session, error } = requireSession(request);
  if (error) return error;

  const handle = session.login;

  // 3. Delete linked platform
  const success = await dbDeleteLinkedPlatform(handle, "codeberg");

  // 4. Invalidate stats cache (force re-fetch without Codeberg data)
  const lh = handle.toLowerCase();
  void cacheDel(`stats:v2:merged:${lh}`);
  void cacheDel(`stats:v2:codeberg:${lh}`);

  // 5. Return result
  return NextResponse.json({ success });
}
