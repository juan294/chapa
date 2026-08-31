"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useClientFeatureFlags } from "@/components/ClientFeatureFlagsProvider";
import { clearSessionCache } from "@/hooks/useSession";
import { clearCacheWarmState } from "@/hooks/useOwnerCacheWarm";
import { useDropdownMenu } from "@/hooks/useDropdownMenu";
import { useAnimatedUnmount } from "@/hooks/useAnimatedUnmount";
import { clearPlatformStatusCache } from "@/lib/platform/use-platform-connections";
import { useTranslation } from "@/lib/i18n";
import { interpolate } from "@/lib/i18n/interpolate";
import { GitHubIcon } from "@/components/icons";

/**
 * #1223 — the platform-connection cache, status fetching and unlink flow moved
 * to `lib/platform/use-platform-connections`, because `/settings` needs exactly
 * the same behaviour and a second copy is how the badge ended up with two
 * implementations (#1191). Re-exported here so existing importers keep working.
 *
 * #1238 — the menu no longer reads that state at all. Sign-out still clears the
 * cache, so the import (and this re-export) stay.
 */
export { clearPlatformStatusCache };

interface UserMenuProps {
  login: string;
  name: string | null;
  avatarUrl: string;
  isAdmin?: boolean;
}

export function UserMenu({ login, name, avatarUrl, isAdmin }: UserMenuProps) {
  const { studioEnabled } = useClientFeatureFlags();
  const { t } = useTranslation();
  const avatarAlt = interpolate(t('aria.avatarAlt') as string, { handle: login });
  const [imgError, setImgError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { isOpen: open, setIsOpen: setOpen } = useDropdownMenu(menuRef);
  const { shouldRender: showDropdown, isAnimatingOut: dropdownExiting } =
    useAnimatedUnmount(open, 200);

  async function handleSignOut() {
    // Clear all module-level per-user caches before navigating away.
    // This prevents the previous user's session, platform links, or
    // cache warm state from appearing when a different user logs in
    // in the same tab. (#732)
    clearSessionCache();
    clearPlatformStatusCache();
    clearCacheWarmState();
    await fetch("/api/auth/logout", { method: "POST" });
    // A full reload is intentional: it discards all client and router state
    // after the server clears the session cookie.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/";
  }

  const fallbackLetter = login.charAt(0).toUpperCase();

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t('aria.userMenu') as string}
        className="flex items-center gap-2 rounded-full border border-stroke bg-card/60 px-1.5 py-1 transition-colors hover:border-amber/20 hover:bg-card"
      >
        {imgError ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber/10 text-sm font-semibold text-amber">
            {fallbackLetter}
          </div>
        ) : (
          <Image
            src={avatarUrl}
            alt={avatarAlt}
            width={32}
            height={32}
            className="h-8 w-8 rounded-full img-outline"
            onError={() => setImgError(true)}
          />
        )}
        <span className="hidden text-sm text-text-primary sm:inline">
          {login}
        </span>
        <svg
          className={`h-4 w-4 text-text-secondary transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div
          role="menu"
          aria-label={t('aria.userMenuOptions') as string}
          className={`absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl bg-card shadow-card ${dropdownExiting ? "animate-fade-out-up" : "animate-scale-in"}`}
        >
          {/* Header */}
          <div className="border-b border-stroke px-4 py-3">
            <div className="flex items-center gap-3">
              {imgError ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber/10 text-base font-semibold text-amber">
                  {fallbackLetter}
                </div>
              ) : (
                <Image
                  src={avatarUrl}
                  alt={avatarAlt}
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full img-outline"
                  onError={() => setImgError(true)}
                />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-primary">
                  {name || login}
                </p>
                <p className="truncate text-xs text-text-secondary">
                  @{login}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation. #1238 — account actions are not here any more; the
              Settings link below is the way to them. */}
          <div className="px-2 py-1.5">
            <Link
              href={`/u/${login}`}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-text-primary transition-colors hover:bg-amber/[0.06]"
            >
              <GitHubIcon className="h-4 w-4 text-text-secondary" />
              {t('userMenu.myBadge') as string}
            </Link>
            {studioEnabled && (
              <Link
                href="/studio"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-text-primary transition-colors hover:bg-amber/[0.06]"
              >
                <svg
                  className="h-4 w-4 text-text-secondary"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 3l1.912 5.813h6.088l-4.956 3.574 1.912 5.813L12 14.626 7.044 18.2l1.912-5.813L4 8.813h6.088z" />
                </svg>
                {t('userMenu.creatorStudio') as string}
              </Link>
            )}
            {/* #1223 gave account actions a real page; #1238 removed the
                copies that stayed behind in this menu. Connections and the
                insights import live on /settings only. */}
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-text-primary transition-colors hover:bg-amber/[0.06]"
            >
              <svg
                className="h-4 w-4 text-text-secondary"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 008 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 8a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
              {t('settings.settingsLink') as string}
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-text-primary transition-colors hover:bg-amber/[0.06]"
              >
                <svg
                  className="h-4 w-4 text-text-secondary"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                {t('userMenu.adminPanel') as string}
              </Link>
            )}
          </div>

          <div className="mx-3 border-t border-stroke" />

          {/* Sign out */}
          <div className="px-2 py-1.5">
            <form method="POST" action="/api/auth/logout" onSubmit={(e) => { e.preventDefault(); void handleSignOut(); }}>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-amber/[0.06] hover:text-text-primary"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
                {t('userMenu.signOut') as string}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
