import { type NextRequest, NextResponse } from "next/server";
import { isBitbucketEnabled } from "@/lib/feature-flags";
import { requireSession } from "@/lib/auth/require-session";
import { dbGetLinkedPlatforms } from "@/lib/db/user-platforms";

export async function GET(request: NextRequest) {
  // 1. Feature flag check — return soft "not enabled" (not 404)
  if (!(await isBitbucketEnabled())) {
    return NextResponse.json({ enabled: false });
  }

  // 2. Require authenticated session
  const { session, error } = requireSession(request);
  if (error) return error;

  // 3. Get linked platforms
  const platforms = await dbGetLinkedPlatforms(session.login);
  const bitbucket = platforms.find((p) => p.platform === "bitbucket");

  return NextResponse.json({
    enabled: true,
    linked: !!bitbucket,
    remoteLogin: bitbucket?.remoteLogin ?? null,
    connectedAt: bitbucket?.connectedAt ?? null,
  });
}
