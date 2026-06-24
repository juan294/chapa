import { getServerT } from "@/lib/i18n/server";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import type { Metadata } from "next";
import { TermsPageClient } from "./TermsPageClient";

export const dynamic = "force-static";
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const t = getServerT(DEFAULT_LOCALE);
  return {
    title: t('legal.terms.metadataTitle') as string,
    description: t('legal.terms.metadataDescription') as string,
    openGraph: {
      title: t('legal.terms.metadataOgTitle') as string,
      description: t('legal.terms.metadataDescription') as string,
    },
  };
}

export default function TermsPage() {
  return <TermsPageClient />;
}
