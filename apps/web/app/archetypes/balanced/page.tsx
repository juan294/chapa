import { ArchetypePage } from '../_components/ArchetypePage';
import type { Metadata } from 'next';
import { getServerT } from '@/lib/i18n/server';
import { DEFAULT_LOCALE } from '@/lib/i18n/types';

export const revalidate = 3600;
export const dynamic = 'force-static';

export function generateMetadata(): Metadata {
  const t = getServerT(DEFAULT_LOCALE);
  return {
    title: t('archetypes.balanced.metadataTitle') as string,
    description: t('archetypes.balanced.metadataDescription') as string,
  };
}

export default async function BalancedPage() {
  return <ArchetypePage archetypeKey="balanced" />;
}
