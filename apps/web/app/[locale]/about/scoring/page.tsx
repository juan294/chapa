import { cache } from "react";
import { readScoringRenderSelection } from "@/lib/scoring-render-selection";
import { ScoringMethodologyContent } from "./ScoringMethodologyContent";
import { getServerT } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/types";
import type { Metadata } from "next";

// Policy selection must stay live; an hour-long static page could describe
// archived arithmetic beside a current observed profile.
export const dynamic = "force-dynamic";
const selectedPolicy = cache(() => readScoringRenderSelection());

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = getServerT(locale);
  const selection = await selectedPolicy();
  const observedTitle = t("about.scoringObserved.metadataTitle") as string;
  const observedDescription = t("about.scoringObserved.metadataDescription") as string;
  return {
    title: selection.enabled ? observedTitle : t('about.scoring.metadataTitle') as string,
    description: selection.enabled ? observedDescription : t('about.scoring.metadataDescription') as string,
    openGraph: {
      title: selection.enabled ? observedTitle : t('about.scoring.ogTitle') as string,
      description: selection.enabled ? observedDescription : t('about.scoring.ogDescription') as string,
    },
    twitter: {
      card: "summary",
      title: selection.enabled ? observedTitle : t('about.scoring.twitterTitle') as string,
      description: selection.enabled ? observedDescription : t('about.scoring.twitterDescription') as string,
    },
    alternates: {
      canonical: "/about/scoring",
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
  const selection = await selectedPolicy();
  return <ScoringMethodologyContent t={t} observed={selection.enabled} />;
}
