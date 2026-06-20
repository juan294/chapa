import { type NextRequest, NextResponse, after } from "next/server";
import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { getAvatarBase64 } from "@/lib/render/avatar";
import { getOptionalRequestSession } from "@/lib/auth/session";
import { isValidHandle } from "@/lib/validation";
import { escapeXml } from "@/lib/render/escape";
import { fireAndForget } from "@/lib/async/fire-and-forget";
import {
  cacheDel,
  cacheSetNx,
  rateLimit,
} from "@/lib/cache/redis";
import {
  buildBadgeSvgCacheKey,
  readBadgeSvgCache,
  writeBadgeSvgCache,
} from "@/lib/render/badge-svg-cache";
import { CACHE_VERSION } from "@/lib/cache/version";
import { getClientIp } from "@/lib/http/client-ip";
import { captureServerError } from "@/lib/analytics/server-errors";
import { toDateString } from "@/lib/utils/date";
import { withTimeout } from "@/lib/async/with-timeout";
import {
  getPublicProfileVerification,
  materializePublicProfile,
  runPublicProfileSideEffects,
} from "@/lib/profile/public-profile";

export const maxDuration = 35;

const BADGE_RENDER_LOCK_TTL_SECONDS = 30;
const BADGE_CACHE_DEADLINE_MS = 250;
const BADGE_RATE_LIMIT_DEADLINE_MS = 150;
const BADGE_RENDER_WAIT_SCHEDULE_MS = [50, 75, 100, 125, 150, 200, 250, 300, 350, 400];
type BadgeRenderResult = {
  svg: string;
  headers: HeadersInit;
  status?: number;
};

const inflightBadgeRenders = new Map<string, Promise<BadgeRenderResult>>();

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

function buildBadgeRenderLockKey(handle: string, date: string): string {
  return `badge-lock:${CACHE_VERSION}:${handle.toLowerCase()}:warm-amber:${date}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withBadgeFallback<T>(
  promise: Promise<T>,
  fallback: T,
  ms: number,
  label: string,
): Promise<T> {
  try {
    return await withTimeout(promise, ms, label);
  } catch {
    return fallback;
  }
}

async function acquireBadgeRenderLock(key: string): Promise<boolean> {
  return withBadgeFallback(
    cacheSetNx(key, BADGE_RENDER_LOCK_TTL_SECONDS),
    false,
    BADGE_CACHE_DEADLINE_MS,
    "badge render lock",
  );
}

async function checkBadgeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
) {
  return withBadgeFallback(
    rateLimit(key, limit, windowSeconds),
    { allowed: true, current: 0, limit },
    BADGE_RATE_LIMIT_DEADLINE_MS,
    "badge rate limit",
  );
}

async function waitForBadgeSvgCache(key: string): Promise<string | null> {
  for (const waitMs of BADGE_RENDER_WAIT_SCHEDULE_MS) {
    await sleep(waitMs);
    const cached = await readBadgeSvgCache(key);
    if (cached) return cached;
  }

  return null;
}

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params;

  // Validate handle before any cache/rate-limit work
  if (!isValidHandle(handle)) {
    const svg = fallbackSvg(handle, "Invalid GitHub handle.");
    return new NextResponse(svg, {
      status: 400,
      headers: { "Content-Type": "image/svg+xml" },
    });
  }

  // SVG full-response cache: serve warm-cache badge without any Redis rate-limit
  // overhead (#882 — rate limit moved to cache-MISS branch only).
  const today = toDateString(new Date());
  const svgCacheKey = buildBadgeSvgCacheKey(handle, today);
  const cachedSvg = await readBadgeSvgCache(svgCacheKey);
  if (cachedSvg) {
    return new NextResponse(cachedSvg, { headers: CACHE_HEADERS });
  }

  // Cache miss: apply rate limit before triggering the expensive render path.
  // Rate limit: 100 requests per IP+handle per 60 seconds
  const ip = getClientIp(request);
  const rl = await checkBadgeRateLimit(`ratelimit:badge:${ip}:${handle}`, 100, 60);
  if (!rl.allowed) {
    return new NextResponse("Too many requests. Please try again later.", {
      status: 429,
      headers: {
        "Content-Type": "text/plain",
        "Retry-After": "60",
      },
    });
  }

  const inflightSvg = inflightBadgeRenders.get(svgCacheKey);
  if (inflightSvg) {
    const shared = await inflightSvg;
    return new NextResponse(shared.svg, {
      status: shared.status,
      headers: shared.headers,
    });
  }

  const deferred = createDeferred<BadgeRenderResult>();
  inflightBadgeRenders.set(svgCacheKey, deferred.promise);

  const renderLockKey = buildBadgeRenderLockKey(handle, today);
  let gotRenderLock = false;

  // Try to get an auth token from session (better rate limits)
  const session = getOptionalRequestSession(request);
  const token = session?.token;

  try {
    gotRenderLock = await acquireBadgeRenderLock(renderLockKey);
    if (!gotRenderLock) {
      // PE-M2: lock-loser optimisation.
      //
      // In-memory inflight maps and the Redis render-lock are best-effort
      // same-instance optimisations only — they do not hold across serverless
      // function instances. The lock-loser path therefore has two tiers:
      //
      //   1. Stale SVG check (immediate) — if yesterday's badge is still in
      //      Redis (24h + up to 2h jitter TTL means it survives into the next
      //      day), return it right away instead of polling. This avoids ~1.85s
      //      of blocking for requests that arrive at today's cold-cache boundary.
      //
      //   2. Poll for today's SVG — shortened schedule for cases where no stale
      //      entry exists (brand-new handle, first badge ever).
      const yesterday = toDateString(new Date(Date.now() - 86_400_000));
      const staleCacheKey = buildBadgeSvgCacheKey(handle, yesterday);
      const staleSvg = await readBadgeSvgCache(staleCacheKey);
      if (staleSvg) {
        const sharedResult = {
          svg: staleSvg,
          headers: CACHE_HEADERS,
        } satisfies BadgeRenderResult;
        deferred.resolve(sharedResult);
        return new NextResponse(sharedResult.svg, { headers: sharedResult.headers });
      }

      const lockedSvg = await waitForBadgeSvgCache(svgCacheKey);
      if (lockedSvg) {
        const sharedResult = {
          svg: lockedSvg,
          headers: CACHE_HEADERS,
        } satisfies BadgeRenderResult;
        deferred.resolve(sharedResult);
        return new NextResponse(sharedResult.svg, { headers: sharedResult.headers });
      }
    }

    const materialized = await materializePublicProfile(handle, { token });
    if (!materialized) {
      const fallbackResult = {
        svg: fallbackSvg(handle, "Could not load data — try again later."),
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      } satisfies BadgeRenderResult;
      deferred.resolve(fallbackResult);
      return new NextResponse(fallbackResult.svg, { headers: fallbackResult.headers });
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
      // This SVG is always served to <img> embeds (README badges), where SMIL
      // <animate> never runs — animated heatmap cells would stay invisible. (#760)
      disableAnimation: true,
    });
    await writeBadgeSvgCache(svgCacheKey, svg, handle);
    const successResult = { svg, headers: CACHE_HEADERS } satisfies BadgeRenderResult;
    deferred.resolve(successResult);
    return new NextResponse(successResult.svg, { headers: successResult.headers });
  } catch (err) {
    const fallbackResult = {
      svg: fallbackSvg(handle, "Something went wrong — try again later."),
      status: 500,
      headers: { "Content-Type": "image/svg+xml" },
    } satisfies BadgeRenderResult;
    deferred.resolve(fallbackResult);

    fireAndForget(() => captureServerError({
      route: `/u/${handle}/badge.svg`,
      statusCode: 500,
      error: err,
    }));

    return new NextResponse(fallbackResult.svg, {
      status: fallbackResult.status,
      headers: fallbackResult.headers,
    });
  } finally {
    inflightBadgeRenders.delete(svgCacheKey);
    if (gotRenderLock) {
      fireAndForget(() => cacheDel(renderLockKey), () => undefined);
    }
  }
}
