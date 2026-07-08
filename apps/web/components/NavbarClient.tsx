"use client";

import { useMemo } from "react";
import Link from "next/link";
import { UserMenu } from "./UserMenu";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { NavLink } from "./NavLink";
import { MobileNav } from "./MobileNav";
import { useSession } from "@/hooks/useSession";
import { useTranslation } from "@/lib/i18n";
import { tArray } from "@/lib/i18n/typed-accessors";

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
 */

export function NavbarClient({ navLinks }: { navLinks?: NavLinkItem[] }) {
  const { session } = useSession();
  const { t } = useTranslation();

  // Use the active locale's translation for labels so locale switches (via
  // LanguageProvider's cookie read on mount or LanguageSwitcher) update the
  // center nav. The navLinks prop is a presence signal ("show center nav here")
  // and a last-resort fallback if t() returns an empty array.
  const resolvedNavLinks = useMemo<NavLinkItem[] | undefined>(() => {
    if (!navLinks || navLinks.length === 0) return undefined;
    const localeLinks = tArray<NavLinkItem>(t, 'landing.navLinks');
    if (localeLinks.length > 0) return localeLinks;
    return navLinks;
  }, [navLinks, t]);

  return (
    <nav suppressHydrationWarning aria-label={t('aria.mainNavigation') as string} className="fixed top-0 z-50 w-full border-b border-stroke bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        {/* Left: Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="font-heading text-lg tracking-tight text-text-primary">
            Chapa<span className="text-amber animate-cursor-blink">_</span>
          </span>
        </Link>

        {/* Center: Command hints (desktop) */}
        {resolvedNavLinks && (
          <div className="hidden md:flex items-center gap-4 font-heading text-xs text-terminal-dim">
            {resolvedNavLinks.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                label={link.label}
                className="transition-colors hover:text-text-secondary"
              />
            ))}
          </div>
        )}

        {/* Mobile nav toggle */}
        {resolvedNavLinks && (
          <MobileNav links={resolvedNavLinks} />
        )}

        {/* Right: Language switcher + Theme toggle + User or login */}
        <div className="flex items-center gap-1 sm:gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          {session ? (
            <UserMenu
              login={session.login}
              name={session.name}
              avatarUrl={session.avatar_url}
              isAdmin={session.isAdmin}
            />
          ) : (
            <a
              suppressHydrationWarning
              href="/api/auth/login"
              className="font-heading text-sm text-terminal-dim transition-colors hover:text-amber"
            >
              <span className="text-amber/50">/</span> {t('common.login') as string}
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}
