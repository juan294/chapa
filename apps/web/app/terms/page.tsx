import { Navbar } from "@/components/Navbar";
import { GlobalCommandBarLazy } from "@/components/GlobalCommandBarLazy";
import { getServerLocale, getServerT } from "@/lib/i18n/server";
import { LocaleSync } from "@/lib/i18n";
import type { Metadata } from "next";

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}): Promise<Metadata> {
  const locale = await getServerLocale((await searchParams).lang);
  const t = getServerT(locale);
  return {
    title: t('legal.terms.metadataTitle') as string,
    description: t('legal.terms.metadataDescription') as string,
    openGraph: {
      title: t('legal.terms.metadataOgTitle') as string,
      description: t('legal.terms.metadataDescription') as string,
    },
  };
}

export default async function TermsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const resolvedParams = await searchParams;
  const locale = await getServerLocale(resolvedParams.lang);
  const t = getServerT(locale);
  const sections = t('legal.terms.sections') as Array<{ heading: string; body: string }>;

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <LocaleSync queryLang={resolvedParams.lang} />
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
      <GlobalCommandBarLazy />
    </div>
  );
}
