import { type NextRequest, NextResponse } from "next/server";
import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { getAvatarBase64 } from "@/lib/render/avatar";
import { isValidHandle } from "@/lib/validation";
import { svgToPng } from "@/lib/render/svg-to-png";
import { cacheGet, cacheSet, rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";
import { toDateString } from "@/lib/utils/date";
import { fireAndForget } from "@/lib/async/fire-and-forget";
import { withTimeout, TimeoutError } from "@/lib/async/with-timeout";
import {
  getPublicProfileVerification,
  materializePublicProfile,
} from "@/lib/profile/public-profile";

const OG_CACHE_TTL = 172800; // 48 hours
const SVG_TO_PNG_TIMEOUT_MS = 10_000;

/**
 * GET /u/:handle/og-image
 *
 * Renders the actual badge SVG as a PNG for use as the OpenGraph image.
 * This produces the same visual as the embeddable badge, not a simplified layout.
 *
 * The final PNG is cached in Redis (keyed by handle + date) to avoid
 * redundant stats fetch + SVG render + PNG conversion on repeated requests.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params;

  // Validate handle before any cache/rate-limit work
  if (!isValidHandle(handle)) {
    return new NextResponse("Invalid handle", { status: 400 });
  }

  const today = toDateString(new Date());
  const ogCacheKey = `og-image:v2:${handle}:${today}`;

  // PE-L1: Cache-first — serve warm-cache PNG without the rate-limit round-trip.
  // Rate limiting is deferred to the cache-MISS branch (expensive path only).
  try {
    const cachedBase64 = await cacheGet<string>(ogCacheKey);
    if (cachedBase64) {
      const pngBuffer = Buffer.from(cachedBase64, "base64");
      return new NextResponse(pngBuffer, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control":
            "public, s-maxage=21600, stale-while-revalidate=86400",
        },
      });
    }
  } catch {
    // Redis error — fall through to generation
  }

  // Cache miss: apply rate limit before triggering the expensive render path.
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:og:${ip}`, 30, 60);
  if (!rl.allowed) {
    return new NextResponse("Too many requests. Please try again later.", {
      status: 429,
      headers: {
        "Content-Type": "text/plain",
        "Retry-After": "60",
      },
    });
  }

  try {
    const materialized = await materializePublicProfile(handle);
    if (!materialized) {
      return new NextResponse("Could not load data", { status: 404 });
    }

    const avatarDataUri = materialized.stats.avatarUrl
      ? await getAvatarBase64(handle, materialized.stats.avatarUrl).catch(() => undefined)
      : undefined;

    const verification = getPublicProfileVerification(materialized);

    const svg = renderBadgeSvg(materialized.stats, materialized.displayImpact, {
      avatarDataUri,
      verificationHash: verification?.hash,
      verificationDate: verification?.date,
      // Rasterized to PNG below — SMIL <animate> never runs during rasterization,
      // so animated heatmap cells would render invisible (stuck at opacity 0). (#760)
      disableAnimation: true,
    });

    const png = await withTimeout(
      svgToPng(svg, 1200),
      SVG_TO_PNG_TIMEOUT_MS,
      "svgToPng",
    );

    // Cache the PNG as base64 for 48h (fire-and-forget — don't block response)
    fireAndForget(
      () => cacheSet(ogCacheKey, Buffer.from(png).toString("base64"), OG_CACHE_TTL),
      () => undefined,
    );

    return new NextResponse(Buffer.from(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control":
          "public, s-maxage=21600, stale-while-revalidate=86400",
      },
    });
  } catch (e) {
    if (e instanceof TimeoutError) {
      console.error("[og-image] svgToPng timed out after 10s");
      return new NextResponse("PNG conversion timed out", { status: 504 });
    }
    console.error("[og-image] failed to generate badge PNG:", e);
    return new NextResponse("Failed to generate image", { status: 500 });
  }
}
