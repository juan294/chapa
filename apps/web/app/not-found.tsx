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
      <h1 className="font-heading text-6xl font-bold text-amber">404</h1>
      <p className="mt-4 text-lg text-text-primary">{t('notFound.title') as string}</p>
      <p className="mt-2 text-sm text-text-secondary">
        {t('notFound.description') as string}
      </p>
      <Link
        href="/"
        className="mt-8 rounded-lg border border-amber/20 bg-amber/10 px-6 py-2.5 text-sm font-medium text-amber transition-colors hover:bg-amber/20"
      >
        {t('notFound.cta') as string}
      </Link>
    </main>
  );
}
