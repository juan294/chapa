import { type NextRequest, NextResponse, after } from "next/server";
import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import {
  getBadgeAvatarCachePolicy,
  getBadgeAvatarDataUri,
  resolveBadgeAvatar,
} from "@/lib/render/avatar-outcome";
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
  AVATAR_ABSENT_CACHE_TTL_SECONDS,
  buildBadgeSvgCacheKey,
  buildBadgeSvgRenderLockKey,
  readBadgeSvgCache,
  readBadgeSvgCacheWithStatus,
  writeBadgeSvgCache,
} from "@/lib/render/badge-svg-cache";
import { getClientIp } from "@/lib/http/client-ip";
import { captureServerError } from "@/lib/analytics/server-errors";
import { toDateString } from "@/lib/utils/date";
import { withTimeout, TimeoutError } from "@/lib/async/with-timeout";
import {
  getPublicProfileVerification,
  deferProfileCacheWork,
  materializePublicProfile,
  persistProfileSnapshot,
  type PublicVerificationCode,
} from "@/lib/profile/public-profile";
import type { MaterializedProfile } from "@/lib/profile/materialize-profile";
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
// #1086 (PE-H1) — no individual step on the cache-miss materialize path had an
// end-to-end deadline: getStats' own inflight cap (30s) plus the GitHub fetch
// (15s) plus a linked-platform fetch (8s) plus this route's own cache/lock/
// avatar ceilings summed to ~34s against a declared 3000ms cache-miss SLO
// budget — the only real ceiling was the platform's `maxDuration = 35`. This
// deadline bounds the wait for `materializePublicProfile` to roughly that
// budget. It is only ever raced when a stale (yesterday's) SVG is available to
// fall back on (see the `staleSvgForDeadlineFallback` read below) — a
// brand-new handle with no stale key falls through to a plain, unbounded
// await so a legitimate cold GitHub fetch is never cut off artificially.
const BADGE_MATERIALIZE_DEADLINE_MS = 2200;
// A degraded response — short-lived so a real render (from the background
// continuation below, or a subsequent request) replaces it quickly rather
// than being treated as a normal 24h-cacheable badge.
const DEADLINE_FALLBACK_HEADERS = {
  "Content-Type": "image/svg+xml",
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};
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

/**
 * Shared post-materialize pipeline: avatar fetch (raced against its own
 * deadline), verification, SVG render, and — when eligible — the shared SVG
 * cache write. Used both by the normal foreground path and by the PE-H1
 * background continuation below, so a deadline-fallback response's eventual
 * real render warms the cache identically to a non-degraded request.
 */
async function finalizeMaterializedBadge(
  handle: string,
  materialized: MaterializedProfile,
  options: { readOnly: boolean; svgCacheKey: string },
): Promise<{
  svg: string;
  verification: PublicVerificationCode | null;
  renderMs: number;
}> {
  // #1080/#1088 — the avatar step has distinct outcomes, previously
  // conflated into one `avatarResolved` boolean (`avatarDataUri !==
  // undefined`) that gated the shared SVG cache write shut for all of them
  // except a clean success:
  //   1. succeeded — got real avatar data. Cache normally (full TTL).
  //   2. definitively absent (e.g. a 404) — the real promise settled with
  //      undefined. Cache normally because a retry is not expected to heal it.
  //   3. permanently absent — `stats.avatarUrl` was never set. PERMANENT
  //      until the next stats refetch, never a genuine in-flight race loss.
  //      Cache with a short TTL so a later good render (avatarUrl
  //      reappearing) isn't shadowed for the full 24h+jitter.
  //   4. transient failure or timeout — do not cache, so the next request gets
  //      a fresh attempt instead of a stale placeholder.
  let avatarDataUri: string | undefined;
  let avatarCachePolicy: ReturnType<typeof getBadgeAvatarCachePolicy> = "skip";
  if (!options.readOnly) {
    const avatarOutcome = await resolveBadgeAvatar(
      handle,
      materialized.stats.avatarUrl,
      {
        deadlineMs: AVATAR_RACE_DEADLINE_MS,
      },
    );
    avatarDataUri = getBadgeAvatarDataUri(avatarOutcome);
    avatarCachePolicy = getBadgeAvatarCachePolicy(avatarOutcome);
  }
  const verification = getPublicProfileVerification(materialized);

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
  if (!options.readOnly && verification) {
    if (avatarCachePolicy === "short") {
      // #1088 — short-TTL placeholder write: populates the cache (so a
      // README embed with real traffic stops forcing a full
      // materialize+render on every request) without shadowing a later good
      // render — e.g. avatarUrl reappearing on a subsequent stats refetch —
      // for anywhere near the 24h+jitter a normal write gets. Checked before
      // `avatarFetchTimedOut` since a permanently-absent avatar is never
      // actually raced against the deadline (it resolves immediately).
      await writeBadgeSvgCache(options.svgCacheKey, svg, handle, {
        ttlSeconds: AVATAR_ABSENT_CACHE_TTL_SECONDS,
      });
    } else if (avatarCachePolicy === "standard") {
      // Covers a real success or a definitive empty result such as 404.
      await writeBadgeSvgCache(options.svgCacheKey, svg, handle);
    }
    // else: the avatar fetch timed out or failed transiently. Do not cache;
    // the next request gets a fresh attempt instead of a stale placeholder.
  }

  return { svg, verification, renderMs };
}

/**
 * The same durable side-effect sequence the foreground path runs inside
 * `after()` on a successful materialize — extracted so the PE-H1 background
 * continuation (deadline-fallback path) can run it identically once its own
 * materialize call finishes, warming the cache for the next request.
 *
 * NOTE: this intentionally mirrors the route's own pre-existing inline
 * sequence rather than calling `runPublicProfileSideEffects` from
 * `lib/profile/public-profile.ts`. That function skips deferred cache work
 * only on the dedup case (`!persisted && statsComplete`), so it still runs
 * telemetry for an incomplete-stats view; this route has always skipped
 * deferred work on any `!persisted`, incomplete stats included. Reconciling
 * that behavioral difference is a separate, pre-existing concern outside the
 * scope of this change — not introduced by it.
 */
async function runBadgeSideEffects(
  handle: string,
  materialized: MaterializedProfile,
  options: { readOnly: boolean; verification: PublicVerificationCode | null },
): Promise<void> {
  const shouldRunDeferred = await persistProfileSnapshot(handle, materialized, {
    readOnly: options.readOnly,
  });
  if (!shouldRunDeferred) return;
  await deferProfileCacheWork(handle, materialized, {
    verification: options.verification,
    readOnly: options.readOnly,
  });
}

/**
 * #1086 (PE-H1) background continuation for the deadline-fallback path: lets
 * the original `materializePublicProfile` call keep running after a
 * degraded stale-SVG response has already been sent, so the cache is warm
 * for the NEXT request instead of abandoning the in-flight work.
 *
 * Deliberately a standalone top-level function (rather than an inline
 * closure in `GET`) so it only captures its own parameters — an inline
 * closure would keep `GET`'s entire activation record (including unrelated
 * locals like `request`, `deferred`, `cacheTimeoutMetric`) reachable for as
 * long as this callback is pending, which can be most of materialize's own
 * ~30s inflight ceiling.
 */
async function warmBadgeCacheInBackground(
  handle: string,
  materializePromise: Promise<MaterializedProfile | null>,
  options: { readOnly: boolean; svgCacheKey: string },
): Promise<void> {
  try {
    const materialized = await materializePromise;
    if (!materialized) return;
    const { verification } = await finalizeMaterializedBadge(handle, materialized, options);
    await runBadgeSideEffects(handle, materialized, { readOnly: options.readOnly, verification });
  } catch (err) {
    fireAndForget(() => captureServerError({
      route: `/u/${handle}/badge.svg`,
      statusCode: 500,
      error: err,
    }));
  }
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
    const yesterday = toDateString(new Date(Date.now() - 86_400_000));
    const staleCacheKey = buildBadgeSvgCacheKey(handle, yesterday);
    // #1086 (PE-H1) — kicked off (not awaited) below, alongside materialize,
    // rather than awaited up front: this Redis read is independent of
    // materialize, so starting it in parallel keeps it off materialize's own
    // (much slower) hot-path latency instead of adding a round-trip in front
    // of it. Only set up on the winner path when a stale fallback might exist
    // — the loser branch below already performs its own stale-cache read as
    // its first tier and returns early on a hit.
    let staleSvgLookup: Promise<string | null> | null = null;

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
      // Falls through with no stale SVG (checked above, or it would have
      // returned already) — `staleSvgLookup` stays null.
    } else if (!readOnly) {
      // Winner path — kick off the stale-cache read now (not awaited), so it
      // runs concurrently with materialize below instead of in front of it.
      staleSvgLookup = readBadgeSvgCache(staleCacheKey);
    }

    const materializeStart = Date.now();
    const materializePromise = materializePublicProfile(handle, {
      token,
      readOnly,
    });
    const staleSvgForDeadlineFallback = staleSvgLookup ? await staleSvgLookup : null;
    let materialized: MaterializedProfile | null;

    if (staleSvgForDeadlineFallback) {
      // #1086 (PE-H1) — bound the wait for materialize to roughly the SLO
      // budget instead of letting it run unbounded (up to getStats' own 30s
      // inflight cap). This is only ever set up when a stale SVG exists to
      // serve on expiry (see `staleSvgLookup` above) — a brand-new handle
      // with nothing to fall back on skips this branch entirely and awaits
      // `materializePromise` directly below, preserving the existing (much
      // longer) timeouts as its only ceiling. `materializePromise` itself is
      // never cancelled — on a timeout it keeps running for the after()
      // background continuation below to pick up.
      try {
        materialized = await withTimeout(
          materializePromise,
          BADGE_MATERIALIZE_DEADLINE_MS,
          "badge materialize",
        );
      } catch (err) {
        if (!(err instanceof TimeoutError)) throw err;

        const sharedResult = {
          svg: staleSvgForDeadlineFallback,
          headers: DEADLINE_FALLBACK_HEADERS,
        } satisfies BadgeRenderResult;
        deferred.resolve(sharedResult);

        // Let the original materialize call keep running so the NEXT request
        // for this handle is warm, instead of abandoning it. This mirrors the
        // foreground success path's own after()-deferred side effects.
        after(() =>
          warmBadgeCacheInBackground(handle, materializePromise, { readOnly, svgCacheKey }),
        );

        return badgeSvgResponse(sharedResult.svg, sharedResult.headers, startedAt, [
          ...cacheTimeoutMetric,
          {
            name: "materialize",
            desc: "deadline-fallback",
            durMs: Date.now() - materializeStart,
          },
        ]);
      }
    } else {
      materialized = await materializePromise;
    }

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

    // Re-bind to a `const` now that `materialized` is known non-null — `let`
    // narrowing does not persist into the `after()` closure below.
    const profile = materialized;
    const { svg, verification, renderMs } = await finalizeMaterializedBadge(
      handle,
      profile,
      { readOnly, svgCacheKey },
    );

    // #1013 — persistProfileSnapshot is a durable Supabase write with nothing
    // in the response depending on its result; it must not block (or, on
    // failure, retroactively invalidate) an otherwise-successful render. Both
    // it and the already-deferred cache work now run in after().
    after(() => {
      return runBadgeSideEffects(handle, profile, { readOnly, verification }).catch(
        (err) => {
          fireAndForget(() => captureServerError({
            route: `/u/${handle}/badge.svg`,
            statusCode: 500,
            error: err,
          }));
        },
      );
    });

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
