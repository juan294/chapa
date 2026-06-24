import { DEFAULT_LOCALE } from "@/lib/i18n";
import { getServerT } from "@/lib/i18n/server";

export default function PrivacyLoading() {
  const t = getServerT(DEFAULT_LOCALE);
  const loading = t("common.loading") as string;
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6" role="status" aria-label={loading}>
      <span className="sr-only">{loading}</span>
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 h-8 w-8 animate-pulse rounded-full bg-amber/20" />
        <p className="font-heading text-sm text-text-secondary">{loading}</p>
      </div>
    </main>
  );
}
