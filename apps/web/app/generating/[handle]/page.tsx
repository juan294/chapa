import { notFound } from "next/navigation";
import { isValidHandle } from "@/lib/validation";
import { getServerLocale, getServerT } from "@/lib/i18n/server";
import { GeneratingProgress } from "./GeneratingProgress";
import type { Metadata } from "next";

export const dynamic = 'force-dynamic';

interface GeneratingPageProps {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ lang?: string }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: GeneratingPageProps): Promise<Metadata> {
  const { handle } = await params;
  const { lang } = await searchParams;
  const locale = await getServerLocale(lang);
  const t = getServerT(locale);
  return {
    title: `${t('generation.metadataTitle') as string} — @${handle}`,
    robots: { index: false },
  };
}

export default async function GeneratingPage({ params }: GeneratingPageProps) {
  const { handle } = await params;

  if (!isValidHandle(handle)) {
    notFound();
  }

  return <GeneratingProgress handle={handle} />;
}
