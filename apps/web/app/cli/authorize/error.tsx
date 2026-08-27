"use client";

import Link from "next/link";
import { StatusCallout } from "@/components/StatusCallout";
import { useTranslation } from "@/lib/i18n";
import { useErrorBoundaryReport } from "@/lib/analytics/use-error-boundary-report";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useErrorBoundaryReport(error, "cli-authorize-error");
  const { t } = useTranslation();
  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 text-center"
    >
      <StatusCallout
        variant="error"
        title={t('cliAuthorize.errorBoundaryHeading') as string}
        titleAs="h1"
        description={t('cliAuthorize.errorBoundaryBody') as string}
        className="w-full max-w-xl text-left"
      />
      <div className="mt-8 flex items-center gap-4">
        <button
          onClick={reset}
          className="rounded-lg border border-terminal-red/30 bg-terminal-red/10 px-6 py-2.5 text-sm font-medium text-terminal-red transition-colors hover:bg-terminal-red/20"
        >
          {t('common.tryAgain') as string}
        </button>
        <Link
          href="/"
          className="rounded-lg border border-stroke px-6 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:border-terminal-red/30 hover:text-text-primary"
        >
          {t('common.goHome') as string}
        </Link>
      </div>
    </main>
  );
}
