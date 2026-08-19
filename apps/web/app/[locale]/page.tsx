import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { DEMO_STATS, DEMO_IMPACT } from "@/lib/render/demoData";
import { LandingContent } from "../LandingContent";
import { DEFAULT_LOCALE, LangSync, LanguageProvider } from "@/lib/i18n";
import { DocumentLocaleScript } from "@/lib/i18n/document-locale-script";
import { en } from "@/lib/i18n/dictionaries/en";
import { getServerT } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/types";
import type { Metadata } from "next";

// #982 / #1023 (FE-H1) — the landing page is statically generated for BOTH
// locales (see app/[locale]/layout.tsx's generateStaticParams), so it stays
// ISR/CDN-cacheable while rendering fully translated copy server-side with no
// client-side re-render/flash. The public, canonical URL stays `/` — the
// root `proxy.ts` rewrites the incoming request to this internal
// `/[locale]` route based on the `chapa-locale` cookie / Accept-Language.
export const dynamic = "force-static";
export const revalidate = 3600;

// #1065 (FE-H1) — the root layout no longer sets a blanket canonical, so
// every page (including this one) must declare its own. `/` is the one
// place a root-relative canonical is actually correct.
type HomeProps = {
  params: Promise<{ locale: Locale }>;
};

export async function generateMetadata({ params }: HomeProps): Promise<Metadata> {
  const { locale } = await params;
  const t = getServerT(locale);
  return {
    title: { absolute: t("meta.defaultTitle") as string },
    description: t("meta.defaultDescription") as string,
    alternates: {
      canonical: "/",
    },
  };
}

const demoBadgeSvg = renderBadgeSvg(DEMO_STATS, DEMO_IMPACT, {
  includeBranding: true,
  demoMode: true,
});

export default async function Home({ params }: HomeProps) {
  const { locale } = await params;
  const t = getServerT(locale);
  return (
    <>
      {/* The root layout stays static for ISR and therefore emits the default
          language. Run this parser-blocking, enum-only assignment before the
          landing content so fresh English responses expose the correct
          document language and root-level localized controls before hydration. */}
      <DocumentLocaleScript locale={locale} />
      <LanguageProvider
        initialLocale={locale}
        // The static root provider is always Spanish. A request selected from an
        // English Accept-Language header therefore needs a matching client
        // provider for the navbar, controls, and document language. Spanish can
        // reuse the root dictionary without serializing a second copy.
        dictionary={locale === DEFAULT_LOCALE ? undefined : en}
      >
        <LangSync />
        <LandingContent demoBadgeSvg={demoBadgeSvg} t={t} />
      </LanguageProvider>
    </>
  );
}
