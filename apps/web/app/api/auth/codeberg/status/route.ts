import { type NextRequest, NextResponse } from "next/server";
import { isCodebergEnabled } from "@/lib/feature-flags";
import { requireSession } from "@/lib/auth/require-session";
import { dbGetLinkedPlatforms } from "@/lib/db/user-platforms";

export async function GET(request: NextRequest) {
  // 1. Feature flag check — return soft "not enabled" (not 404)
  if (!(await isCodebergEnabled())) {
    return NextResponse.json({ enabled: false });
  }

  // 2. Require authenticated session
  const { session, error } = requireSession(request);
  if (error) return error;

  // 3. Get linked platforms
  const platforms = await dbGetLinkedPlatforms(session.login);
  const codeberg = platforms.find((p) => p.platform === "codeberg");

  return NextResponse.json({
    enabled: true,
    linked: !!codeberg,
    remoteLogin: codeberg?.remoteLogin ?? null,
    connectedAt: codeberg?.connectedAt ?? null,
  });
}
