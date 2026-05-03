"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

export default function PrivacyError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation();
  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 text-center"
    >
      <h1 className="font-heading text-4xl font-bold text-amber">
        {t('errors.general.title') as string}
      </h1>
      <p className="mt-4 text-sm text-text-secondary">
        {t('errors.general.description') as string}
      </p>
      <div className="mt-8 flex items-center gap-4">
        <button
          onClick={reset}
          className="rounded-lg border border-amber/20 bg-amber/10 px-6 py-2.5 text-sm font-medium text-amber transition-colors hover:bg-amber/20"
        >
          {t('common.tryAgain') as string}
        </button>
        <Link
          href="/"
          className="rounded-lg border border-stroke px-6 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:border-amber/20 hover:text-text-primary"
        >
          {t('common.goHome') as string}
        </Link>
      </div>
    </main>
  );
}
