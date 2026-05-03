"use client";

import { useTranslation } from "@/lib/i18n";

export default function AboutLoading() {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6" role="status" aria-label={t('common.loading') as string}>
      <span className="sr-only">{t('common.loading') as string}</span>
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 h-8 w-8 animate-pulse rounded-full bg-amber/20" />
        <p className="font-heading text-sm text-text-secondary">{t('common.loading') as string}</p>
      </div>
    </main>
  );
}
