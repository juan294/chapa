import { ArchetypePage } from '../_components/ArchetypePage';
import type { Metadata } from 'next';
import { getServerLocale, getServerT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string>> }): Promise<Metadata> {
  const locale = await getServerLocale((await searchParams).lang);
  const t = getServerT(locale);
  return {
    title: t('archetypes.artificer.metadataTitle') as string,
    description: t('archetypes.artificer.metadataDescription') as string,
  };
}

export default async function ArtificerPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return <ArchetypePage archetypeKey="artificer" searchParams={searchParams} />;
}
