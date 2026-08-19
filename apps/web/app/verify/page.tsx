import type { Metadata } from "next";
import {
  DEFAULT_LOCALE,
  LangSync,
  LanguageProvider,
} from "@/lib/i18n";
import { DocumentLocaleScript } from "@/lib/i18n/document-locale-script";
import { en } from "@/lib/i18n/dictionaries/en";
import { es } from "@/lib/i18n/dictionaries/es";
import { getServerLocale, getServerT } from "@/lib/i18n/server";
import { VerifyInputPageClient } from "./VerifyInputPageClient";

export const dynamic = "force-dynamic";

interface VerifyInputPageProps {
  searchParams?: Promise<{ lang?: string | string[] }>;
}

function queryLocale(lang: string | string[] | undefined): string | undefined {
  return typeof lang === "string" ? lang : undefined;
}

export async function generateMetadata({
  searchParams,
}: VerifyInputPageProps = {}): Promise<Metadata> {
  const { lang: rawLang } = searchParams ? await searchParams : {};
  const locale = await getServerLocale(queryLocale(rawLang));
  const t = getServerT(locale);
  return {
    title: t('verify.title') as string,
    description: t('verify.description') as string,
    robots: { index: false, follow: true },
    alternates: {
      canonical: "/verify",
    },
  };
}

export default async function VerifyInputPage({
  searchParams,
}: VerifyInputPageProps = {}) {
  const { lang: rawLang } = searchParams ? await searchParams : {};
  const locale = await getServerLocale(queryLocale(rawLang));

  return (
    <>
      <DocumentLocaleScript locale={locale} />
      <LanguageProvider
        initialLocale={locale}
        dictionary={locale === DEFAULT_LOCALE ? undefined : locale === "es" ? es : en}
      >
        <LangSync />
        <VerifyInputPageClient />
      </LanguageProvider>
    </>
  );
}
