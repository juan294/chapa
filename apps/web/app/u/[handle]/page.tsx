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
import { GlobalCommandBarLazy } from "@/components/GlobalCommandBarLazy";
import { BadgeSkeleton } from "@/components/BadgeSkeleton";
import {
  getPublicProfileVerification,
  materializePublicProfile,
  runPublicProfileSideEffects,
} from "@/lib/profile/public-profile";

const BASE_URL = getBaseUrl();

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

  const pageUrl = `${BASE_URL}/u/${handle}`;
  // Daily cache buster forces social platforms to re-fetch the OG image
  const today = toDateString(new Date());
  const ogImageUrl = `${BASE_URL}/u/${handle}/og-image?v=${today}`;
  return {
    title: `@${handle} — Developer Impact, Decoded`,
    description: `View ${handle}'s developer impact score and badge on Chapa.`,
    openGraph: {
      type: "profile",
      title: `@${handle} — Chapa Developer Impact, Decoded`,
      description: `View ${handle}'s developer impact and badge on Chapa.`,
      url: pageUrl,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `Chapa badge for ${handle}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `@${handle} — Chapa Developer Impact, Decoded`,
      description: `What does your developer DNA look like? Discover your impact score, archetype, and coding patterns.`,
      images: [ogImageUrl],
    },
    alternates: {
      canonical: pageUrl,
    },
  };
}

export default async function SharePage({ params }: SharePageProps) {
  const { handle } = await params;

  if (!isValidHandle(handle)) {
    notFound();
  }

  return (
    <main id="main-content" className="min-h-screen bg-bg">
      <Suspense fallback={<BadgeSkeleton />}>
        <SharePageContent handle={handle} />
      </Suspense>
      <GlobalCommandBarLazy />
    </main>
  );
}

/** Data-dependent content — streams after shell via Suspense. */
/** @internal Exported for tests — use SharePage as the page component. */
export async function SharePageContent({ handle }: { handle: string }) {
  // ISR: No dynamic request APIs (next/headers, next/cookies) are called.
  // Session is checked client-side via SharePageOwnerContent and NavbarClient.
  // Stats fetch uses env GITHUB_TOKEN fallback (no per-user OAuth token).

  const materialized = await materializePublicProfile(handle);
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

  if (!cachedSvg && stats && impact) {
    // Cache miss — render inline. Avatar fetch is best-effort with a 500ms
    // deadline so a slow external image server can't block TTFB.
    const avatarPromise = stats.avatarUrl
      ? getAvatarBase64(handle, stats.avatarUrl).catch(() => undefined)
      : Promise.resolve(undefined);
    const AVATAR_DEADLINE_MS = 500;
    const avatarDataUri = await Promise.race([
      avatarPromise,
      new Promise<undefined>((resolve) =>
        setTimeout(() => resolve(undefined), AVATAR_DEADLINE_MS),
      ),
    ]);
    inlineSvg = renderBadgeSvg(stats, impact, {
      avatarDataUri,
      verificationHash: verification?.hash,
      verificationDate: verification?.date,
    });
    renderedFresh = true;
  }

  // Deferred work: verification storage, tracking, snapshots, and (on
  // fresh render) cache write so future requests / the badge.svg route
  // can hit the cache.
  if (materialized && inlineSvg) {
    const svgToCache = renderedFresh ? inlineSvg : null;
    after(() => {
      if (svgToCache) {
        void writeBadgeSvgCache(svgCacheKey, svgToCache);
      }
      return runPublicProfileSideEffects(handle, materialized, { verification });
    });
  }

  const badgeCacheBuster = stats?.fetchedAt ?? new Date().toISOString();

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
          description: `Developer with a Chapa Impact Score of ${impact.adjustedComposite} (${impact.tier} tier) and ${impact.confidence}% confidence.`,
        }
      : {}),
  };

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
          @{handle} — Developer Impact, Decoded
        </h1>

        {/* ── Badge Section Title ──────────────────────────────── */}
        <h2 className="font-heading text-xs tracking-[0.2em] uppercase text-text-secondary mb-4 animate-fade-in-up motion-reduce:animate-none [animation-delay:150ms] text-balance">
          Your Impact, Decoded
        </h2>

        {/* ── Badge Preview ──────────────────────────────────── */}
        <div className="mb-4 animate-scale-in motion-reduce:animate-none [animation-delay:200ms]">
          <div className="rounded-2xl border border-stroke bg-card p-4 shadow-lg shadow-amber/5">
            {inlineSvg ? (
              <div
                role="img"
                aria-label={`Chapa badge for ${handle}`}
                className="w-full rounded-xl overflow-hidden [&>svg]:w-full [&>svg]:h-auto [&>svg]:block"
                dangerouslySetInnerHTML={{ __html: inlineSvg }}
              />
            ) : (
              /* Fallback: if SVG render failed, load via <img> with skeleton */
              <div className="relative">
                <BadgeSkeleton />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/u/${encodeURIComponent(handle)}/badge.svg?v=${encodeURIComponent(badgeCacheBuster)}`}
                  alt={`Chapa badge for ${handle}`}
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
