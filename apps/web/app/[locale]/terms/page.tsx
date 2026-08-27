import { NavbarClient } from "@/components/NavbarClient";
import { GlobalCommandBarLazy } from "@/components/GlobalCommandBarLazy";
import { SiteFooter } from "@/components/SiteFooter";
import { getServerT } from "@/lib/i18n/server";
import { tArray } from "@/lib/i18n/typed-accessors";
import type { Locale } from "@/lib/i18n/types";
import type { Metadata } from "next";

// #1023 (FE-H1) — statically generated for BOTH locales (see
// app/[locale]/layout.tsx generateStaticParams). Canonical, public URL stays
// `/terms`; proxy.ts rewrites the unprefixed request here.
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
    title: t('legal.terms.metadataTitle') as string,
    description: t('legal.terms.metadataDescription') as string,
    openGraph: {
      title: t('legal.terms.metadataOgTitle') as string,
      description: t('legal.terms.metadataDescription') as string,
    },
    alternates: {
      canonical: "/terms",
    },
  };
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = getServerT(locale);
  const sections = tArray<{ heading: string; body: string }>(t, 'legal.terms.sections');

  return (
    <div className="min-h-screen bg-bg">
      <NavbarClient />
      <main id="main-content" className="relative mx-auto max-w-3xl px-6 pt-32 pb-24">
        <div className="relative">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight mb-8 animate-fade-in-up">
            {t('legal.terms.h1Before') as string}<span className="text-amber">{t('legal.terms.h1Highlight') as string}</span>
          </h1>
          <div className="space-y-6 text-text-secondary leading-relaxed animate-fade-in-up [animation-delay:150ms]">
            <p className="text-xs text-text-secondary/60">
              {t('legal.terms.lastUpdated') as string}
            </p>
            {sections.map((section, i) => (
              <div key={i}>
                <h2 className="font-heading text-xl font-semibold text-text-primary tracking-tight pt-4">
                  {section.heading}
                </h2>
                <p>
                  {section.body}
                  {i === sections.length - 1 && (
                    <a
                      href={`mailto:${t('legal.terms.contactEmail') as string}`}
                      className="text-amber hover:text-amber-light transition-colors"
                    >
                      {t('legal.terms.contactEmail') as string}
                    </a>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>
      {/* pb-16 spacer (#1167 / UX-B1) — reserves room below the footer so
          scrolling to the true bottom of the page clears GlobalCommandBarLazy
          (fixed bottom-0) instead of it occluding the footer's last line. */}
      <div className="pb-16">
        <SiteFooter t={t} />
      </div>
      <GlobalCommandBarLazy />
    </div>
  );
}
