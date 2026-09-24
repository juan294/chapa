import { ScoringMethodologyContent } from "./ScoringMethodologyContent";
import { getServerT } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/types";
import type { Metadata } from "next";

// #1335 — v7.2 is the one scoring policy; the selector this page used to
// read is retired. `force-dynamic` is kept unchanged pending a separate
// decision on whether this route can revert to static generation now that
// its content no longer depends on a live per-request selection.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = getServerT(locale);
  const title = t("about.scoringObserved.metadataTitle") as string;
  const description = t("about.scoringObserved.metadataDescription") as string;
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: "summary", title, description },
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
  return <ScoringMethodologyContent t={t} observed={true} />;
}
