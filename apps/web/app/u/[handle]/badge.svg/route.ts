import { type NextRequest, NextResponse } from "next/server";
import { getStats90d } from "@/lib/github/client";
import { computeImpactV3 } from "@/lib/impact/v3";
import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { readSessionCookie } from "@/lib/auth/github";
import { escapeXml } from "@/lib/render/escape";

const CACHE_HEADERS = {
  "Content-Type": "image/svg+xml",
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
};

function fallbackSvg(handle: string, message: string): string {
  const safe = escapeXml(handle);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" rx="16" fill="#12100D" stroke="rgba(226,168,75,0.12)" stroke-width="2"/>
  <text x="60" y="80" font-family="'JetBrains Mono', monospace" font-size="42" font-weight="700" fill="#E2A84B">CHAPA</text>
  <text x="60" y="120" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="18" fill="#9AA4B2">Developer Impact Badge</text>
  <text x="60" y="340" font-family="'JetBrains Mono', monospace" font-size="28" fill="#E6EDF3">@${safe}</text>
  <text x="60" y="400" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="16" fill="#9AA4B2">${escapeXml(message)}</text>
</svg>`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params;

  // Try to get an auth token from session (better rate limits)
  const sessionSecret = process.env.NEXTAUTH_SECRET?.trim();
  let token: string | undefined;
  if (sessionSecret) {
    const session = readSessionCookie(
      request.headers.get("cookie"),
      sessionSecret,
    );
    if (session) token = session.token;
  }

  // Fetch stats (cache-first)
  const stats = await getStats90d(handle, token);
  if (!stats) {
    const svg = fallbackSvg(
      handle,
      "Could not load data — try again later.",
    );
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  }

  // Compute impact
  const impact = computeImpactV3(stats);

  // Render full badge
  const svg = renderBadgeSvg(stats, impact);

  return new NextResponse(svg, { headers: CACHE_HEADERS });
}
