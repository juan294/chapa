import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n/types";
import type { NavLinkItem } from "@/components/NavbarShell";
import { DEFAULT_LOCALE, LanguageProvider } from "@/lib/i18n";
import { DocumentLocaleMarker } from "@/lib/i18n/document-locale";
import { en } from "@/lib/i18n/dictionaries/en";
import { es } from "@/lib/i18n/dictionaries/es";
import { Navbar } from "@/components/Navbar";

interface DynamicRouteShellProps {
  /**
   * The route's resolved locale. Every caller already computes this (usually
   * via `getServerLocale`), and passing it in keeps this component from
   * becoming a second, competing source of truth.
   */
  locale: Locale;
  navLinks?: NavLinkItem[];
  children: ReactNode;
}

/**
 * The three things a dynamic route needs together, so it gets all three or
 * none (#1194 / FE-S1).
 *
 * The root layout is static: it cannot read cookies or headers, so it pins the
 * locale at `DEFAULT_LOCALE` (#861, which is what keeps ISR alive) and sources
 * no session. Every dynamic route therefore needs three separate corrections —
 * the server `Navbar` for session, `DocumentLocaleMarker` for the `<html lang>`
 * attribute, and a nested `LanguageProvider` for the real dictionary.
 *
 * Choosing those three by hand, per page, is what this fixes. Before it, the
 * decision was recorded in prose comments rather than derived from anything a
 * compiler or test could check, and it was made inconsistently twice: FE-H2
 * (the share page used the ISR navbar variant on a dynamic route) and FE-M1
 * (9 of 12 locale-aware routes lacked the `lang` correction). `/studio`,
 * `/admin` and `/settings` were still missing both locale corrections when this
 * component was written — they rendered in `DEFAULT_LOCALE` for every visitor.
 *
 * **This component reads request state, so a STATIC page must never use it.**
 * Importing it into an ISR content page under `app/[locale]/` would silently
 * convert that page to dynamic rendering and destroy the CDN caching the
 * #982/#1023 work exists to preserve. `DynamicRouteShell.boundary.test.ts`
 * fails if any `app/[locale]/` file imports it. Static pages keep
 * `NavbarClient`, which is exactly why that variant exists (#1025).
 */
export function DynamicRouteShell({
  locale,
  navLinks,
  children,
}: DynamicRouteShellProps) {
  return (
    <>
      <DocumentLocaleMarker locale={locale} />
      <LanguageProvider
        initialLocale={locale}
        // #1071 — the root layout's LanguageProvider already serializes the
        // DEFAULT_LOCALE dictionary into the RSC payload. Passing `undefined`
        // when this route matches it reuses that ancestor copy instead of
        // shipping the same dictionary twice.
        //
        // #1201 — the other branch must be derived from `locale`, never
        // hardcoded to one dictionary. A bare `en` here was correct only while
        // the default was Spanish.
        dictionary={
          locale === DEFAULT_LOCALE ? undefined : locale === "es" ? es : en
        }
      >
        <Navbar locale={locale} navLinks={navLinks} />
        {children}
      </LanguageProvider>
    </>
  );
}
