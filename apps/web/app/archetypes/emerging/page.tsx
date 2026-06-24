import { ArchetypePage } from '../_components/ArchetypePage';
import type { Metadata } from 'next';
import { DEFAULT_LOCALE } from '@/lib/i18n';
import { getServerT } from '@/lib/i18n/server';

export const dynamic = 'force-static';
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const t = getServerT(DEFAULT_LOCALE);
  return {
    title: t('archetypes.emerging.metadataTitle') as string,
    description: t('archetypes.emerging.metadataDescription') as string,
  };
}

export default async function EmergingPage() {
  return <ArchetypePage archetypeKey="emerging" />;
}
