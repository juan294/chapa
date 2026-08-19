import type { Locale } from "./types";

/**
 * Synchronize the static root layout's document language before page content
 * is parsed. The value is restricted to the supported Locale union.
 */
export function DocumentLocaleScript({ locale }: { locale: Locale }) {
  return (
    <script
      data-chapa-document-locale={locale}
      dangerouslySetInnerHTML={{
        __html: `document.documentElement.lang=${JSON.stringify(locale)};`,
      }}
    />
  );
}
