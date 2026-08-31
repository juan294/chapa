import type { ReactNode } from "react";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, isSupportedLocale, type Locale } from "@/lib/i18n/types";
import { DocumentLocaleMarker } from "@/lib/i18n/document-locale";

/**
 * Generates both supported locale variants at build time for every page
 * nested under this `[locale]` segment (Next.js applies a single
 * `generateStaticParams` per dynamic segment across the whole subtree, so
 * this one definition covers all 9 migrated content pages — no need to
 * repeat it in each page.tsx). This is what actually eliminates the locale
 * flash (#1023 / FE-H1): both `/es/...` and `/en/...` variants exist as
 * pre-rendered static output, so the `proxy.ts` rewrite always resolves
 * to a cache hit — no client-side re-render after hydration.
 */
export function generateStaticParams(): { locale: Locale }[] {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

// Only the two supported locales are ever pre-rendered. Reject any other
// `:locale` value at request time instead of falling back to on-demand
// dynamic rendering — the only legitimate way to reach this segment is via
// the `proxy.ts` rewrite, which only ever emits 'es' or 'en'.
export const dynamicParams = false;

/**
 * Hosts `generateStaticParams` for the locale-segmented content-page
 * rewrite, plus (#1165 / FE-M1) an early `<html lang>` assignment for the
 * route's own resolved locale. The real HTML shell (<html>, <body>,
 * ThemeProvider, LanguageProvider, feature flags) stays in the root
 * `app/layout.tsx`, unchanged and still statically rendered at
 * DEFAULT_LOCALE ('es') — so a genuine `/en/*` request would otherwise ship
 * English body copy inside `<html lang="es">` in the served HTML. Only the
 * landing page (`/[locale]/page.tsx`) and the two `/verify` pages emitted
 * this before; hoisting it here covers all 9 migrated content pages
 * (`/about`, `/privacy`, `/terms`, `/archetypes/*`, etc.) in one edit.
 *
 * `params` is awaited here just like `generateMetadata`/the page components
 * under this segment already do (e.g. `app/[locale]/about/page.tsx`) — since
 * `generateStaticParams` above pre-renders both locale values at build time
 * and `dynamicParams = false` rejects any other value at request time, this
 * does NOT introduce a request-time read or opt these pages out of
 * `force-static` (verified via the production build's prerender output).
 *
 * Next's generated `LayoutProps<"/[locale]">` types `params.locale` as a
 * bare `string` (unlike the page-level `PageProps` types under this same
 * segment, which the sibling `page.tsx` files narrow to `Locale` directly) —
 * so this narrows it explicitly via `isSupportedLocale` rather than casting.
 * The `DEFAULT_LOCALE` fallback branch is unreachable in practice: only
 * `proxy.ts` ever routes here, and only with 'es' or 'en'.
 */
export default async function LocaleSegmentLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isSupportedLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  return (
    <>
      <DocumentLocaleMarker locale={locale} />
      {children}
    </>
  );
}
