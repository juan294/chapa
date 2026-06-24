import { DEFAULT_LOCALE } from "@/lib/i18n";
import { ScoringMethodologyClient } from "./ScoringMethodologyClient";
import { getServerT } from "@/lib/i18n/server";
import type { Metadata } from "next";

export const dynamic = "force-static";
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const t = getServerT(DEFAULT_LOCALE);
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


export default function ScoringMethodologyPage() {
  return <ScoringMethodologyClient />;
}
