'use client';

import { useTranslation } from '@/lib/i18n';

export function SharePageH2() {
  const { t } = useTranslation();
  return (
    <h2 className="font-heading text-xs tracking-[0.2em] uppercase text-text-secondary mb-4 animate-fade-in-up motion-reduce:animate-none [animation-delay:150ms] text-balance">
      {t('sharePage.h2') as string}
    </h2>
  );
}
