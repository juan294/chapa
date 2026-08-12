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
  buildBadgeSvgRenderLockKey,
  readBadgeSvgCache,
  readBadgeSvgCacheWithStatus,
  writeBadgeSvgCache,
} from "@/lib/render/badge-svg-cache";
import { getClientIp } from "@/lib/http/client-ip";
import { captureServerError } from "@/lib/analytics/server-errors";
import { toDateString } from "@/lib/utils/date";
import { withTimeout } from "@/lib/async/with-timeout";
import {
  getPublicProfileVerification,
  deferProfileCacheWork,
  materializePublicProfile,
  persistProfileSnapshot,
} from "@/lib/profile/public-profile";
import {
  formatServerTiming,
  type ServerTimingEntry,
} from "@/lib/monitoring/latency-slo";

export const maxDuration = 35;

const BADGE_RENDER_LOCK_TTL_SECONDS = 30;
const BADGE_CACHE_DEADLINE_MS = 250;
const BADGE_RATE_LIMIT_DEADLINE_MS = 150;
// #1029 — previously summed to 2000ms. A render-lock loser with no stale SVG
// to fall back on polls this full schedule before falling through to a full
// materialize+render of its own; the old total risked exceeding the 3000ms
// cache-miss SLO budget in the worst case (poll timeout + full render). The
// schedule is truncated (not re-paced) to ~950ms so the common case — the
// winner finishes within the first few short ticks — is unaffected, while the
// worst case now leaves comfortable margin under the budget.
const BADGE_RENDER_WAIT_SCHEDULE_MS = [50, 75, 100, 125, 150, 200, 250];
// #1029 (PE-L1) — soft deadline for the avatar fetch race, mirroring the
// share page's pattern (#800). The underlying fetch in lib/render/avatar.ts
// still has its own longer internal abort (2000ms) so a fast-but-not-instant
// CDN response can still populate the Redis avatar cache in the background
// for the next request — this deadline only bounds how long THIS response
// waits before rendering the placeholder instead.
const AVATAR_RACE_DEADLINE_MS = 1000;
const READ_ONLY_SMOKE_PARAM = "__chapa_smoke";
type BadgeRenderResult = {
  svg: string;
  headers: HeadersInit;
  status?: number;
};

// NOTE: This Map only coalesces concurrent renders within a single serverless
// function instance. On Vercel each invocation gets its own V8 isolate, so the
// Map is empty at the start of every cold-start and provides no cross-instance
// dedup benefit. Cross-instance coalescing is handled by the Redis render-lock
// (acquireBadgeRenderLock) and the stale-SVG / poll-for-today branches below.
// The in-memory Map still provides a meaningful win during local development
// and in long-lived (warm) serverless instances where two requests arrive for
// the same handle in the same JS event-loop cycle.
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

// #974: emit a Server-Timing header on every badge response so per-request
// latency (and its cache/materialize/render breakdown) is inspectable, and so
// the /api/cron/latency-check synthetic monitor can classify cache-hit vs
// cache-miss responses when measuring the route against its p95 SLO budgets.
function badgeSvgResponse(
  svg: string,
  baseHeaders: HeadersInit,
  startedAt: number,
  metrics: ServerTimingEntry[] = [],
  status?: number,
): NextResponse {
  const serverTiming = formatServerTiming([
    ...metrics,
    { name: "total", durMs: Date.now() - startedAt },
  ]);
  return new NextResponse(svg, {
    status,
    headers: {
      ...(baseHeaders as Record<string, string>),
      "Server-Timing": serverTiming,
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  const startedAt = Date.now();
  const { handle } = await params;

  // Validate handle before any cache/rate-limit work
  if (!isValidHandle(handle)) {
    const svg = fallbackSvg(handle, "Invalid GitHub handle.");
    return badgeSvgResponse(
      svg,
      { "Content-Type": "image/svg+xml" },
      startedAt,
      [],
      400,
    );
  }

  // SVG full-response cache: serve warm-cache badge without any Redis rate-limit
  // overhead (#882 — rate limit moved to cache-MISS branch only).
  const readOnly = request.nextUrl.searchParams.get(READ_ONLY_SMOKE_PARAM) === "1";
  const today = toDateString(new Date());
  const svgCacheKey = buildBadgeSvgCacheKey(handle, today);
  const cacheReadStart = Date.now();
  const primaryCacheRead = await readBadgeSvgCacheWithStatus(svgCacheKey);
  if (primaryCacheRead.svg) {
    return badgeSvgResponse(primaryCacheRead.svg, CACHE_HEADERS, startedAt, [
      { name: "cache", desc: "hit", durMs: Date.now() - cacheReadStart },
    ]);
  }
  // #1014 — a read that exceeded the deadline is NOT a genuine miss: the
  // underlying Redis read may still complete after we gave up waiting on it.
  // Surface this distinctly (rather than silently falling through as if it
  // were a normal miss) so the failure mode is observable in production.
  const cacheTimeoutMetric: ServerTimingEntry[] = primaryCacheRead.timedOut
    ? [{ name: "cache-timeout", durMs: Date.now() - cacheReadStart }]
    : [];

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
    return badgeSvgResponse(
      shared.svg,
      shared.headers,
      startedAt,
      [...cacheTimeoutMetric, { name: "coalesced", durMs: Date.now() - startedAt }],
      shared.status,
    );
  }

  const deferred = createDeferred<BadgeRenderResult>();
  inflightBadgeRenders.set(svgCacheKey, deferred.promise);

  const renderLockKey = buildBadgeSvgRenderLockKey(handle, today);
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
        return badgeSvgResponse(sharedResult.svg, sharedResult.headers, startedAt, [
          ...cacheTimeoutMetric,
          { name: "cache", desc: "stale", durMs: Date.now() - startedAt },
        ]);
      }

      const lockedSvg = await waitForBadgeSvgCache(svgCacheKey);
      if (lockedSvg) {
        const sharedResult = {
          svg: lockedSvg,
          headers: CACHE_HEADERS,
        } satisfies BadgeRenderResult;
        deferred.resolve(sharedResult);
        return badgeSvgResponse(sharedResult.svg, sharedResult.headers, startedAt, [
          ...cacheTimeoutMetric,
          { name: "cache", desc: "poll", durMs: Date.now() - startedAt },
        ]);
      }
    }

    const materializeStart = Date.now();
    const materialized = await materializePublicProfile(handle, {
      token,
      readOnly,
    });
    const materializeMs = Date.now() - materializeStart;
    if (!materialized) {
      const fallbackResult = {
        svg: fallbackSvg(handle, "Could not load data — try again later."),
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      } satisfies BadgeRenderResult;
      deferred.resolve(fallbackResult);
      return badgeSvgResponse(fallbackResult.svg, fallbackResult.headers, startedAt, [
        ...cacheTimeoutMetric,
        { name: "materialize", durMs: materializeMs },
      ]);
    }

    // #1029 (PE-L1) — race the avatar fetch against a tight deadline instead
    // of awaiting it in full, mirroring the share page's pattern (#800). A
    // slow CDN response renders with the placeholder rather than consuming
    // most of the cache-miss latency budget. `avatarResolved` gates the SVG
    // cache write below: a timed-out/failed fetch must NOT poison the shared
    // cache with the placeholder for up to 24h — the next request gets a
    // fresh chance to fetch (and cache) the real avatar.
    let avatarDataUri: string | undefined;
    let avatarResolved = false;
    if (!readOnly) {
      const avatarPromise = materialized.stats.avatarUrl
        ? getAvatarBase64(handle, materialized.stats.avatarUrl).catch(() => undefined)
        : Promise.resolve(undefined);
      avatarDataUri = await Promise.race([
        avatarPromise,
        new Promise<undefined>((resolve) =>
          setTimeout(() => resolve(undefined), AVATAR_RACE_DEADLINE_MS),
        ),
      ]);
      avatarResolved = avatarDataUri !== undefined;
    }
    const verification = getPublicProfileVerification(materialized);

    // #1013 — persistProfileSnapshot is a durable Supabase write with nothing
    // in the response depending on its result; it must not block (or, on
    // failure, retroactively invalidate) an otherwise-successful render. Both
    // it and the already-deferred cache work now run in after().
    after(() => {
      return persistProfileSnapshot(handle, materialized, { readOnly })
        .then((shouldRunDeferred) => {
          if (!shouldRunDeferred) return;
          return deferProfileCacheWork(handle, materialized, { verification, readOnly });
        })
        .catch((err) => {
          fireAndForget(() => captureServerError({
            route: `/u/${handle}/badge.svg`,
            statusCode: 500,
            error: err,
          }));
        });
    });

    const renderStart = Date.now();
    const svg = renderBadgeSvg(materialized.stats, materialized.displayImpact, {
      avatarDataUri,
      verificationHash: verification?.hash,
      verificationDate: verification?.date,
      // This SVG is always served to <img> embeds (README badges), where SMIL
      // <animate> never runs — animated heatmap cells would stay invisible. (#760)
      disableAnimation: true,
    });
    const renderMs = Date.now() - renderStart;
    // A missing verification record can be temporary when the first public
    // fetch is incomplete. Do not make that unverified render the terminal
    // 24-hour cache value; a later complete fetch must be able to heal it.
    if (!readOnly && avatarResolved && verification) {
      await writeBadgeSvgCache(svgCacheKey, svg, handle);
    }
    const successResult = { svg, headers: CACHE_HEADERS } satisfies BadgeRenderResult;
    deferred.resolve(successResult);
    return badgeSvgResponse(successResult.svg, successResult.headers, startedAt, [
      ...cacheTimeoutMetric,
      { name: "materialize", durMs: materializeMs },
      { name: "render", durMs: renderMs },
    ]);
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

    return badgeSvgResponse(
      fallbackResult.svg,
      fallbackResult.headers,
      startedAt,
      cacheTimeoutMetric,
      fallbackResult.status,
    );
  } finally {
    inflightBadgeRenders.delete(svgCacheKey);
    if (gotRenderLock) {
      fireAndForget(() => cacheDel(renderLockKey), () => undefined);
    }
  }
}
