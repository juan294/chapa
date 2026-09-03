import { type NextRequest, NextResponse } from "next/server";
import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { resolveBadgeConfigSnapshot } from "@/lib/render/badge-config";
import { resolveBadgeLocale } from "@/lib/render/badge-locale";
import { DEFAULT_LOCALE, isSupportedLocale } from "@/lib/i18n/types";
import type { Locale } from "@/lib/i18n/types";
import { getAvatarBase64 } from "@/lib/render/avatar";
import { isValidHandle } from "@/lib/validation";
import { svgToPng } from "@/lib/render/svg-to-png";
import { cacheDel, cacheGet, cacheSet, rateLimit } from "@/lib/cache/redis";
import { ogImageEdgeCacheTag } from "@/lib/cache/edge-cache";
import {
  buildOgImageCacheKey,
  buildOgImageCacheVersion,
} from "@/lib/render/badge-svg-cache";
import { getClientIp } from "@/lib/http/client-ip";
import { toDateString } from "@/lib/utils/date";
import { withTimeout, TimeoutError } from "@/lib/async/with-timeout";
import { captureServerError } from "@/lib/analytics/server-errors";
import {
  getPublicProfileVerification,
  materializePublicProfile,
} from "@/lib/profile/public-profile";

const OG_CACHE_TTL = 172800; // 48 hours
const SVG_TO_PNG_TIMEOUT_MS = 10_000;
const OG_EDGE_POLICY = "public, s-maxage=21600, stale-while-revalidate=86400";
const OG_CLIENT_POLICY = "public, max-age=300";

type OgImageCacheEntry = {
  version: string;
  pngBase64: string;
};

function isOgImageCacheEntry(value: unknown): value is OgImageCacheEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Partial<OgImageCacheEntry>).version === "string" &&
    typeof (value as Partial<OgImageCacheEntry>).pngBase64 === "string"
  );
}

function ogImageCacheHeaders(handle: string) {
  return {
    "Content-Type": "image/png",
    "Cache-Control": OG_CLIENT_POLICY,
    "Vercel-CDN-Cache-Control": OG_EDGE_POLICY,
    "Vercel-Cache-Tag": ogImageEdgeCacheTag(handle),
  };
}

function ogImageNoStoreHeaders() {
  return {
    "Content-Type": "image/png",
    "Cache-Control": "private, no-store, max-age=0",
    "Vercel-CDN-Cache-Control": "no-store",
  };
}

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
  // #1190 — the OG image is credential-less and publicly cacheable, exactly
  // like badge.svg, so locale comes from `?lang=` rather than the cookie
  // chain. It MUST be in the cache key: without it whichever locale rendered
  // first won the day's slot and every other locale was served that PNG.
  const lang = request.nextUrl.searchParams.get("lang");
  const locale: Locale = isSupportedLocale(lang) ? lang : DEFAULT_LOCALE;
  const badgeLocale = resolveBadgeLocale(locale);
  const ogCacheKey = buildOgImageCacheKey(handle, today, locale);
  const configSnapshot = await resolveBadgeConfigSnapshot(handle);
  const expectedVersion = configSnapshot.cacheable
    ? buildOgImageCacheVersion(today, configSnapshot.revision)
    : null;
  const requestedVersion = request.nextUrl.searchParams.get("v");
  const publicationVersion =
    expectedVersion !== null && requestedVersion === expectedVersion
      ? expectedVersion
      : null;

  // PE-L1: Cache-first — serve warm-cache PNG without the rate-limit round-trip.
  // Rate limiting is deferred to the cache-MISS branch (expensive path only).
  try {
    const cached = await cacheGet<unknown>(ogCacheKey);
    if (
      publicationVersion !== null &&
      isOgImageCacheEntry(cached) &&
      cached.version === publicationVersion
    ) {
      const pngBuffer = Buffer.from(cached.pngBase64, "base64");
      return new NextResponse(pngBuffer, {
        headers: ogImageCacheHeaders(handle),
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
      config: configSnapshot.config,
      verificationHash: verification?.hash,
      verificationDate: verification?.date,
      // Rasterized to PNG below — SMIL <animate> never runs during rasterization,
      // so animated heatmap cells would render invisible (stuck at opacity 0). (#760)
      disableAnimation: true,
      // Same resolved bundle that produced ogCacheKey above, so the image and
      // the key it is stored under are always for the same locale (#1190).
      strings: badgeLocale.stringsFor(materialized.displayImpact.tier),
    });

    const png = await withTimeout(
      svgToPng(svg, 1200),
      SVG_TO_PNG_TIMEOUT_MS,
      "svgToPng",
    );

    if (publicationVersion === null) {
      return new NextResponse(Buffer.from(png), {
        headers: ogImageNoStoreHeaders(),
      });
    }

    // This write is awaited because its revision fence is part of correctness:
    // detaching it would let a pre-save render publish after the save purge.
    // cacheSet normally resolves false instead of throwing, but keep the catch
    // defensive so cache degradation never breaks image delivery.
    let cached = false;
    try {
      cached = await cacheSet(
        ogCacheKey,
        {
          version: publicationVersion,
          pngBase64: Buffer.from(png).toString("base64"),
        } satisfies OgImageCacheEntry,
        OG_CACHE_TTL,
      );
    } catch {
      cached = false;
    }
    if (!cached) {
      void captureServerError({
        route: `/u/${handle}/og-image`,
        statusCode: 200,
        error: new Error(`Failed to cache OG image PNG for handle: ${handle}`),
      });
    }

    // Publish first, then perform the final revision read. This ordering makes
    // every save fall on one side of the fence: a save before this read is
    // detected and the just-written value is deleted; a save after it purges a
    // value that already exists. The revision in both the Redis payload and
    // metadata URL prevents stale values/responses from poisoning the new URL.
    const currentConfigSnapshot = await resolveBadgeConfigSnapshot(handle);
    const currentVersion = currentConfigSnapshot.cacheable
      ? buildOgImageCacheVersion(today, currentConfigSnapshot.revision)
      : null;
    if (currentVersion !== publicationVersion) {
      if (cached) await cacheDel(ogCacheKey);
      return new NextResponse(Buffer.from(png), {
        headers: ogImageNoStoreHeaders(),
      });
    }

    return new NextResponse(Buffer.from(png), {
      headers: ogImageCacheHeaders(handle),
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
