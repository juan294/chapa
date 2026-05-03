import { ArchetypePage } from '../_components/ArchetypePage';
import type { Metadata } from 'next';
import { getServerLocale, getServerT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string>> }): Promise<Metadata> {
  const locale = await getServerLocale((await searchParams).lang);
  const t = getServerT(locale);
  return {
    title: t('archetypes.builder.metadataTitle') as string,
    description: t('archetypes.builder.metadataDescription') as string,
  };
}

export default async function BuilderPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return <ArchetypePage archetypeKey="builder" searchParams={searchParams} />;
}
