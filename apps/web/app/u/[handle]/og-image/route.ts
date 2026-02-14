import { type NextRequest, NextResponse } from "next/server";
import { getStats } from "@/lib/github/client";
import { computeImpactV4 } from "@/lib/impact/v4";
import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { fetchAvatarBase64 } from "@/lib/render/avatar";
import { isValidHandle } from "@/lib/validation";
import { generateVerificationCode } from "@/lib/verification/hmac";
import { svgToPng } from "@/lib/render/svg-to-png";

/**
 * GET /u/:handle/og-image
 *
 * Renders the actual badge SVG as a PNG for use as the OpenGraph image.
 * This produces the same visual as the embeddable badge, not a simplified layout.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params;

  if (!isValidHandle(handle)) {
    return new NextResponse("Invalid handle", { status: 400 });
  }

  try {
    const stats = await getStats(handle);
    if (!stats) {
      return new NextResponse("Could not load data", { status: 404 });
    }

    const impact = computeImpactV4(stats);

    const avatarDataUri = stats.avatarUrl
      ? await fetchAvatarBase64(stats.avatarUrl)
      : undefined;

    const verification = generateVerificationCode(stats, impact);

    const svg = renderBadgeSvg(stats, impact, {
      avatarDataUri,
      verificationHash: verification?.hash,
      verificationDate: verification?.date,
    });

    const png = svgToPng(svg, 1200);

    return new NextResponse(Buffer.from(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control":
          "public, s-maxage=21600, stale-while-revalidate=604800",
      },
    });
  } catch (e) {
    console.error("[og-image] failed to generate badge PNG:", e);
    return new NextResponse("Failed to generate image", { status: 500 });
  }
}
