import Link from "next/link";
import { getServerLocale, getServerT } from "@/lib/i18n/server";

export default async function NotFound() {
  const locale = await getServerLocale();
  const t = getServerT(locale);

  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 text-center"
    >
      <h1 className="font-heading text-6xl font-bold text-amber-text">404</h1>
      <p className="mt-4 text-lg text-text-primary">{t('notFound.title') as string}</p>
      <p className="mt-2 text-sm text-text-secondary">
        {t('notFound.description') as string}
      </p>
      {/* #1218 — two ways out, not one. A visitor who landed here from a badge
          link wants the verify page at least as often as the home page. */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center rounded-[3px] border border-action bg-action px-6 font-heading text-sm font-medium text-action-text transition-colors hover:bg-action-hover"
        >
          {t('notFound.cta') as string}
        </Link>
        <Link
          href="/verify"
          className="inline-flex min-h-[44px] items-center rounded-[3px] border border-complement-text px-6 font-heading text-sm font-medium text-complement-text transition-colors hover:bg-purple-tint focus-visible:outline-complement-text!"
        >
          {t('notFound.ctaVerify') as string}
        </Link>
      </div>
    </main>
  );
}
