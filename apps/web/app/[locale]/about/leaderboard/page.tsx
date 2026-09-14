import { LeaderboardPageContent } from "./LeaderboardPageContent";
import { getServerT } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/types";
import type { Metadata } from "next";

// #1023 (FE-H1) — statically generated for BOTH locales (see
// app/[locale]/layout.tsx generateStaticParams). The canonical, public URL is
// `/about/leaderboard`; proxy.ts rewrites the unprefixed request here.
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
    title: t("about.leaderboard.metadataTitle") as string,
    description: t("about.leaderboard.metadataDescription") as string,
    openGraph: {
      title: t("about.leaderboard.ogTitle") as string,
      description: t("about.leaderboard.ogDescription") as string,
    },
    twitter: {
      card: "summary",
      title: t("about.leaderboard.twitterTitle") as string,
      description: t("about.leaderboard.twitterDescription") as string,
    },
    alternates: {
      canonical: "/about/leaderboard",
    },
  };
}

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  return <LeaderboardPageContent t={getServerT(locale)} />;
}
