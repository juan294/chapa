"use client";

import { useMemo } from "react";
import { useSession } from "@/hooks/useSession";
import { useTranslation } from "@/lib/i18n";
import { tArray } from "@/lib/i18n/typed-accessors";
import { NavbarShell } from "./NavbarShell";

interface NavLinkItem {
  label: string;
  href: string;
}

/**
 * Client-side Navbar variant for ISR-compatible pages.
 *
 * Unlike the server-side Navbar (which reads session via `headers()`),
 * this component uses the shared `useSession()` hook which fetches
 * `/api/auth/session` once and shares the result across all consumers.
 * This avoids calling `headers()` in the render tree, allowing Next.js
 * to serve the page via ISR (Incremental Static Regeneration).
 *
 * Rendering itself is delegated to `NavbarShell` so this variant and the
 * server-side `Navbar` never drift in markup (#1025). While the session
 * fetch is in flight, `NavbarShell` renders a neutral placeholder in the
 * auth slot rather than the logged-out UI, to avoid a login-link flash on
 * these ISR pages (#1025 / FE-L2).
 */

export function NavbarClient({
  navLinks,
  translationKey = 'landing.navLinks',
}: {
  navLinks?: NavLinkItem[];
  /**
   * Dictionary key to re-derive nav links from on every render (#1167 /
   * UX-B1). Defaults to `landing.navLinks` — the landing page's own
   * hash-anchor links (`#features`, etc.), which only make sense scrolled
   * within that page. Inner pages (share page, verify pages) pass
   * `"nav.innerLinks"` (real routes: `/about`, `/about/scoring`, `/verify`)
   * here so they don't inherit the landing page's meaningless-off-page
   * anchors.
   */
  translationKey?: string;
}) {
  const { session, loading } = useSession();
  const { t } = useTranslation();

  // Use the active locale's translation for labels so locale switches (via
  // LanguageProvider's cookie read on mount or LanguageSwitcher) update the
  // center nav. The navLinks prop is a presence signal ("show center nav here")
  // and a last-resort fallback if t() returns an empty array.
  const resolvedNavLinks = useMemo<NavLinkItem[] | undefined>(() => {
    if (!navLinks || navLinks.length === 0) return undefined;
    const localeLinks = tArray<NavLinkItem>(t, translationKey);
    if (localeLinks.length > 0) return localeLinks;
    return navLinks;
  }, [navLinks, t, translationKey]);

  return (
    <NavbarShell
      navLinks={resolvedNavLinks}
      session={session}
      isAdmin={session?.isAdmin ?? false}
      loading={loading}
      t={t}
    />
  );
}
