export const revalidate = 3600;

import { Suspense } from "react";
import { after } from "next/server";
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
  buildBadgeSvgCacheKey,
  readBadgeSvgCache,
  writeBadgeSvgCache,
} from "@/lib/render/badge-svg-cache";
import { getAvatarBase64 } from "@/lib/render/avatar";
import { CommandBarHint } from "@/components/CommandBarHint";
import { BadgeSkeleton } from "@/components/BadgeSkeleton";
import {
  getPublicProfileVerification,
  materializePublicProfile,
  runPublicProfileSideEffects,
} from "@/lib/profile/public-profile";
import { getServerT } from "@/lib/i18n/server";
import { DEFAULT_LOCALE, LocaleSync } from "@/lib/i18n";
import { interpolate } from "@/lib/i18n/interpolate";
import { SharePageH2 } from "./SharePageH2";

const BASE_URL = getBaseUrl();
const READ_ONLY_SMOKE_PARAM = "__chapa_smoke";

interface SharePageProps {
  params: Promise<{ handle: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
  params,
}: SharePageProps): Promise<Metadata> {
  const { handle } = await params;
  if (!isValidHandle(handle)) {
    return { title: "Not Found" };
  }

  // generateMetadata runs at ISR build time — avoid server-only APIs.
  // Use the primary audience locale (es) for social metadata so Spanish users
  // get localised social cards. Client hydration via LocaleSync handles runtime locale.
  const t = getServerT("es");

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
  const readOnly = resolvedSearch[READ_ONLY_SMOKE_PARAM] === "1";

  if (!isValidHandle(handle)) {
    notFound();
  }

  return (
    <main id="main-content" className="min-h-screen bg-bg">
      <LocaleSync queryLang={queryLang} />
      <Suspense fallback={<BadgeSkeleton />}>
        <SharePageContent handle={handle} readOnly={readOnly} />
      </Suspense>
      {/* Progressive disclosure (#783): the terminal command bar is demoted to a
          subtle, opt-in hint so the badge value stays legible to non-developer
          visitors. The "/" shortcut and full command bar remain available. */}
      <CommandBarHint />
    </main>
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
  // ISR: No dynamic request APIs (next headers/cookies) are called.
  // Session is checked client-side via SharePageOwnerContent and NavbarClient.
  // Stats fetch uses env GITHUB_TOKEN fallback (no per-user OAuth token).

  const materialized = await materializePublicProfile(handle, { readOnly });
  const stats = materialized?.stats ?? null;
  const impact = materialized?.displayImpact ?? null;
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
  let avatarResolved = false;

  if (!cachedSvg && stats && impact) {
    // Cache miss — render inline. Avatar fetch is best-effort with a tight
    // 250ms deadline (#800) so a slow external image server can't block
    // TTFB. The /u/[handle]/badge.svg route awaits the avatar fully on its
    // own first render and writes the avatar-bearing SVG to the same
    // cache, so warm visits to the share page get the real avatar.
    const avatarPromise = !readOnly && stats.avatarUrl
      ? getAvatarBase64(handle, stats.avatarUrl).catch(() => undefined)
      : Promise.resolve(undefined);
    const AVATAR_DEADLINE_MS = 250;
    const avatarDataUri = await Promise.race([
      avatarPromise,
      new Promise<undefined>((resolve) =>
        setTimeout(() => resolve(undefined), AVATAR_DEADLINE_MS),
      ),
    ]);
    avatarResolved = avatarDataUri !== undefined;
    inlineSvg = renderBadgeSvg(stats, impact, {
      avatarDataUri,
      verificationHash: verification?.hash,
      verificationDate: verification?.date,
    });
    renderedFresh = true;
  }

  // Deferred work: verification storage, tracking, snapshots, and (on a
  // fresh render where the avatar resolved) cache write so future requests
  // and the badge.svg route can hit the cache. We deliberately do NOT
  // cache renders that fell back to a placeholder avatar — that would
  // poison the shared cache with a degraded SVG for up to 24h. (#800)
  if (materialized && inlineSvg && !readOnly) {
    const svgToCache = renderedFresh && avatarResolved ? inlineSvg : null;
    after(() => {
      if (svgToCache) {
        void writeBadgeSvgCache(svgCacheKey, svgToCache, handle);
      }
      return runPublicProfileSideEffects(handle, materialized, { verification });
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

  // Keep the public share page ISR-safe: server-render default-locale strings
  // without dynamic cookie/header reads; LocaleSync applies query/cookie locale client-side.
  const t = getServerT(DEFAULT_LOCALE);

  return (
    <>
      <SharePageShortcuts
        embedMarkdown={embedMarkdown}
        handle={handle}

      />
      {/* SAFETY: renderJsonLd escapes <, >, & to prevent </script> injection. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: renderJsonLd(personJsonLd),
        }}
      />

      <NavbarClient />

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 pt-20 pb-16 sm:pt-24 sm:pb-24">
        <h1 className="sr-only">
          {interpolate(t("sharePage.srH1") as string, { handle })}
        </h1>

        {/* ── Badge Section Title ──────────────────────────────── */}
        <SharePageH2 />

        {/* ── Badge Preview ──────────────────────────────────── */}
        <div className="mb-4 animate-scale-in motion-reduce:animate-none [animation-delay:200ms]">
          <div className="rounded-2xl border border-stroke bg-card p-4 shadow-lg shadow-amber/5">
            {inlineSvg ? (
              <div
                role="img"
                aria-label={interpolate(t("sharePage.badgeAriaLabel") as string, { handle })}
                className="w-full rounded-xl overflow-hidden [&>svg]:w-full [&>svg]:h-auto [&>svg]:block"
                dangerouslySetInnerHTML={{ __html: inlineSvg }}
              />
            ) : (
              /* Fallback: if SVG render failed, load via <img> with skeleton */
              <div className="relative">
                <BadgeSkeleton />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={badgeImageSrc}
                  alt={interpolate(t("sharePage.badgeAlt") as string, { handle })}
                  width={1200}
                  height={630}
                  fetchPriority="high"
                  className="w-full rounded-xl relative"
                />
              </div>
            )}
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
          impact={impact}
        />
      </div>
    </>
  );
}
