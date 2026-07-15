import { ScoringMethodologyContent } from "./ScoringMethodologyContent";
import { getServerT } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/types";
import type { Metadata } from "next";

// #1023 (FE-H1) — statically generated for BOTH locales (see
// app/[locale]/layout.tsx generateStaticParams). Canonical, public URL stays
// `/about/scoring`; proxy.ts rewrites the unprefixed request here.
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
    title: t('about.scoring.metadataTitle') as string,
    description: t('about.scoring.metadataDescription') as string,
    openGraph: {
      title: t('about.scoring.ogTitle') as string,
      description: t('about.scoring.ogDescription') as string,
    },
    twitter: {
      card: "summary",
      title: t('about.scoring.twitterTitle') as string,
      description: t('about.scoring.twitterDescription') as string,
    },
  };
}

export default async function ScoringMethodologyPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = getServerT(locale);
  return <ScoringMethodologyContent t={t} />;
}
