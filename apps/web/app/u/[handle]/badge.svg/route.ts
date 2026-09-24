import { SCORING_POLICY } from "@chapa/shared";
import { type NextRequest, NextResponse, after } from "next/server";
import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { WARM_AMBER } from "@/lib/render/theme";
import { resolveBadgeConfigSnapshot } from "@/lib/render/badge-config";
import { getServerT } from "@/lib/i18n/server";
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from "@/lib/i18n/types";
import { resolveBadgeLocale } from "@/lib/render/badge-locale";
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
  readBadgeSvgCache,
  readBadgeSvgCacheWithStatus,
  writeBadgeSvgCache,
  isScoringImageReceiptCurrent,
  scoringResponseMaxAge,
  type ScoringImageReceiptIdentity,
} from "@/lib/render/badge-svg-cache";
import { badgeEdgeCacheTag, SCORING_IMAGES_EDGE_TAG } from "@/lib/cache/edge-cache";
import { getClientIp } from "@/lib/http/client-ip";
import { captureServerError, captureServerEvent } from "@/lib/analytics/server-errors";
import { toDateString } from "@/lib/utils/date";
import { withTimeout, TimeoutError } from "@/lib/async/with-timeout";
import {
  materializePublicProfile,
  runPublicProfileSideEffects,
  type PublicVerificationCode,
} from "@/lib/profile/public-profile";
import { resolveBadgeVerification } from "@/lib/profile/badge-verification";
import type { MaterializedProfile } from "@/lib/profile/materialize-profile";
import { readStoredBadgeProfile, storedBadgeRenderInputs } from "@/lib/profile/stored-badge-profile";
import { isGitHubUserNotFound, type GitHubUserNotFound } from "@/lib/github/not-found";
import {
  formatServerTiming,
  type ServerTimingEntry,
} from "@/lib/monitoring/latency-slo";
import { interpolate } from "@/lib/i18n/interpolate";
import { readScoringStatus, hasDrawableCurrentReceipt } from "@/lib/collection/read-scoring-status";
import { badgeStatusState, buildBadgeStatusStrings, buildBadgeUnavailableStrings, needsUnavailablePlaceholder, renderBadgeStatusSvg, type NonReadyScoringStatus } from "@/lib/render/badge-state";
import type { ScoringStatus } from "@/lib/collection/scoring-status";

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
const READ_ONLY_SMOKE_PARAM = "__chapa_smoke";
type BadgeRenderResult = {
  svg: string;
  headers: HeadersInit;
  status?: number;
  capturedAt?: number;
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

// #1191 hotfix (v2.29.2) — split client vs. edge cache policy. Vercel honours
// `Vercel-CDN-Cache-Control` over `Cache-Control` for its own edge and strips
// both `Vercel-*` headers before the response leaves the edge, so the edge
// policy below is invisible to the client. `Cache-Control` is what browsers
// and GitHub's image proxy (camo) actually see; previously it carried the
// same s-maxage the edge used, but Vercel strips s-maxage from Cache-Control
// before the client sees it, so those clients were caching heuristically with
// no real signal. `Vercel-Cache-Tag` is the per-handle tag
// `invalidateBadgeSvgCacheForHandle` (lib/render/badge-svg-cache.ts) purges
// from the edge — the layer a Redis delete alone never reached, which is why
// a Studio save could leave a stale badge on the README for up to a day.
function badgeCacheHeaders(handle: string, capturedAt: number, maxAge = 300) {
  const age = Math.min(maxAge, scoringResponseMaxAge(capturedAt));
  return {
    "Content-Type": "image/svg+xml",
    "X-Scoring-Selection": SCORING_POLICY,
    "Cache-Control": age > 0 ? `public, max-age=${age}` : "private, no-store, max-age=0",
    "Vercel-CDN-Cache-Control": age > 0 ? `public, s-maxage=${age}` : "no-store",
    "Vercel-Cache-Tag": `${badgeEdgeCacheTag(handle)},${SCORING_IMAGES_EDGE_TAG}`,
    "Content-Security-Policy": "frame-ancestors *",
    "X-Frame-Options": "ALLOWALL",
  };
}

// #1181 (UX-H3) — the badge is a public, cacheable, credential-less image
// endpoint (README <img> embeds carry no cookies), so locale is resolved
// purely from a `?lang=` query param rather than the cookie/Accept-Language
// chain `getServerLocale` uses for cookie-bearing page requests. No stored
// per-handle locale preference exists yet (would need a DB column — out of
// scope for this issue; see the PR/issue notes for the follow-up). Kept
// synchronous and side-effect-free so it can be called before any other work.
//
// Named distinctly from the imported `resolveBadgeLocale` (badge-locale.ts):
// this one extracts a `Locale` from a raw `NextRequest`; that one turns an
// already-resolved `Locale` into locale-consistent strings + cache keys. Any
// call site that needs BOTH content and a cache key for the SAME locale must
// go through `resolveBadgeLocale`, never resolve each independently (#1181
// follow-up — that mismatch is exactly the bug fixed in the share page and
// warm-cache cron).
function resolveLocaleFromRequest(request: NextRequest): Locale {
  const lang = request.nextUrl.searchParams.get("lang");
  return isSupportedLocale(lang) ? lang : DEFAULT_LOCALE;
}

/**
 * Stable, locale-independent reason a machine reader (the release probe,
 * monitoring) can key on without parsing localized copy. Passed separately
 * from the localized message key so a translation change can never change
 * what the probe checks.
 */
type BadgeFallbackReason = "invalid-handle" | "not-found" | "load-error" | "render-error";

function fallbackSvg(handle: string, message: string, tagline: string, reason: BadgeFallbackReason): string {
  const safe = escapeXml(handle);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" data-chapa-state="fallback" data-chapa-reason="${reason}">
  <rect width="1200" height="630" rx="16" fill="#0C0D14" stroke="${WARM_AMBER.tint(0.12)}" stroke-width="2"/>
  <text x="60" y="80" font-family="'JetBrains Mono', monospace" font-size="42" font-weight="700" fill="${WARM_AMBER.accent}">CHAPA</text>
  <text x="60" y="120" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="18" fill="#9AA4B2">${escapeXml(tagline)}</text>
  <text x="60" y="340" font-family="'JetBrains Mono', monospace" font-size="28" fill="#E6EDF3">@${safe}</text>
  <text x="60" y="400" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="16" fill="#9AA4B2">${escapeXml(message)}</text>
</svg>`;
}

/** Localized fallback SVG — resolves both the message and tagline for `locale`. */
function localizedFallbackSvg(handle: string, locale: Locale, messageKey: string, reason: BadgeFallbackReason): string {
  const t = getServerT(locale);
  return fallbackSvg(handle, t(messageKey) as string, t("badge.tagline") as string, reason);
}

/** The stored-badge fallback's heatmap disclosure, date-interpolated for
 * `locale`. Built once here rather than in `buildBadgeI18nStrings` (shared
 * with Studio's client-side preview, which never renders a degraded badge
 * and has no per-request date to interpolate). */
function storedBadgeActivityUnavailable(locale: Locale, observedAt: string): string {
  const t = getServerT(locale);
  return interpolate(t("badge.activityUnavailable") as string, {
    date: observedAt.slice(0, 10),
  });
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
/**
 * #1166 (PE-H2) — the shared SVG cache write itself, extracted so it can be
 * awaited inline (the background/warm path, which has no response to race)
 * or deferred into the route's after() block (the foreground winner path,
 * where nothing in the response depends on it). `readOnly` is re-checked
 * here (not just inferred from `avatarCachePolicy` staying "skip") so the
 * "never cache a readOnly/smoke render" invariant holds explicitly regardless
 * of which caller invokes this.
 */
async function persistFinalizedBadgeCache(
  handle: string,
  svg: string,
  options: {
    readOnly: boolean;
    svgCacheKey: string;
    verification: PublicVerificationCode | null;
    avatarCachePolicy: ReturnType<typeof getBadgeAvatarCachePolicy>;
    configCacheable: boolean;
    configRevision: number | null;
    receiptIdentity: ScoringImageReceiptIdentity | null;
  },
): Promise<void> {
  if (options.readOnly || !options.verification || !options.configCacheable) return;

  if (options.avatarCachePolicy === "short") {
    // #1088 — short-TTL placeholder write: populates the cache (so a
    // README embed with real traffic stops forcing a full
    // materialize+render on every request) without shadowing a later good
    // render — e.g. avatarUrl reappearing on a subsequent stats refetch —
    // for anywhere near the 24h+jitter a normal write gets. The shared
    // outcome policy distinguishes this from transient failure and timeout.
    await writeBadgeSvgCache(options.svgCacheKey, svg, handle, {
      ttlSeconds: AVATAR_ABSENT_CACHE_TTL_SECONDS,
      configRevision: options.configRevision, receiptIdentity: options.receiptIdentity,
    });
  } else if (options.avatarCachePolicy === "standard") {
    // Covers a real success or a definitive empty result such as 404.
    await writeBadgeSvgCache(options.svgCacheKey, svg, handle, { configRevision: options.configRevision, receiptIdentity: options.receiptIdentity });
  }
  // else: the avatar fetch timed out or failed transiently. Do not cache;
  // the next request gets a fresh attempt instead of a stale placeholder.
}

async function finalizeMaterializedBadge(
  handle: string,
  materialized: MaterializedProfile,
  options: {
    readOnly: boolean;
    svgCacheKey: string;
    /** #1181 — resolved once by the caller; used to build the `strings` bundle passed to `renderBadgeSvg`. */
    locale: Locale;
    /**
     * #1166 (PE-H2) — when true, skip the inline cache write below entirely;
     * the caller (the route's foreground winner path) will perform it inside
     * after() instead, since the write blocked the response for up to 500ms
     * with nothing in the response depending on its result. Must stay false
     * (the default) for `warmBadgeCacheInBackground` — that call has no
     * response to race, and cache warming is its entire purpose.
     */
    deferCacheWrite?: boolean;
  },
): Promise<{
  svg: string;
  verification: PublicVerificationCode | null;
  renderMs: number;
  avatarCachePolicy: ReturnType<typeof getBadgeAvatarCachePolicy>;
  configCacheable: boolean;
  configRevision: number | null;
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
  const verification = await resolveBadgeVerification(materialized);

  // #1191 — the owner's Studio configuration. Resolved on the RENDER path only;
  // the cache-hit path above must stay a single Redis read.
  const configSnapshot = await resolveBadgeConfigSnapshot(handle);

  const renderStart = Date.now();
  // #1335 phase 5 — reaching this render implies a drawable receipt already
  // passed the route's `needsUnavailablePlaceholder` gate above, so
  // `materialized.scoring` is guaranteed non-null here even though its type
  // stays optional (a handle whose receipt vanished mid-request would still
  // need the unavailable placeholder, not a crash).
  const svg = renderBadgeSvg(materialized.stats, {
    scoring: materialized.scoring!,
    avatarDataUri,
    config: configSnapshot.config,
    verificationHash: verification?.hash,
    verificationDate: verification?.date,
    // This SVG is always served to <img> embeds (README badges), where SMIL
    // <animate> never runs — animated heatmap cells would stay invisible. (#760)
    disableAnimation: true,
    // #1181 — resolved strings for `options.locale` via the shared
    // resolveBadgeLocale helper (never built ad hoc here); `renderBadgeSvg`
    // itself stays pure/sync and never resolves locale on its own.
    strings: resolveBadgeLocale(options.locale).stringsFor(materialized.scoring?.tier ?? null),
  });
  const renderMs = Date.now() - renderStart;

  // A missing verification record can be temporary when the first public
  // fetch is incomplete. Do not make that unverified render the terminal
  // 24-hour cache value; a later complete fetch must be able to heal it.
  // #1166 — when deferred, the caller performs this write itself inside
  // after() instead (foreground winner path only).
  // badge-source-outage-resilience (2026-09-22) — a phase-1 exact-bound
  // stale aggregate renders (real heatmap/stats data) but must never be
  // published as the normal 24h-cacheable badge: `materialized.scoring`'s
  // freshness threads through the underlying `statsFreshness` for a v6
  // model, or the receipt's own window/read-failure state for v7.2, so
  // requiring exactly `"current"` (not merely `!== "unavailable"`) is what
  // keeps a `"stale"` last-known-good render out of the normal SVG cache.
  const freshnessCacheable = materialized.scoring?.freshness === "current";

  if (!options.deferCacheWrite) {
    await persistFinalizedBadgeCache(handle, svg, {
      readOnly: options.readOnly,
      svgCacheKey: options.svgCacheKey,
      verification,
      avatarCachePolicy,
      configCacheable: configSnapshot.cacheable && freshnessCacheable,
      configRevision: configSnapshot.revision,
      receiptIdentity: materialized.scoring?.policyVersion === "v7.2" ? materialized.scoring.identity : null,
    });
  }

  return {
    svg,
    verification,
    renderMs,
    avatarCachePolicy,
    configCacheable: configSnapshot.cacheable && freshnessCacheable,
    configRevision: configSnapshot.revision,
  };
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
  materializePromise: Promise<MaterializedProfile | GitHubUserNotFound | null>,
  options: { readOnly: boolean; svgCacheKey: string; locale: Locale },
): Promise<void> {
  try {
    const materialized = await materializePromise;
    if (!materialized || isGitHubUserNotFound(materialized)) return;
    // #1166 (PE-H2) — `options` never sets `deferCacheWrite`, so this AWAITS
    // the SVG cache write inline (the default). This call has no response to
    // race — cache warming is its entire purpose — so the write must not be
    // deferred to a second after() the way the foreground winner path defers
    // its own write.
    await finalizeMaterializedBadge(handle, materialized, options);
    // #1335 phase 5 — `runPublicProfileSideEffects` no longer stores a
    // verification record (there is no more v6 HMAC store; the receipt is
    // attested at issuance, never on the render path), so it no longer takes
    // one either.
    await runPublicProfileSideEffects(handle, materialized, { readOnly: options.readOnly });
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
  // #1181 — resolved once, up front: synchronous and side-effect-free, so
  // resolving it before handle validation costs nothing.
  const locale = resolveLocaleFromRequest(request);

  // Validate handle before any cache/rate-limit work
  if (!isValidHandle(handle)) {
    const svg = localizedFallbackSvg(handle, locale, "badge.invalidHandle", "invalid-handle");
    return badgeSvgResponse(
      svg,
      { "Content-Type": "image/svg+xml", "Cache-Control": "private, no-store, max-age=0", "Vercel-CDN-Cache-Control": "no-store" },
      startedAt,
      [],
      400,
    );
  }

  // SVG full-response cache: serve warm-cache badge without any Redis rate-limit
  // overhead (#882 — rate limit moved to cache-MISS branch only).
  const readOnly = request.nextUrl.searchParams.get(READ_ONLY_SMOKE_PARAM) === "1";
  // #1335 phase 5 — there is one policy now (`SCORING_POLICY`); `capturedAt`
  // is captured once per request so every cache-header/key computation
  // below agrees.
  const capturedAt = Date.now();

  // #1335 phase 4/5 — a handle with no ready receipt renders its scoring
  // STATE (collecting/action_needed/unregistered) instead of an empty
  // materialize. A null status — the authority read failed — takes neither
  // branch below and the route continues exactly as it did before phase 4:
  // no new cache-header behavior is invented for a failed status read.
  //
  // #1335 phase 4 perf fix — `readScoringStatus` runs 3 DB reads (subject +
  // jobs + receipt). `hasDrawableCurrentReceipt` reuses the SAME single
  // receipt read the normal materialize pipeline already does, so a handle
  // with a drawable current receipt skips `readScoringStatus` entirely: the warm
  // cache-hit branch just below never pays for it, which is what put this
  // route's 800ms cache-hit SLO (lib/monitoring/latency-slo.ts) at risk. The
  // cache itself (exact receipt manifest in the key, forced before/after-
  // write checks) already fences a retraction without needing the status
  // read — see CLAUDE.md's "Caching rules".
  let scoringStatus: ScoringStatus | null = null;
  if (!(await hasDrawableCurrentReceipt(handle))) {
    try {
      scoringStatus = await readScoringStatus(handle);
    } catch (err) {
      scoringStatus = null;
      fireAndForget(() => captureServerError({
        route: `/u/${handle}/badge.svg`,
        statusCode: 500,
        error: err,
      }));
    }
  }
  const badgeState = scoringStatus ? badgeStatusState(scoringStatus) : null;
  if (badgeState && scoringStatus) {
    try {
      const t = getServerT(locale);
      const configSnapshot = await resolveBadgeConfigSnapshot(handle);
      const svg = renderBadgeStatusSvg(badgeState, {
        handle,
        percent: scoringStatus.kind === "collecting" ? scoringStatus.percent : undefined,
        config: configSnapshot.config,
        disableAnimation: true,
        strings: buildBadgeStatusStrings((key) => t(key) as string, scoringStatus as NonReadyScoringStatus, interpolate),
      });
      // Every non-ready state is sent no-store (phase-4 plan, "Surfaces"):
      // there is nothing to cache yet, and the state can change on the next
      // collection tick.
      return badgeSvgResponse(svg, {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "private, no-store, max-age=0",
        "Vercel-CDN-Cache-Control": "no-store",
      }, startedAt, []);
    } catch (err) {
      fireAndForget(() => captureServerError({
        route: `/u/${handle}/badge.svg`,
        statusCode: 500,
        error: err,
      }));
      // Fall through to the normal pipeline below rather than 500ing on a
      // legal handle — a rendering hiccup on the status placeholder is not
      // a reason to fail the whole request.
    }
  }

  const today = toDateString(new Date(capturedAt));
  // #1181 — locale is part of the shared SVG cache key so an es- and
  // en-rendered badge for the same handle/day never collide. Doubles cache
  // cardinality and invalidates every previously-warm key on deploy — a
  // one-off wave of cache-miss (materialize + render) responses against the
  // 4100ms `cacheMiss` SLO budget (`BADGE_LATENCY_SLO_MS.cacheMiss` in
  // lib/monitoring/latency-slo.ts) until the new es/en keys re-warm.
  const svgCacheKey = resolveBadgeLocale(locale).cacheKey(handle, today);
  const cacheReadStart = Date.now();
  const primaryCacheRead = await readBadgeSvgCacheWithStatus(svgCacheKey);
  if (primaryCacheRead.svg) {
    return badgeSvgResponse(primaryCacheRead.svg, badgeCacheHeaders(handle, capturedAt), startedAt, [
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
        "Cache-Control": "private, no-store, max-age=0",
        "Vercel-CDN-Cache-Control": "no-store",
      },
    });
  }

  // #1166 (BE-M1) — `readOnly` (the public `__chapa_smoke=1` probe) must be
  // part of the IN-MEMORY coalescing key ONLY. A readOnly render skips the
  // avatar entirely and can be a fallback/degraded SVG on a cold handle —
  // handing it to a concurrent real visitor (or vice versa) would be wrong.
  // This must NOT touch `svgCacheKey` (the shared Redis SVG slot the share
  // page also reads) or `renderLockKey` (derived from it below) — those stay
  // identical for readOnly and normal requests, or a smoke probe would take
  // an independent lock and double GitHub fetches at date rollover.
  const coalesceKey = readOnly ? `${svgCacheKey}:ro` : svgCacheKey;

  const inflightSvg = inflightBadgeRenders.get(coalesceKey);
  if (inflightSvg) {
    const shared = await inflightSvg;
    return badgeSvgResponse(
      shared.svg,
      { ...shared.headers, ...badgeCacheHeaders(handle, capturedAt, Math.min(scoringResponseMaxAge(shared.capturedAt ?? capturedAt), Number(new Headers(shared.headers).get("Cache-Control")?.match(/max-age=(\d+)/)?.[1] ?? 0))) },
      startedAt,
      [...cacheTimeoutMetric, { name: "coalesced", durMs: Date.now() - startedAt }],
      shared.status,
    );
  }

  const deferred = createDeferred<BadgeRenderResult>();
  inflightBadgeRenders.set(coalesceKey, deferred.promise);

  const renderLockKey = resolveBadgeLocale(locale).renderLockKey(handle, today);
  let gotRenderLock = false;

  // Try to get an auth token from session (better rate limits)
  const session = getOptionalRequestSession(request);
  const token = session?.token;

  try {
    gotRenderLock = await acquireBadgeRenderLock(renderLockKey);
    const yesterday = toDateString(new Date(Date.now() - 86_400_000));
    const staleCacheKey = resolveBadgeLocale(locale).cacheKey(handle, yesterday);
    // Raw SVGs cannot re-evaluate annual eligibility or mark expired Craft
    // report state, which can flip at UTC midnight without a new receipt
    // write — so yesterday's bytes are never an instant-serve shortcut under
    // v7.2. This was already false for v7.2 before #1335 phase 5 (it was
    // gated to the retired v6 selection); the branches below it are now
    // permanently inert and are left in place rather than removed under this
    // change, since this is a latency-critical hot path (#974, #1029,
    // #1086) — a follow-up should delete the dead branches deliberately,
    // with its own latency verification, rather than as a side effect of
    // this refactor.
    const canUseYesterday = false;
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
      const staleSvg = canUseYesterday ? await readBadgeSvgCache(staleCacheKey) : null;
      if (staleSvg) {
        const sharedResult = {
          svg: staleSvg,
          headers: badgeCacheHeaders(handle, capturedAt),
          capturedAt,
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
          headers: badgeCacheHeaders(handle, capturedAt),
          capturedAt,
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
      staleSvgLookup = canUseYesterday ? readBadgeSvgCache(staleCacheKey) : null;
    }

    const materializeStart = Date.now();
    const materializePromise = materializePublicProfile(handle, {
      token,
      readOnly,
    });
    const staleSvgForDeadlineFallback = staleSvgLookup ? await staleSvgLookup : null;
    let materialized: MaterializedProfile | GitHubUserNotFound | null;

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
          // A degraded response — short-lived so a real render (from the
          // background continuation below, or a subsequent request) replaces
          // it quickly rather than being treated as a normal 24h-cacheable
          // badge.
          headers: badgeCacheHeaders(
            handle,
            capturedAt,
            60,
          ),
          capturedAt,
        } satisfies BadgeRenderResult;
        deferred.resolve(sharedResult);

        // Let the original materialize call keep running so the NEXT request
        // for this handle is warm, instead of abandoning it. This mirrors the
        // foreground success path's own after()-deferred side effects.
        after(() =>
          warmBadgeCacheInBackground(handle, materializePromise, { readOnly, svgCacheKey, locale }),
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
    if (isGitHubUserNotFound(materialized)) {
      // LE-8-2 — GitHub answered that nobody owns this handle. Nothing has
      // streamed yet, so this route can say so with the status. Short edge
      // TTL under the handle's own purge tag: camo retries stay off the
      // origin, and a handle claimed later is not pinned to a 404. The
      // `null` branch below is untouched — an outage keeps the 200 fallback.
      const notFoundResult = {
        svg: localizedFallbackSvg(handle, locale, "badge.userNotFound", "not-found"),
        status: 404,
        headers: badgeCacheHeaders(
          handle,
          capturedAt,
          60,
        ),
        capturedAt,
      } satisfies BadgeRenderResult;
      deferred.resolve(notFoundResult);
      return badgeSvgResponse(
        notFoundResult.svg,
        notFoundResult.headers,
        startedAt,
        [...cacheTimeoutMetric, { name: "materialize", desc: "not-found", durMs: materializeMs }],
        notFoundResult.status,
      );
    }
    if (!materialized) {
      // badge-source-outage-resilience (2026-09-22) — live materialization
      // failed (a linked-source refresh outage, a GitHub rejection, etc.),
      // but a durable last committed receipt/snapshot may still exist. A
      // stored fallback is a distinct, non-`MaterializedProfile` projection
      // (`lib/profile/stored-badge-profile.ts`): it is never cached as the
      // normal daily SVG, never verified, and never runs the normal profile
      // side effects (snapshot persist, verification mint) — those all
      // require a real live `MaterializedProfile`.
      const stored = await readStoredBadgeProfile(handle);
      if (stored) {
        const { stats, countsAvailable } = storedBadgeRenderInputs(stored);
        const configSnapshot = await resolveBadgeConfigSnapshot(handle);
        const renderStart = Date.now();
        const svg = renderBadgeSvg(stats, {
          scoring: stored.scoring,
          config: configSnapshot.config,
          disableAnimation: true,
          degraded: {
            reason: "live_sources_unavailable",
            observedAt: stored.observedAt,
            activityAvailable: false,
            countsAvailable,
          },
          strings: {
            ...resolveBadgeLocale(locale).stringsFor(stored.scoring.tier ?? null),
            activityUnavailable: storedBadgeActivityUnavailable(locale, stored.observedAt),
          },
        });
        const renderMs = Date.now() - renderStart;

        // Bounded telemetry: fallback kind + date only. No credential,
        // provider body, token or refresh-claim ID reaches this event.
        fireAndForget(() =>
          captureServerEvent("badge_stored_fallback", {
            policyVersion: stored.scoring.policyVersion,
            observedDate: stored.observedAt.slice(0, 10),
          }),
        );

        const storedResult = {
          svg,
          // Short-lived and never the normal daily SVG cache: a real live
          // render (this request's retry, or the next one) must replace it
          // quickly rather than being shadowed for a normal 24h TTL.
          headers: badgeCacheHeaders(handle, capturedAt, 60),
          capturedAt,
        } satisfies BadgeRenderResult;
        deferred.resolve(storedResult);
        return badgeSvgResponse(storedResult.svg, storedResult.headers, startedAt, [
          ...cacheTimeoutMetric,
          { name: "materialize", desc: "stored-fallback", durMs: materializeMs },
          { name: "render", durMs: renderMs },
        ]);
      }

      const fallbackResult = {
        svg: localizedFallbackSvg(handle, locale, "badge.loadError", "load-error"),
        headers: badgeCacheHeaders(
          handle,
          capturedAt,
          60,
        ),
        capturedAt,
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

    // #1335 phase 4 fix — `scoringStatus === null` means the
    // `readScoringStatus` authority read itself failed under v7.2 (not "no
    // receipt found"; that is its own real `ScoringStatus`). The plan's
    // invariant is "failed authority reads are unavailable": this must never
    // silently fall through to a legacy v6 render just because the normal
    // materialize pipeline's OWN independent receipt lookup also came up
    // without a v7.2 receipt. A handle WITH a drawable receipt (found
    // independently right here) still renders it normally below — this
    // reuses the exact same status-placeholder path as `collecting`/
    // `action_needed`/`unregistered` rather than inventing a second one.
    if (needsUnavailablePlaceholder(scoringStatus, profile.scoring?.policyVersion)) {
      try {
        const t = getServerT(locale);
        const svg = renderBadgeStatusSvg("unavailable", {
          handle,
          disableAnimation: true,
          strings: buildBadgeUnavailableStrings((key) => t(key) as string),
        });
        const unavailableResult = {
          svg,
          headers: {
            "Content-Type": "image/svg+xml",
            "Cache-Control": "private, no-store, max-age=0",
            "Vercel-CDN-Cache-Control": "no-store",
          },
          capturedAt,
        } satisfies BadgeRenderResult;
        deferred.resolve(unavailableResult);
        return badgeSvgResponse(unavailableResult.svg, unavailableResult.headers, startedAt, [
          ...cacheTimeoutMetric,
          { name: "materialize", durMs: materializeMs },
        ]);
      } catch (err) {
        fireAndForget(() => captureServerError({
          route: `/u/${handle}/badge.svg`,
          statusCode: 500,
          error: err,
        }));
        // Fall through to the normal render below rather than 500 on a
        // legal handle over a rendering hiccup on the unavailable placeholder.
      }
    }

    const { svg, verification, renderMs, avatarCachePolicy, configCacheable, configRevision } = await finalizeMaterializedBadge(
      handle,
      profile,
      // #1166 (PE-H2) — the SVG cache write blocked the response for up to
      // 500ms (its own deadline) with nothing in the response depending on
      // it. Defer it into after(), same as the durable side effects below.
      { readOnly, svgCacheKey, locale, deferCacheWrite: true },
    );

    // #1013 — the snapshot persist is a durable Supabase write with nothing
    // in the response depending on its result; it must not block (or, on
    // failure, retroactively invalidate) an otherwise-successful render. Both
    // it, the already-deferred cache work, and (#1166) the shared SVG cache
    // write now run in after(). LE-6-1 — `verification` is the code rendered
    // into `svg` above; `runPublicProfileSideEffects` stores its record on
    // every render, not only the first of the day, so the hash the strip
    // links to always resolves.
    after(() => {
      return persistFinalizedBadgeCache(handle, svg, {
        readOnly,
        svgCacheKey,
        verification,
        avatarCachePolicy,
        configCacheable,
        configRevision,
        receiptIdentity: profile.scoring?.policyVersion === "v7.2" ? profile.scoring.identity : null,
      })
        .then(() => runPublicProfileSideEffects(handle, profile, { readOnly }))
        .catch((err) => {
          fireAndForget(() => captureServerError({
            route: `/u/${handle}/badge.svg`,
            statusCode: 500,
            error: err,
          }));
        });
    });

    // Unknown styling can still render, but must never become the shared badge.
    const latestConfig = await resolveBadgeConfigSnapshot(handle);
    const configUnchanged = latestConfig.cacheable && latestConfig.revision === configRevision;
    const receiptUnchanged = await isScoringImageReceiptCurrent(handle, profile.scoring?.policyVersion === "v7.2" ? profile.scoring.identity : null);
    const successResult = {
      svg,
      headers: configCacheable && configUnchanged && receiptUnchanged
        ? badgeCacheHeaders(handle, capturedAt)
        : badgeCacheHeaders(handle, capturedAt, 0),
      capturedAt,
    } satisfies BadgeRenderResult;
    deferred.resolve(successResult);
    return badgeSvgResponse(successResult.svg, successResult.headers, startedAt, [
      ...cacheTimeoutMetric,
      { name: "materialize", durMs: materializeMs },
      { name: "render", durMs: renderMs },
    ]);
  } catch (err) {
    const fallbackResult = {
      svg: localizedFallbackSvg(handle, locale, "badge.renderError", "render-error"),
      status: 500,
      headers: badgeCacheHeaders(handle, capturedAt, 0),
      capturedAt,
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
    inflightBadgeRenders.delete(coalesceKey);
    if (gotRenderLock) {
      fireAndForget(() => cacheDel(renderLockKey), () => undefined);
    }
  }
}
