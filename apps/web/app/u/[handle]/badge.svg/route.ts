import { type NextRequest, NextResponse } from "next/server";
import { getStats } from "@/lib/github/client";
import { computeImpactV4 } from "@/lib/impact/v4";
import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { fetchAvatarBase64 } from "@/lib/render/avatar";
import { readSessionCookie } from "@/lib/auth/github";
import { isValidHandle } from "@/lib/validation";
import { escapeXml } from "@/lib/render/escape";
import { rateLimit } from "@/lib/cache/redis";
import { generateVerificationCode } from "@/lib/verification/hmac";
import { storeVerificationRecord } from "@/lib/verification/store";
import type { VerificationRecord } from "@/lib/verification/types";

const CACHE_HEADERS = {
  "Content-Type": "image/svg+xml",
  "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=604800",
};

function fallbackSvg(handle: string, message: string): string {
  const safe = escapeXml(handle);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" rx="16" fill="#0C0D14" stroke="rgba(124,106,239,0.12)" stroke-width="2"/>
  <text x="60" y="80" font-family="'JetBrains Mono', monospace" font-size="42" font-weight="700" fill="#7C6AEF">CHAPA</text>
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

  // Rate limit: 100 requests per IP per 60 seconds
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await rateLimit(`ratelimit:badge:${ip}`, 100, 60);
  if (!rl.allowed) {
    return new NextResponse("Too many requests. Please try again later.", {
      status: 429,
      headers: {
        "Content-Type": "text/plain",
        "Retry-After": "60",
      },
    });
  }

  // Validate handle before any work
  if (!isValidHandle(handle)) {
    const svg = fallbackSvg(handle, "Invalid GitHub handle.");
    return new NextResponse(svg, {
      status: 400,
      headers: { "Content-Type": "image/svg+xml" },
    });
  }

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
  const stats = await getStats(handle, token);
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
  const impact = computeImpactV4(stats);

  // Fetch avatar as base64 data URI (external URLs don't load in SVG-as-image)
  const avatarDataUri = stats.avatarUrl
    ? await fetchAvatarBase64(stats.avatarUrl)
    : undefined;

  // Generate verification code (returns null if secret is unset)
  const verification = generateVerificationCode(stats, impact);

  // Store verification record (fire-and-forget — don't block render)
  if (verification) {
    const record: VerificationRecord = {
      handle: stats.handle.toLowerCase(),
      displayName: stats.displayName,
      adjustedComposite: impact.adjustedComposite,
      confidence: impact.confidence,
      tier: impact.tier,
      archetype: impact.archetype,
      dimensions: impact.dimensions,
      commitsTotal: stats.commitsTotal,
      prsMergedCount: stats.prsMergedCount,
      reviewsSubmittedCount: stats.reviewsSubmittedCount,
      generatedAt: verification.date,
      profileType: impact.profileType,
    };
    void storeVerificationRecord(verification.hash, record);
  }

  // Render full badge
  const svg = renderBadgeSvg(stats, impact, {
    avatarDataUri,
    verificationHash: verification?.hash,
    verificationDate: verification?.date,
  });

  return new NextResponse(svg, { headers: CACHE_HEADERS });
}
