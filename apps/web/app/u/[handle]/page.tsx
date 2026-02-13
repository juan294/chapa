import { getStats } from "@/lib/github/client";
import { computeImpactV4 } from "@/lib/impact/v4";
import { ImpactBreakdown } from "@/components/ImpactBreakdown";
import { CopyButton } from "@/components/CopyButton";
import { BadgeToolbar } from "@/components/BadgeToolbar";
import { readSessionCookie } from "@/lib/auth/github";
import { isValidHandle } from "@/lib/validation";
import { cacheGet } from "@/lib/cache/redis";
import { Navbar } from "@/components/Navbar";
import { GlobalCommandBar } from "@/components/GlobalCommandBar";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { BadgeConfig } from "@chapa/shared";
import { DEFAULT_BADGE_CONFIG } from "@chapa/shared";
import { ShareBadgePreviewLazy } from "@/components/ShareBadgePreviewLazy";
import { SharePageShortcuts } from "@/components/SharePageShortcuts";
import { isStudioEnabled } from "@/lib/feature-flags";

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
  "https://chapa.thecreativetoken.com";

interface SharePageProps {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({
  params,
}: SharePageProps): Promise<Metadata> {
  const { handle } = await params;
  if (!isValidHandle(handle)) {
    return { title: "Not Found" };
  }

  const pageUrl = `${BASE_URL}/u/${handle}`;
  return {
    title: `@${handle} — Developer Impact, Decoded`,
    description: `View ${handle}'s developer impact on Chapa. See their archetype, four dimension scores, and embeddable badge.`,
    openGraph: {
      type: "profile",
      title: `@${handle} — Chapa Developer Impact, Decoded`,
      description: `View ${handle}'s developer impact and badge on Chapa.`,
      url: pageUrl,
    },
    twitter: {
      card: "summary_large_image",
      title: `@${handle} — Chapa Developer Impact, Decoded`,
      description: `View ${handle}'s developer impact and badge on Chapa.`,
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

  const sessionSecret = process.env.NEXTAUTH_SECRET?.trim();
  let sessionLogin: string | null = null;
  let token: string | undefined;
  if (sessionSecret) {
    const headerStore = await headers();
    const session = readSessionCookie(
      headerStore.get("cookie"),
      sessionSecret,
    );
    if (session) {
      token = session.token;
      sessionLogin = session.login;
    }
  }

  const [stats, savedConfig] = await Promise.all([
    getStats(handle, token),
    cacheGet<BadgeConfig>(`config:${handle}`),
  ]);
  const impact = stats ? computeImpactV4(stats) : null;

  const isOwner = sessionLogin !== null && sessionLogin === handle;
  const useInteractivePreview =
    hasCustomConfig(savedConfig) && stats && impact;

  const badgeCacheBuster = stats?.fetchedAt ?? new Date().toISOString();

  const embedMarkdown = `![Chapa Badge](https://chapa.thecreativetoken.com/u/${handle}/badge.svg)`;
  const embedHtml = `<img src="https://chapa.thecreativetoken.com/u/${handle}/badge.svg" alt="Chapa Badge for ${handle}" width="600" />`;

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
    <main id="main-content" className="min-h-screen bg-bg">
      <SharePageShortcuts
        embedMarkdown={embedMarkdown}
        handle={handle}
        isOwner={isOwner}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(personJsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <Navbar />

      <div className="relative mx-auto max-w-4xl px-6 pt-24 pb-24">
        <h1 className="sr-only">
          @{handle} — Developer Impact, Decoded
        </h1>

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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/u/${encodeURIComponent(handle)}/badge.svg?v=${encodeURIComponent(badgeCacheBuster)}`}
                alt={`Chapa badge for ${handle}`}
                width={1200}
                height={630}
                className="w-full rounded-xl"
              />
            </div>
          )}
        </div>

        {/* ── Toolbar ──────────────────────────────────────────── */}
        <div className="mb-12 animate-fade-in-up [animation-delay:300ms]">
          <BadgeToolbar
            handle={handle}
            isOwner={isOwner}
            studioEnabled={isStudioEnabled()}
          />
        </div>

        {/* ── Impact Dashboard ────────────────────────────────── */}
        {impact && stats ? (
          <section className="mb-12 animate-fade-in-up [animation-delay:350ms]">
            <ImpactBreakdown impact={impact} stats={stats} />
          </section>
        ) : (
          <section className="mb-12 animate-fade-in-up [animation-delay:350ms]">
            <div className="rounded-2xl border border-stroke bg-card p-8">
              <p className="text-text-secondary">
                Could not load impact data for this user. Try again later.
              </p>
            </div>
          </section>
        )}

        {/* ── Embed Snippets ──────────────────────────────────── */}
        <section className="animate-fade-in-up [animation-delay:500ms]">
          <div className="rounded-2xl border border-stroke bg-card p-6 space-y-4">
            <h2 className="font-heading text-[11px] tracking-[0.2em] uppercase text-text-secondary">
              Embed This Badge
            </h2>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">Markdown</span>
                <CopyButton text={embedMarkdown} />
              </div>
              <pre className="overflow-x-auto rounded-lg border border-stroke bg-dark-card p-3 text-xs text-text-secondary font-heading">
                {embedMarkdown}
              </pre>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">HTML</span>
                <CopyButton text={embedHtml} />
              </div>
              <pre className="overflow-x-auto rounded-lg border border-stroke bg-dark-card p-3 text-xs text-text-secondary font-heading">
                {embedHtml}
              </pre>
            </div>
          </div>
        </section>
      </div>

      <GlobalCommandBar />
    </main>
  );
}
