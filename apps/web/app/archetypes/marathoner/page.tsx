import { ArchetypePage } from '../_components/ArchetypePage';
import type { Metadata } from 'next';
import { getServerLocale, getServerT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = getServerT(locale);
  return {
    title: t('archetypes.marathoner.metadataTitle') as string,
    description: t('archetypes.marathoner.metadataDescription') as string,
  };
}

export default async function MarathonerPage() {
  return <ArchetypePage archetypeKey="marathoner" />;
}
