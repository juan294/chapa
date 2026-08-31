import { SUPPORTED_LOCALES } from "./types";
import {
  DOCUMENT_LOCALE_ATTRIBUTE,
  DOCUMENT_LOCALE_SELECTOR,
} from "./document-locale-constants";

/**
 * Synchronize route markers while the initial HTML stream is parsed. The
 * observer disconnects at DOMContentLoaded; hydrated markers take over client
 * navigation after that point.
 */
export const DOCUMENT_LOCALE_BOOTSTRAP = `
(() => {
  const attribute = ${JSON.stringify(DOCUMENT_LOCALE_ATTRIBUTE)};
  const selector = ${JSON.stringify(DOCUMENT_LOCALE_SELECTOR)};
  const supportedLocales = ${JSON.stringify(SUPPORTED_LOCALES)};

  const sync = () => {
    const markers = document.querySelectorAll(selector);
    const marker = markers.item(markers.length - 1);
    const locale = marker?.getAttribute(attribute);
    if (supportedLocales.includes(locale)) {
      document.documentElement.lang = locale;
    }
  };

  const containsMarker = (node) =>
    node.nodeType === 1 &&
    (node.matches(selector) || node.querySelector(selector));

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes") {
        sync();
        return;
      }
      for (const node of record.addedNodes) {
        if (containsMarker(node)) {
          sync();
          return;
        }
      }
      for (const node of record.removedNodes) {
        if (containsMarker(node)) {
          sync();
          return;
        }
      }
    }
  });

  sync();
  if (document.readyState === "loading") {
    observer.observe(document.documentElement, {
      attributeFilter: [attribute],
      attributes: true,
      childList: true,
      subtree: true,
    });
    document.addEventListener("DOMContentLoaded", () => observer.disconnect(), {
      once: true,
    });
  }

  return observer;
})();`;
