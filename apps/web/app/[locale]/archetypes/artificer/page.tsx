import { ArchetypePage } from '../_components/ArchetypePage';
import type { Metadata } from 'next';
import { getServerT } from '@/lib/i18n/server';
import type { Locale } from '@/lib/i18n/types';

// #1023 (FE-H1) — statically generated for BOTH locales (see
// app/[locale]/layout.tsx generateStaticParams). Canonical, public URL stays
// /archetypes/artificer; proxy.ts rewrites the unprefixed request here.
export const dynamic = 'force-static';
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = getServerT(locale);
  return {
    title: t('archetypes.artificer.metadataTitle') as string,
    description: t('archetypes.artificer.metadataDescription') as string,
  };
}

export default async function ArtificerPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  return <ArchetypePage archetypeKey="artificer" locale={locale} />;
}
