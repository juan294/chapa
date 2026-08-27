import Link from "next/link";
import { NavbarClient } from "@/components/NavbarClient";
import { GlobalCommandBarLazy } from "@/components/GlobalCommandBarLazy";
import { SiteFooter } from "@/components/SiteFooter";
import { getServerT } from "@/lib/i18n/server";
import { tArray } from "@/lib/i18n/typed-accessors";
import type { Locale } from "@/lib/i18n/types";
import type { Metadata } from "next";

// #1023 (FE-H1) — statically generated for BOTH locales (see
// app/[locale]/layout.tsx generateStaticParams), so this stays ISR/CDN
// cacheable while resolving translated copy server-side via
// getServerT(locale) — no client-side re-render/flash. The canonical,
// public URL stays `/about`; proxy.ts rewrites the unprefixed request
// to this internal `/[locale]/about` route.
export const dynamic = "force-static";
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = getServerT(locale);
  return {
    title: t('about.index.metadataTitle') as string,
    description: t('about.index.metadataDescription') as string,
    openGraph: {
      title: t('about.index.ogTitle') as string,
      description: t('about.index.ogDescription') as string,
    },
    twitter: {
      card: "summary",
      title: t('about.index.twitterTitle') as string,
      description: t('about.index.twitterDescription') as string,
    },
    alternates: {
      canonical: "/about",
    },
  };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = getServerT(locale);

  return (
    <div className="min-h-screen bg-bg">
      <NavbarClient />

      <main id="main-content" className="relative mx-auto max-w-3xl px-6 pt-32 pb-24">
        <div className="relative">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight mb-8 animate-fade-in-up">
            {t('about.index.h1') as string}<span className="text-amber animate-cursor-blink">_</span>
          </h1>

          <div className="space-y-6 text-text-secondary leading-relaxed animate-fade-in-up [animation-delay:150ms]">
            {tArray<string>(t, 'about.index.intro').map((p, i) => (
              <p key={i}>{p}</p>
            ))}

            <h2 className="font-heading text-xl font-semibold text-text-primary tracking-tight pt-4">
              {t('about.index.sectionDimensions') as string}
            </h2>
            <p>
              {t('about.index.dimensionsBody') as string}
            </p>

            <h2 className="font-heading text-xl font-semibold text-text-primary tracking-tight pt-4">
              {t('about.index.sectionArchetypes') as string}
            </h2>
            <p>
              {t('about.index.archetypesBodyBefore') as string}
              <Link href="/archetypes/builder" className="font-semibold text-text-primary underline decoration-archetype-builder decoration-2 underline-offset-4 hover:text-archetype-builder transition-colors">Builder</Link>,{" "}
              <Link href="/archetypes/guardian" className="font-semibold text-text-primary underline decoration-archetype-guardian decoration-2 underline-offset-4 hover:text-archetype-guardian transition-colors">Quality Champion</Link>,{" "}
              <Link href="/archetypes/marathoner" className="font-semibold text-text-primary underline decoration-archetype-marathoner decoration-2 underline-offset-4 hover:text-archetype-marathoner transition-colors">Marathoner</Link>,{" "}
              <Link href="/archetypes/polymath" className="font-semibold text-text-primary underline decoration-archetype-polymath decoration-2 underline-offset-4 hover:text-archetype-polymath transition-colors">Polymath</Link>,{" "}
              <Link href="/archetypes/artificer" className="font-semibold text-text-primary underline decoration-archetype-artificer decoration-2 underline-offset-4 hover:text-archetype-artificer transition-colors">Artificer</Link>,{" "}
              <Link href="/archetypes/balanced" className="font-semibold text-text-primary underline decoration-archetype-balanced decoration-2 underline-offset-4 hover:text-archetype-balanced transition-colors">Balanced</Link>, {t('common.orConnector') as string}{" "}
              <Link href="/archetypes/emerging" className="font-semibold text-text-primary underline decoration-archetype-emerging decoration-2 underline-offset-4 hover:text-archetype-emerging transition-colors">Emerging</Link>
              {t('about.index.archetypesBodyAfter') as string}
            </p>

            <h2 className="font-heading text-xl font-semibold text-text-primary tracking-tight pt-4">
              {t('about.index.sectionPrivacy') as string}
            </h2>
            <p>
              {t('about.index.privacyBody') as string}{" "}
              <Link
                href="/about/scoring"
                className="text-text-primary underline decoration-amber decoration-2 underline-offset-4 hover:text-amber transition-colors"
              >
                {t('about.index.scoringLinkLabel') as string}
              </Link>
              {t('about.index.privacyBodyMiddle') as string}
              <Link
                href="/about/verification"
                className="text-text-primary underline decoration-amber decoration-2 underline-offset-4 hover:text-amber transition-colors"
              >
                {t('about.index.verificationLinkLabel') as string}
              </Link>
              {t('about.index.privacyBodyEnd') as string}
            </p>

            <h2 className="font-heading text-xl font-semibold text-text-primary tracking-tight pt-4">
              {t('about.index.sectionContact') as string}
            </h2>
            <p>
              {t('about.index.contactBody') as string}
              <a
                href={`mailto:${t('about.index.contactEmail') as string}`}
                className="text-text-primary underline decoration-amber decoration-2 underline-offset-4 hover:text-amber transition-colors"
              >
                {t('about.index.contactEmail') as string}
              </a>
              {t('about.index.contactBodyEnd') as string}
            </p>
          </div>
        </div>
      </main>

      {/* pb-16 spacer (#1167 / UX-B1) — reserves room below the footer so
          scrolling to the true bottom of the page clears GlobalCommandBarLazy
          (fixed bottom-0) instead of it occluding the footer's last line. */}
      <div className="pb-16">
        <SiteFooter t={t} showCta />
      </div>
      <GlobalCommandBarLazy />
    </div>
  );
}
