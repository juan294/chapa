import { type NextRequest, NextResponse } from "next/server";
import { getStats } from "@/lib/github/client";
import { computeImpactV6 } from "@/lib/impact/v6";
import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { getAvatarBase64 } from "@/lib/render/avatar";
import { isValidHandle } from "@/lib/validation";
import { generateVerificationCode } from "@/lib/verification/hmac";
import { svgToPng } from "@/lib/render/svg-to-png";
import { cacheGet, cacheSet } from "@/lib/cache/redis";
import { toDateString } from "@/lib/utils/date";
import { withTimeout, TimeoutError } from "@/lib/async/with-timeout";

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
  _request: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params;

  if (!isValidHandle(handle)) {
    return new NextResponse("Invalid handle", { status: 400 });
  }

  const today = toDateString(new Date());
  const ogCacheKey = `og-image:v1:${handle}:${today}`;

  // Try cached PNG first
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

  try {
    const stats = await getStats(handle);
    if (!stats) {
      return new NextResponse("Could not load data", { status: 404 });
    }

    const impact = computeImpactV6(stats);

    const avatarDataUri = stats.avatarUrl
      ? await getAvatarBase64(handle, stats.avatarUrl)
      : undefined;

    const verification = generateVerificationCode(stats, impact);

    const svg = renderBadgeSvg(stats, impact, {
      avatarDataUri,
      verificationHash: verification?.hash,
      verificationDate: verification?.date,
    });

    const png = await withTimeout(
      Promise.resolve().then(() => svgToPng(svg, 1200)),
      SVG_TO_PNG_TIMEOUT_MS,
      "svgToPng",
    );

    // Cache the PNG as base64 for 48h (fire-and-forget — don't block response)
    cacheSet(ogCacheKey, Buffer.from(png).toString("base64"), OG_CACHE_TTL).catch(() => {});

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
