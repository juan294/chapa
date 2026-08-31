"use client";

import { useLayoutEffect } from "react";
import { isSupportedLocale, type Locale } from "./types";
import { DOCUMENT_LOCALE_SELECTOR } from "./document-locale-constants";

function syncFromLastMarker() {
  const markers = document.querySelectorAll(DOCUMENT_LOCALE_SELECTOR);
  const locale = markers
    .item(markers.length - 1)
    ?.getAttribute("data-chapa-document-locale");
  if (isSupportedLocale(locale)) {
    document.documentElement.lang = locale;
  }
}

/**
 * Declare the locale owned by this route without client-rendering executable
 * script content. The root bootstrap observes this inert marker on the initial
 * server stream; the layout effect handles later React navigation.
 */
export function DocumentLocaleMarker({ locale }: { locale: Locale }) {
  useLayoutEffect(() => {
    document.documentElement.lang = locale;
    return () => queueMicrotask(syncFromLastMarker);
  }, [locale]);

  return <template data-chapa-document-locale={locale} />;
}
