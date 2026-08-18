import { getServerLocale, getServerT } from "@/lib/i18n/server";
import { LocaleSync } from "@/lib/i18n";
import type { Metadata } from "next";

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ lang?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { lang } = await searchParams;
  const locale = await getServerLocale(lang);
  const t = getServerT(locale);
  return {
    title: t('comingSoon.metadataTitle') as string,
    robots: { index: false, follow: false },
    alternates: {
      canonical: "/coming-soon",
    },
  };
}

export default async function ComingSoonPage({ searchParams }: Props) {
  const { lang } = await searchParams;
  const locale = await getServerLocale(lang);
  const t = getServerT(locale);

  return (
    <>
      <LocaleSync queryLang={lang} />
      <main id="main-content" className="flex min-h-screen flex-col items-center justify-center bg-bg px-6">
        <div className="max-w-md text-center">
          {/* Logo */}
          <h1 className="font-heading text-4xl font-bold tracking-tight text-text-primary">
            {t('comingSoon.brand') as string}
            <span className="animate-cursor-blink text-amber">_</span>
          </h1>

          {/* Terminal prompt */}
          <div className="mt-8 font-heading text-sm">
            <p className="text-text-secondary">
              {t('comingSoon.terminalCommand') as string}
            </p>
            <p className="mt-2 text-amber">{t('comingSoon.message') as string}</p>
          </div>

          {/* Tagline */}
          <p className="mt-6 text-sm leading-relaxed text-text-secondary">
            {t('comingSoon.tagline') as string}
          </p>
        </div>
      </main>
    </>
  );
}
