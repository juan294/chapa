import { getStats } from "@/lib/github/client";
import { computeImpactV4 } from "@/lib/impact/v4";
import { ImpactBreakdown, getArchetypeProfile } from "@/components/ImpactBreakdown";
import { CopyButton } from "@/components/CopyButton";
import { BadgeToolbar } from "@/components/BadgeToolbar";
import { readSessionCookie } from "@/lib/auth/github";
import { isValidHandle } from "@/lib/validation";
import { cacheGet } from "@/lib/cache/redis";
import { Navbar } from "@/components/Navbar";
import Link from "next/link";
import { GlobalCommandBar } from "@/components/GlobalCommandBar";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { BadgeConfig } from "@chapa/shared";
import { DEFAULT_BADGE_CONFIG } from "@chapa/shared";
import { ShareBadgePreviewLazy } from "@/components/ShareBadgePreviewLazy";
import { SharePageShortcuts } from "@/components/SharePageShortcuts";
import { isStudioEnabled } from "@/lib/feature-flags";
import { getBaseUrl } from "@/lib/env";

const BASE_URL = getBaseUrl();

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
  // Daily cache buster forces social platforms to re-fetch the OG image
  const today = new Date().toISOString().slice(0, 10);
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
      {/* SAFETY: JSON-LD uses JSON.stringify (auto-escapes quotes/special chars) + explicit < escape to prevent </script> injection. User handle is a URL param but only appears as a JSON string value, never raw HTML. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(personJsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <Navbar />

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 pt-20 pb-16 sm:pt-24 sm:pb-24">
        <h1 className="sr-only">
          @{handle} — Developer Impact, Decoded
        </h1>

        {/* ── Badge Section Title ──────────────────────────────── */}
        <h2 className="font-heading text-xs tracking-[0.2em] uppercase text-text-secondary mb-4 animate-fade-in-up [animation-delay:150ms]">
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/u/${encodeURIComponent(handle)}/badge.svg?v=${encodeURIComponent(badgeCacheBuster)}`}
                alt={`Chapa badge for ${handle}`}
                width={1200}
                height={630}
                fetchPriority="high"
                className="w-full rounded-xl"
              />
            </div>
          )}
        </div>

        {/* ── Toolbar ──────────────────────────────────────────── */}
        <div className="flex justify-end mb-10 animate-fade-in-up [animation-delay:250ms]">
          <BadgeToolbar
            handle={handle}
            isOwner={isOwner}
            studioEnabled={await isStudioEnabled()}
          />
        </div>

        {/* ── Visitor CTA (non-owners) ───────────────────────── */}
        {!isOwner && (
          <section className="mb-10 animate-fade-in-up [animation-delay:300ms]">
            <div className="rounded-2xl border border-stroke bg-card p-6 sm:p-8 text-center">
              <h2 className="font-heading text-lg sm:text-xl font-bold text-text-primary tracking-tight mb-2">
                Curious what your developer impact looks like?
              </h2>
              <p className="text-sm text-text-secondary leading-relaxed mb-6 max-w-md mx-auto">
                Decode your coding DNA in seconds. See your archetype, impact score, and how you compare.
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-lg bg-amber px-6 py-3 text-sm font-semibold text-white hover:bg-amber-light hover:shadow-xl hover:shadow-amber/25 transition-all"
              >
                Discover your impact
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </section>
        )}

        {/* ── Impact Breakdown (owner only) ─────────────────── */}
        {isOwner && (
          <>
            <hr className="border-stroke mb-10" />

            <h2 className="font-heading text-xs tracking-[0.2em] uppercase text-text-secondary mb-8 animate-fade-in-up [animation-delay:280ms]">
              Impact Breakdown
            </h2>

            {/* ── Archetype Header ──────────────────────────────── */}
            {impact && (
              <div className="mb-12 animate-fade-in-up [animation-delay:300ms]">
                <div className="flex items-baseline gap-3 mb-2">
                  <h3 className="font-heading text-3xl font-extrabold text-amber tracking-tight">
                    {impact.archetype}
                  </h3>
                  {impact.tier !== impact.archetype && (
                    <span className="inline-flex items-center rounded-full bg-amber/10 px-3 py-1 text-xs font-heading font-semibold text-amber uppercase tracking-wider">
                      {impact.tier}
                    </span>
                  )}
                </div>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {getArchetypeProfile(impact)}
                </p>
              </div>
            )}

            {/* ── Impact Dashboard ──────────────────────────────── */}
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
            <section className="space-y-6 animate-fade-in-up [animation-delay:500ms]">
          <h2 className="font-heading text-xs tracking-[0.2em] uppercase text-text-secondary">
            Embed This Badge
          </h2>

          {/* Markdown snippet */}
          <div className="rounded-xl border border-stroke bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-stroke">
              <div className="w-2.5 h-2.5 rounded-full bg-terminal-red/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-terminal-yellow/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-terminal-green/60" />
              <span className="ml-2 text-xs text-terminal-dim font-heading">
                Markdown
              </span>
              <div className="ml-auto">
                <CopyButton text={embedMarkdown} />
              </div>
            </div>
            <div className="p-4 font-heading text-xs sm:text-sm leading-relaxed overflow-x-auto">
              <p className="text-text-primary/80 whitespace-nowrap">
                <span className="text-amber">{"![Chapa Badge]("}</span>
                <span className="text-text-secondary">
                  {`https://chapa.thecreativetoken.com/u/${handle}/badge.svg`}
                </span>
                <span className="text-amber">{")"}</span>
              </p>
            </div>
          </div>

          {/* HTML snippet */}
          <div className="rounded-xl border border-stroke bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-stroke">
              <div className="w-2.5 h-2.5 rounded-full bg-terminal-red/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-terminal-yellow/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-terminal-green/60" />
              <span className="ml-2 text-xs text-terminal-dim font-heading">
                HTML
              </span>
              <div className="ml-auto">
                <CopyButton text={embedHtml} />
              </div>
            </div>
            <div className="p-4 font-heading text-xs sm:text-sm leading-relaxed overflow-x-auto">
              <p className="text-text-primary/80 whitespace-nowrap">
                <span className="text-amber">{"<img "}</span>
                <span className="text-text-secondary">{"src="}</span>
                <span className="text-amber/70">{`"https://chapa.thecreativetoken.com/u/${handle}/badge.svg"`}</span>
                <span className="text-text-secondary">{" alt="}</span>
                <span className="text-amber/70">{`"Chapa Badge for ${handle}"`}</span>
                <span className="text-text-secondary">{" width="}</span>
                <span className="text-amber/70">{'"600"'}</span>
                <span className="text-amber">{" />"}</span>
              </p>
            </div>
            </div>
          </section>
          </>
        )}
      </div>

      <GlobalCommandBar />
    </main>
  );
}
