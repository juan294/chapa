export const revalidate = 3600;

import { Suspense } from "react";
import { after } from "next/server";
import { getStats } from "@/lib/github/client";
import { computeImpactV6 } from "@/lib/impact/v6";
import { smoothScore } from "@/lib/impact/smoothing";
import { getTier } from "@/lib/impact/utils";
import { getCachedLatestSnapshot, updateSnapshotCache } from "@/lib/cache/snapshot-cache";
import { BadgeToolbar } from "@/components/BadgeToolbar";
import { isValidHandle } from "@/lib/validation";
import { cacheGet, trackBadgeGenerated } from "@/lib/cache/redis";
import { NavbarClient } from "@/components/NavbarClient";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { BadgeConfig } from "@chapa/shared";
import { DEFAULT_BADGE_CONFIG } from "@chapa/shared";
import { ShareBadgePreviewLazy } from "@/components/ShareBadgePreviewLazy";
import { SharePageShortcuts } from "@/components/SharePageShortcuts";
import { SharePageOwnerContent } from "@/components/SharePageOwnerContent";
import { getCachedCraftScore } from "@/lib/cache/craft-cache";
import { getBaseUrl } from "@/lib/env";
import { toDateString } from "@/lib/utils/date";
import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { getAvatarBase64 } from "@/lib/render/avatar";
import { generateVerificationCode } from "@/lib/verification/hmac";
import { storeVerificationRecord } from "@/lib/verification/store";
import type { VerificationRecord } from "@/lib/verification/types";
import { notifyFirstBadge } from "@/lib/email/notifications";
import { buildSnapshot } from "@/lib/history/snapshot";
import { dbInsertSnapshot } from "@/lib/db/snapshots";
import { GlobalCommandBarLazy } from "@/components/GlobalCommandBarLazy";
import { BadgeSkeleton } from "@/components/BadgeSkeleton";

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

function hasCustomConfig(config: BadgeConfig | null): config is BadgeConfig {
  if (!config) return false;
  return (
    config.background !== DEFAULT_BADGE_CONFIG.background ||
    config.cardStyle !== DEFAULT_BADGE_CONFIG.cardStyle ||
    config.border !== DEFAULT_BADGE_CONFIG.border ||
    config.scoreEffect !== DEFAULT_BADGE_CONFIG.scoreEffect ||
    config.heatmapAnimation !== DEFAULT_BADGE_CONFIG.heatmapAnimation ||
    config.interaction !== DEFAULT_BADGE_CONFIG.interaction ||
    config.statsDisplay !== DEFAULT_BADGE_CONFIG.statsDisplay ||
    config.tierTreatment !== DEFAULT_BADGE_CONFIG.tierTreatment ||
    config.celebration !== DEFAULT_BADGE_CONFIG.celebration
  );
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

  // Fetch stats, config, snapshot, craft score, and feature flags in parallel
  const [stats, savedConfig, latestSnapshot, craftResult] = await Promise.all([
    getStats(handle),
    cacheGet<BadgeConfig>(`config:${handle}`),
    getCachedLatestSnapshot(handle),
    getCachedCraftScore(handle),
  ]);

  const impact = stats ? computeImpactV6(stats, craftResult?.craftScore ?? undefined) : null;

  // Start avatar fetch immediately (runs concurrently with EMA computation)
  const avatarPromise = stats?.avatarUrl
    ? getAvatarBase64(handle, stats.avatarUrl)
    : Promise.resolve(undefined);

  // V5: Day-aware EMA smoothing — applies once per day, prevents feedback loop
  // on same-day repeated requests (smoothScore returns cached value for today).
  if (impact) {
    impact.adjustedComposite = smoothScore(impact.adjustedComposite, latestSnapshot);
    impact.tier = getTier(impact.adjustedComposite);
  }

  const useInteractivePreview =
    hasCustomConfig(savedConfig) && stats && impact;

  // Render badge SVG inline during SSR to eliminate second round-trip
  const avatarDataUri = await avatarPromise;
  const verification = stats && impact
    ? generateVerificationCode(stats, impact)
    : null;
  const inlineSvg = stats && impact && !useInteractivePreview
    ? renderBadgeSvg(stats, impact, {
        avatarDataUri,
        verificationHash: verification?.hash,
        verificationDate: verification?.date,
      })
    : null;

  // Deferred work: verification storage, tracking, snapshots (runs after response)
  if (stats && impact && inlineSvg) {
    after(() => {
      const ops: Promise<void>[] = [];

      if (verification) {
        const record: VerificationRecord = {
          handle: stats.handle.toLowerCase(),
          displayName: stats.displayName,
          adjustedComposite: impact.adjustedComposite,
          confidence: impact.confidence,
          tier: impact.tier,
          archetype: impact.archetype,
          dimensions: impact.dimensions,
          commitsTotal: stats.commitsTotal,
          prsMergedCount: stats.prsMergedCount,
          reviewsSubmittedCount: stats.reviewsSubmittedCount,
          generatedAt: verification.date,
          profileType: impact.profileType,
        };
        ops.push(storeVerificationRecord(verification.hash, record));
      }

      ops.push(trackBadgeGenerated(handle));
      ops.push(notifyFirstBadge(handle, impact));
      const snapshot = buildSnapshot(stats, impact);
      ops.push(
        dbInsertSnapshot(handle, snapshot).then((inserted) => {
          if (inserted) updateSnapshotCache(handle, snapshot);
        }),
      );

      return Promise.allSettled(ops);
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
      {/* SAFETY: JSON-LD uses JSON.stringify (auto-escapes quotes/special chars) + explicit < escape to prevent </script> injection. User handle is a URL param but only appears as a JSON string value, never raw HTML. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(personJsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <NavbarClient />

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 pt-20 pb-16 sm:pt-24 sm:pb-24">
        <h1 className="sr-only">
          @{handle} — Developer Impact, Decoded
        </h1>

        {/* ── Badge Section Title ──────────────────────────────── */}
        <h2 className="font-heading text-xs tracking-[0.2em] uppercase text-text-secondary mb-4 animate-fade-in-up [animation-delay:150ms] text-balance">
          Your Impact, Decoded
        </h2>

        {/* ── Badge Preview ──────────────────────────────────── */}
        <div className="mb-4 animate-scale-in [animation-delay:200ms]">
          {useInteractivePreview ? (
            <ShareBadgePreviewLazy
              config={savedConfig}
              stats={stats}
              impact={impact}
            />
          ) : (
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
          )}
        </div>

        {/* ── Toolbar ──────────────────────────────────────────── */}
        <div className="relative z-30 flex justify-end mb-10 animate-fade-in-up [animation-delay:250ms]">
          <BadgeToolbar
            handle={handle}
          />
        </div>

        {/* ── Owner/Visitor Content (client-side session check) ── */}
        <SharePageOwnerContent
          handle={handle}
          stats={stats}
          impact={impact}
        />
      </div>
    </>
  );
}
