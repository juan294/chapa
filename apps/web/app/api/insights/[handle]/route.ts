import { type NextRequest, NextResponse } from "next/server";
import { isValidHandle } from "@/lib/validation";
import { dbGetToolInsights } from "@/lib/db/tool-insights";
import { rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";

/**
 * GET /api/insights/:handle — Read craft score (public, no auth).
 * Returns { craftScore: CraftResult | null }.
 * No raw_data is exposed — only the computed scores.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
): Promise<Response> {
  try {
    const { handle } = await params;

    if (!isValidHandle(handle)) {
      return NextResponse.json(
        { error: "Invalid handle format" },
        { status: 400 },
      );
    }

    // Rate limit: 60 req/IP/min
    const ip = getClientIp(request);
    const rl = await rateLimit(`ratelimit:insights:${ip}`, 60, 60);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    // Authoritative rule: dbGetToolInsights returns the latest uploaded report.
    const craftScore = await dbGetToolInsights(handle);

    return NextResponse.json({ craftScore });
  } catch (err) {
    console.error("[insights/:handle] Unhandled error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
