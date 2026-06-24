import { DEFAULT_LOCALE } from "@/lib/i18n";
import { VerificationPageClient } from "./VerificationPageClient";
import { getServerT } from "@/lib/i18n/server";
import type { Metadata } from "next";

export const dynamic = "force-static";
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const t = getServerT(DEFAULT_LOCALE);
  return {
    title: t('about.verification.metadataTitle') as string,
    description: t('about.verification.metadataDescription') as string,
    openGraph: {
      title: t('about.verification.ogTitle') as string,
      description: t('about.verification.ogDescription') as string,
    },
    twitter: {
      card: "summary",
      title: t('about.verification.twitterTitle') as string,
      description: t('about.verification.twitterDescription') as string,
    },
  };
}


export default function VerificationPage() {
  return <VerificationPageClient />;
}
