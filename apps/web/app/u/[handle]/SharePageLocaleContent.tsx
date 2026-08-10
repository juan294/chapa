'use client';

import { useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import { interpolate } from '@/lib/i18n/interpolate';

export function SharePageLocaleContent({
  handle,
  badgeLabelId,
}: {
  handle: string;
  badgeLabelId: string;
}) {
  const { locale, t } = useTranslation();
  const metadataTitle = interpolate(t('sharePage.metadataTitle') as string, {
    handle,
  });

  useEffect(() => {
    document.title = `@${metadataTitle} — Chapa`;
  }, [locale, metadataTitle]);

  return (
    <>
      <h1 className="sr-only">
        {interpolate(t('sharePage.srH1') as string, { handle })}
      </h1>
      <span id={badgeLabelId} className="sr-only">
        {interpolate(t('sharePage.badgeAriaLabel') as string, { handle })}
      </span>
    </>
  );
}
