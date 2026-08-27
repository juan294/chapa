import { Suspense } from "react";
import { after } from "next/server";
import { headers } from "next/headers";
import { BadgeToolbar } from "@/components/BadgeToolbar";
import { isValidHandle } from "@/lib/validation";
import { NavbarClient } from "@/components/NavbarClient";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SharePageShortcuts } from "@/components/SharePageShortcuts";
import { SharePageOwnerContentLazy } from "@/components/SharePageOwnerContentLazy";
import { getBaseUrl } from "@/lib/env";
import { renderJsonLd } from "@/lib/jsonld";
import { toDateString } from "@/lib/utils/date";
import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import {
  AVATAR_ABSENT_CACHE_TTL_SECONDS,
  buildBadgeSvgCacheKey,
  readBadgeSvgCache,
  writeBadgeSvgCache,
} from "@/lib/render/badge-svg-cache";
import {
  getBadgeAvatarCachePolicy,
  getBadgeAvatarDataUri,
  resolveBadgeAvatar,
} from "@/lib/render/avatar-outcome";
import { CommandBarHint } from "@/components/CommandBarHint";
import { BadgeSkeleton } from "@/components/BadgeSkeleton";
import {
  getPublicProfileVerification,
  deferProfileCacheWork,
  materializePublicProfile,
  persistProfileSnapshot,
  redactImpactForVisitor,
} from "@/lib/profile/public-profile";
import { getOptionalServerSessionFromHeaders } from "@/lib/auth/session";
import { captureServerError } from "@/lib/analytics/server-errors";
import { fireAndForget } from "@/lib/async/fire-and-forget";
import { getOAuthErrorMessage } from "@/lib/auth/error-messages";
import { ErrorBanner } from "@/components/ErrorBanner";
import { getTrendData } from "@/lib/history/get-trend-data";
import { redactSnapshotDiffForVisitor } from "@/lib/history/diff";
import { getServerLocale, getServerT } from "@/lib/i18n/server";
import { DEFAULT_LOCALE, LanguageProvider, LocaleSync } from "@/lib/i18n";
import { en } from "@/lib/i18n/dictionaries/en";
import { es } from "@/lib/i18n/dictionaries/es";
import { interpolate } from "@/lib/i18n/interpolate";
import { SharePageH2 } from "./SharePageH2";
import { SharePageLocaleContent } from "./SharePageLocaleContent";
import { SharePageWebMcpTools } from "./SharePageWebMcpTools";

const BASE_URL = getBaseUrl();
const READ_ONLY_SMOKE_PARAM = "__chapa_smoke";

interface SharePageProps {
  params: Promise<{ handle: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
  params,
  searchParams,
}: SharePageProps): Promise<Metadata> {
  const { handle } = await params;
  if (!isValidHandle(handle)) {
    return { title: "Not Found" };
  }

  // #1066 — the route is dynamic (see SharePage below), so locale resolves
  // via getServerLocale: an explicit ?lang= deep-link override first (#1020
  // contract — must win over the cookie), then the chapa-locale cookie,
  // then Accept-Language, falling back to DEFAULT_LOCALE ('es'). This must
  // resolve to the SAME locale as the body below, or streamed metadata
  // could disagree with the client title after hydration.
  const resolvedSearch = searchParams ? await searchParams : {};
  const requestedLocale =
    typeof resolvedSearch.lang === "string" ? resolvedSearch.lang : null;
  const locale = await getServerLocale(requestedLocale);
  const t = getServerT(locale);

  const pageUrl = `${BASE_URL}/u/${handle}`;
  // Daily cache buster forces social platforms to re-fetch the OG image
  const today = toDateString(new Date());
  const ogImageUrl = `${BASE_URL}/u/${handle}/og-image?v=${today}`;
  return {
    title: `@${interpolate(t("sharePage.metadataTitle") as string, { handle })}`,
    description: interpolate(t("sharePage.metadataDescription") as string, { handle }),
    openGraph: {
      type: "profile",
      title: `@${interpolate(t("sharePage.metadataOgTitle") as string, { handle })}`,
      description: interpolate(t("sharePage.metadataDescription") as string, { handle }),
      url: pageUrl,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: interpolate(t("sharePage.metadataOgImageAlt") as string, { handle }) }],
    },
    twitter: {
      card: "summary_large_image",
      title: `@${interpolate(t("sharePage.metadataTitle") as string, { handle })}`,
      description: interpolate(t("sharePage.metadataDescription") as string, { handle }),
      images: [ogImageUrl],
    },
    alternates: {
      canonical: pageUrl,
    },
  };
}

export default async function SharePage({ params, searchParams }: SharePageProps) {
  const { handle } = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const queryLang = typeof resolvedSearch.lang === "string" ? resolvedSearch.lang : null;
  // #1066 — same resolution as generateMetadata above (query > cookie >
  // header > default), so the body never disagrees with streamed metadata.
  const locale = await getServerLocale(queryLang);
  const readOnly = resolvedSearch[READ_ONLY_SMOKE_PARAM] === "1";

  // #1107 — every platform OAuth (Bitbucket/Codeberg/GitLab) connect/
  // callback failure branch in lib/auth/platform-oauth.ts redirects back to
  // this exact page as `?error=<platform>_<code>`, but nothing here read
  // that param — a failed "Connect GitLab" click left the user with zero
  // feedback. Read server-side (not via a client useSyncExternalStore leaf
  // like the landing page's #982 pattern): that pattern exists solely to
  // avoid opting a static/ISR page out of static rendering, and this route
  // is already dynamic (#1066 above already awaits searchParams and reads
  // the session), so there is no static-rendering cost left to avoid here.
  const errorCode = typeof resolvedSearch.error === "string" ? resolvedSearch.error : null;
  const t = getServerT(locale);
  const errorMessage = getOAuthErrorMessage(errorCode, (key) => t(key) as string);

  if (!isValidHandle(handle)) {
    notFound();
  }

  return (
    <LanguageProvider
      initialLocale={locale}
      // #1071 — the root layout's LanguageProvider already serializes the
      // DEFAULT_LOCALE dictionary into the RSC payload. When this page's
      // per-request locale matches it, omit the prop entirely so it isn't
      // serialized a second time — LanguageProvider reuses that ancestor's
      // context instead. Only a genuine mismatch (e.g. `?lang=` override)
      // needs its own dictionary supplied here.
      dictionary={locale === DEFAULT_LOCALE ? undefined : locale === "es" ? es : en}
    >
      {/* Establish query ownership in the hydrated shell. The streamed client
          subtree then starts with the same dictionary as its server markup. */}
      <LocaleSync queryLang={queryLang} />
      {errorMessage && <ErrorBanner message={errorMessage} />}
      <main id="main-content" className="min-h-screen bg-bg">
        <Suspense fallback={<BadgeSkeleton />}>
          <SharePageContent handle={handle} readOnly={readOnly} />
        </Suspense>
        {/* Progressive disclosure (#783): the terminal command bar is demoted to a
            subtle, opt-in hint so the badge value stays legible to non-developer
            visitors. The "/" shortcut and full command bar remain available. */}
        <CommandBarHint />
      </main>
    </LanguageProvider>
  );
}

/** Data-dependent content — streams after shell via Suspense. */
/** @internal Exported for tests — use SharePage as the page component. */
export async function SharePageContent({
  handle,
  readOnly = false,
}: {
  handle: string;
  readOnly?: boolean;
}) {
  // Stats fetch uses env GITHUB_TOKEN fallback (no per-user OAuth token).

  // #1067 — resolve the requester's session server-side (the route is
  // dynamic per #1066) so owner-only confidence data can be redacted below
  // BEFORE it crosses into the "use client" component tree. A client-side
  // isOwner check (still used for display gating in SharePageOwnerContent)
  // only hides the UI — the data would already be in a visitor's
  // view-source via the RSC payload.
  //
  // #1034 — trend/diff history is fetched alongside profile materialization
  // (rather than in a client `useEffect` post-hydration) so the dashboard
  // renders with this data on first paint instead of a client fetch waterfall.
  // getTrendData() already degrades gracefully (returns nulls) on any
  // history-store failure; the `.catch()` here is a belt-and-suspenders
  // guard so a future regression in that contract still can't fail the
  // whole share page render — a 500 here would be a bug (CLAUDE.md).
  //
  // Session resolution has no data dependency on the other two, so all
  // three run concurrently rather than awaiting headers() up front.
  const [session, materialized, trendData] = await Promise.all([
    headers().then((h) => getOptionalServerSessionFromHeaders(h)),
    materializePublicProfile(handle, { readOnly }),
    getTrendData(handle).catch(() => ({ trend: null, diff: null })),
  ]);
  const isOwner = session?.login === handle;
  const stats = materialized?.stats ?? null;
  // `impact` stays the FULL, unredacted result — it feeds renderBadgeSvg and
  // personJsonLd below (and, via `materialized` itself, the snapshot/HMAC
  // record in the deferred work further down). Only the copy handed to the
  // client component tree is redacted, via `impactForClient` near the
  // bottom of this function.
  const impact = materialized?.displayImpact ?? null;
  const craftResult = materialized?.craftResult ?? null;
  const verification = materialized
    ? getPublicProfileVerification(materialized)
    : null;

  // #720 — try the shared SVG cache first. The /u/[handle]/badge.svg route
  // writes here after every successful render, so on warm caches the share
  // page can skip avatar fetch + render entirely.
  const today = toDateString(new Date());
  const svgCacheKey = buildBadgeSvgCacheKey(handle, today);
  const cachedSvg = await readBadgeSvgCache(svgCacheKey);

  let inlineSvg: string | null = cachedSvg;
  let renderedFresh = false;
  let avatarCachePolicy: ReturnType<typeof getBadgeAvatarCachePolicy> = "skip";

  if (!cachedSvg && stats && impact) {
    // Cache miss — render inline. Avatar fetch is best-effort with a tight
    // 250ms deadline (#800) so a slow external image server can't block
    // TTFB. The /u/[handle]/badge.svg route uses a longer bounded deadline on
    // its own first render and writes the avatar-bearing SVG to the same
    // cache, so warm visits to the share page get the real avatar.
    const AVATAR_DEADLINE_MS = 250;
    let avatarDataUri: string | undefined;
    if (!readOnly) {
      const avatarOutcome = await resolveBadgeAvatar(handle, stats.avatarUrl, {
        deadlineMs: AVATAR_DEADLINE_MS,
      });
      avatarDataUri = getBadgeAvatarDataUri(avatarOutcome);
      avatarCachePolicy = getBadgeAvatarCachePolicy(avatarOutcome);
    }
    inlineSvg = renderBadgeSvg(stats, impact, {
      avatarDataUri,
      verificationHash: verification?.hash,
      verificationDate: verification?.date,
    });
    renderedFresh = true;
  }

  // Deferred work: verification storage, tracking, snapshots, and an eligible
  // fresh-render cache write so future requests and the badge.svg route can
  // hit the cache. Transient avatar failures and timeouts stay uncached; a
  // definitive remote absence is stable enough for the normal cache, while a
  // missing URL gets the short placeholder TTL. (#800)
  //
  // #1088 — a handle with NO avatarUrl at all is different: that absence
  // won't resolve itself on a retry within this request, so gating the write
  // shut the same way as a genuine race-timeout meant it NEVER got cached.
  // It still gets a write, just a short-TTL one, so it doesn't shadow a
  // later good render for the full 24h+jitter a normal write would use.
  //
  // #1091 — persistProfileSnapshot is a durable Supabase write with nothing
  // in the rendered HTML depending on its result, so (mirroring the badge
  // route's #1013 fix) it now runs inside after() alongside the deferred
  // cache work it gates, instead of blocking TTFB. A genuine failure from
  // the deferred chain is escalated via captureServerError rather than
  // swallowed — persistProfileSnapshot already does this internally for its
  // own "failed" write outcome; this outer catch covers any other error.
  if (materialized && inlineSvg && !readOnly) {
    const cacheEligible =
      renderedFresh && !!verification && avatarCachePolicy !== "skip";
    const svgToCache = cacheEligible ? inlineSvg : null;
    // Short-TTL only when stats have no avatar URL; a resolved avatar keeps
    // the standard 24h+jitter TTL (writeBadgeSvgCache's own default).
    const svgCacheTtlSeconds =
      cacheEligible && avatarCachePolicy === "short"
        ? AVATAR_ABSENT_CACHE_TTL_SECONDS
        : undefined;
    after(() => {
      if (svgToCache) {
        void writeBadgeSvgCache(
          svgCacheKey,
          svgToCache,
          handle,
          svgCacheTtlSeconds !== undefined ? { ttlSeconds: svgCacheTtlSeconds } : undefined,
        );
      }
      return persistProfileSnapshot(handle, materialized, { readOnly })
        .then((shouldRunDeferred) => {
          if (!shouldRunDeferred) return;
          return deferProfileCacheWork(handle, materialized, { verification });
        })
        .catch((err) => {
          fireAndForget(() =>
            captureServerError({
              route: `/u/${handle}`,
              statusCode: 500,
              error: err,
            }),
          );
        });
    });
  }

  const badgeCacheBuster = stats?.fetchedAt ?? new Date().toISOString();
  const badgeSrcParams = new URLSearchParams({
    v: badgeCacheBuster,
    ...(readOnly ? { [READ_ONLY_SMOKE_PARAM]: "1" } : {}),
  });
  const badgeImageSrc = `/u/${encodeURIComponent(handle)}/badge.svg?${badgeSrcParams.toString()}`;

  const embedMarkdown = `![Chapa Badge](https://chapa.thecreativetoken.com/u/${handle}/badge.svg)`;

  const displayLabel = stats?.displayName ?? handle;

  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: displayLabel,
    url: `https://github.com/${handle}`,
    sameAs: [`https://github.com/${handle}`],
    ...(impact
      ? {
          description: `Developer with a Chapa Impact Score of ${impact.adjustedComposite} (${impact.tier} tier).`,
        }
      : {}),
  };

  const badgeLabelId = `share-badge-label-${handle}`;

  // #1067 — this is the ONE place `impact` crosses into a "use client"
  // component tree. A projection, not a mutation: `impact` (and, more
  // importantly, `materialized.displayImpact` it's aliased from) must stay
  // fully intact above for the badge render, JSON-LD, and the deferred
  // snapshot/HMAC verification-record work in `after()`.
  const impactForClient = impact && !isOwner ? redactImpactForVisitor(impact) : impact;
  const diffForClient =
    trendData.diff && !isOwner
      ? redactSnapshotDiffForVisitor(trendData.diff)
      : trendData.diff;

  return (
    <>
      <SharePageShortcuts
        embedMarkdown={embedMarkdown}
        handle={handle}
      />
      {stats && impactForClient && (
        <SharePageWebMcpTools
          handle={handle}
          impact={impactForClient}
          stats={stats}
          verification={verification}
          trend={trendData.trend}
          diff={diffForClient}
          craftResult={craftResult}
        />
      )}
      {/* SAFETY: renderJsonLd escapes <, >, & to prevent </script> injection. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: renderJsonLd(personJsonLd),
        }}
      />

      <NavbarClient />

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 pt-20 pb-16 sm:pt-24 sm:pb-24">
        <SharePageLocaleContent handle={handle} badgeLabelId={badgeLabelId} />

        {/* ── Badge Section Title ──────────────────────────────── */}
        <SharePageH2 />

        {/* ── Badge Preview ──────────────────────────────────── */}
        <div className="mb-4 animate-scale-in motion-reduce:animate-none [animation-delay:200ms]">
          <div className="rounded-2xl border border-stroke bg-card p-4 shadow-lg shadow-amber/5">
            <div
              role="img"
              aria-labelledby={badgeLabelId}
              className="w-full rounded-xl overflow-hidden [&_svg]:w-full [&_svg]:h-auto [&_svg]:block"
            >
              {inlineSvg ? (
                <div dangerouslySetInnerHTML={{ __html: inlineSvg }} />
              ) : (
                /* Fallback: if SVG render failed, load via <img> with skeleton */
                <div className="relative">
                  <BadgeSkeleton />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={badgeImageSrc}
                    alt=""
                    aria-hidden="true"
                    width={1200}
                    height={630}
                    fetchPriority="high"
                    className="w-full rounded-xl relative"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Toolbar ──────────────────────────────────────────── */}
        <div className="relative z-30 flex justify-end mb-10 animate-fade-in-up motion-reduce:animate-none [animation-delay:250ms]">
          <BadgeToolbar
            handle={handle}
          />
        </div>

        {/* ── Owner/Visitor Content (client-side session check) ── */}
        <SharePageOwnerContentLazy
          handle={handle}
          stats={stats}
          impact={impactForClient}
          craftResult={craftResult}
          trend={trendData.trend}
          diff={diffForClient}
        />
      </div>
    </>
  );
}
