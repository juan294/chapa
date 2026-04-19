import { type NextRequest, NextResponse, after } from "next/server";
import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { getAvatarBase64 } from "@/lib/render/avatar";
import { getOptionalRequestSession } from "@/lib/auth/session";
import { isValidHandle } from "@/lib/validation";
import { escapeXml } from "@/lib/render/escape";
import { cacheGet, cacheSet, rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";
import { captureServerError } from "@/lib/analytics/server-errors";
import {
  getPublicProfileVerification,
  materializePublicProfile,
  runPublicProfileSideEffects,
} from "@/lib/profile/public-profile";

const CACHE_HEADERS = {
  "Content-Type": "image/svg+xml",
  "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
  // Badge SVG is designed to be embedded in READMEs, iframes, etc.
  // These headers are set explicitly on the Response object to override the
  // catch-all frame-ancestors 'none' + X-Frame-Options DENY from next.config.ts,
  // which Next.js merges into all matching routes (see issue #270).
  "Content-Security-Policy": "frame-ancestors *",
  "X-Frame-Options": "ALLOWALL",
};

function fallbackSvg(handle: string, message: string): string {
  const safe = escapeXml(handle);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" rx="16" fill="#0C0D14" stroke="rgba(139,92,246,0.12)" stroke-width="2"/>
  <text x="60" y="80" font-family="'JetBrains Mono', monospace" font-size="42" font-weight="700" fill="#8B5CF6">CHAPA</text>
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

  // Rate limit: 100 requests per IP+handle per 60 seconds
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:badge:${ip}:${handle}`, 100, 60);
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

  // SVG full-response cache: serve stale badge without hitting GitHub API
  const svgCacheKey = `svg:badge:${handle}:v1`;
  const cachedSvg = await cacheGet<string>(svgCacheKey);
  if (cachedSvg) {
    return new NextResponse(cachedSvg, { headers: CACHE_HEADERS });
  }

  // Try to get an auth token from session (better rate limits)
  const session = getOptionalRequestSession(request);
  const token = session?.token;

  try {
    const materialized = await materializePublicProfile(handle, { token });
    if (!materialized) {
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

    const avatarDataUri = materialized.stats.avatarUrl
      ? await getAvatarBase64(handle, materialized.stats.avatarUrl).catch(() => undefined)
      : undefined;
    const verification = getPublicProfileVerification(materialized);

    after(() => {
      return runPublicProfileSideEffects(handle, materialized, { verification });
    });

    const svg = renderBadgeSvg(materialized.stats, materialized.displayImpact, {
      avatarDataUri,
      verificationHash: verification?.hash,
      verificationDate: verification?.date,
    });

    void cacheSet(svgCacheKey, svg, 86400);
    return new NextResponse(svg, { headers: CACHE_HEADERS });
  } catch (err) {
    void captureServerError({
      route: `/u/${handle}/badge.svg`,
      statusCode: 500,
      error: err,
    });

    const svg = fallbackSvg(handle, "Something went wrong — try again later.");
    return new NextResponse(svg, {
      status: 500,
      headers: { "Content-Type": "image/svg+xml" },
    });
  }
}
