import { VerificationPageContent } from "./VerificationPageContent";
import { getServerT } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/types";
import type { Metadata } from "next";

// #1023 (FE-H1) — statically generated for BOTH locales (see
// app/[locale]/layout.tsx generateStaticParams). Canonical, public URL stays
// `/about/verification` (badge-verification EXPLAINER — distinct from
// `/verify`, the verification tool/flow, which is out of scope for this
// migration); proxy.ts rewrites the unprefixed request here.
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

export default async function VerificationPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = getServerT(locale);
  return <VerificationPageContent t={t} />;
}
