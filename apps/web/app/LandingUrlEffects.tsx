"use client";

import { useSyncExternalStore } from "react";
import { LocaleSync } from "@/lib/i18n";
import { ErrorBanner } from "@/components/ErrorBanner";
import { getOAuthErrorMessage } from "@/lib/auth/error-messages";

const EMPTY_SUBSCRIBE = () => () => {};

/**
 * Reads the current URL query string client-side without triggering a
 * hydration mismatch: the server snapshot is empty (matching the
 * statically-prerendered HTML) and the client snapshot reads
 * `window.location.search` after hydration. The query string only changes
 * via navigation (which remounts), so no live subscription is needed.
 */
function useLocationSearch(): string {
  return useSyncExternalStore(
    EMPTY_SUBSCRIBE,
    () => window.location.search,
    () => "",
  );
}

/**
 * Applies the `error` and `lang` query params client-side instead of via
 * server-side searchParams, so the landing page stays statically renderable /
 * ISR-cacheable (#982). This is the one genuinely-interactive leaf on an
 * otherwise fully server-rendered, locale-segmented landing page (#1023 /
 * FE-H1): the bulk of the page's copy is now translated server-side via
 * `getServerT(locale)` with no flash, but the OAuth error banner and a
 * same-request `?lang=` override still require a client-side read of
 * `window.location.search` — reading them via server `searchParams` would
 * force this route back to dynamic rendering, which the #982 static/ISR
 * requirement (still binding) rules out. The OAuth error banner therefore
 * still appears after hydration on the rare post-redirect path — an
 * accepted trade for keeping the highest-traffic route on the CDN.
 */
export function LandingUrlEffects() {
  const params = new URLSearchParams(useLocationSearch());
  const lang = params.get("lang") ?? undefined;
  const errorMessage = getOAuthErrorMessage(params.get("error"));

  return (
    <>
      <LocaleSync queryLang={lang} />
      {errorMessage && <ErrorBanner message={errorMessage} />}
    </>
  );
}
