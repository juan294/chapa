import { getServerT } from "@/lib/i18n/server";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import type { Metadata } from "next";
import { PrivacyPageClient } from "./PrivacyPageClient";

export const dynamic = "force-static";
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const t = getServerT(DEFAULT_LOCALE);
  return {
    title: t('legal.privacy.metadataTitle') as string,
    description: t('legal.privacy.metadataDescription') as string,
    openGraph: {
      title: t('legal.privacy.metadataOgTitle') as string,
      description: t('legal.privacy.metadataDescription') as string,
    },
  };
}

export default function PrivacyPage() {
  return <PrivacyPageClient />;
}
