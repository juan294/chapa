// Server component (no client hooks) — a route loading.tsx is Next's
// Suspense fallback and must render without waiting on client JS. The i18n
// text is resolved at DEFAULT_LOCALE ('es'), matching this page's own
// `force-static` + `getServerT(DEFAULT_LOCALE)` approach (`app/verify/page.tsx`)
// rather than the real-locale-detecting getServerLocale() used by dynamic routes.
import { DEFAULT_LOCALE } from "@/lib/i18n/types";
import { getServerT } from "@/lib/i18n/server";

const t = getServerT(DEFAULT_LOCALE);

export default function VerifyLoading() {
  const loadingText = t("common.loading") as string;
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6" role="status" aria-label={t("aria.loading") as string}>
      <span className="sr-only">{loadingText}</span>
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 h-8 w-8 animate-pulse rounded-full bg-amber/20" />
        <p className="font-heading text-sm text-text-secondary">{loadingText}</p>
      </div>
    </main>
  );
}
