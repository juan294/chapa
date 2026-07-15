import type { ReactNode } from "react";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/types";

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
 * Pure pass-through — this segment exists only to host `generateStaticParams`
 * for the locale-segmented content-page rewrite. The real HTML shell
 * (<html>, <body>, ThemeProvider, LanguageProvider, feature flags) stays in
 * the root `app/layout.tsx`, unchanged.
 */
export default function LocaleSegmentLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
