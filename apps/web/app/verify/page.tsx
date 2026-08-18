import type { Metadata } from "next";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { getServerT } from "@/lib/i18n/server";
import { VerifyInputPageClient } from "./VerifyInputPageClient";

export const dynamic = "force-static";
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const t = getServerT(DEFAULT_LOCALE);
  return {
    title: t('verify.title') as string,
    description: t('verify.description') as string,
    robots: { index: false, follow: true },
    alternates: {
      canonical: "/verify",
    },
  };
}

export default function VerifyInputPage() {
  return <VerifyInputPageClient />;
}
