"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface UserMenuProps {
  login: string;
  name: string | null;
  avatarUrl: string;
}

export function UserMenu({ login, name, avatarUrl }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const fallbackLetter = login.charAt(0).toUpperCase();

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="User menu"
        className="flex items-center gap-2 rounded-full border border-warm-stroke bg-warm-card/60 px-1.5 py-1 transition-colors hover:border-amber/20 hover:bg-warm-card"
      >
        {imgError ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber/10 text-sm font-semibold text-amber">
            {fallbackLetter}
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={avatarUrl}
            alt={`${login}'s avatar`}
            width={32}
            height={32}
            className="h-8 w-8 rounded-full"
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
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-warm-stroke bg-warm-card shadow-2xl shadow-black/50 animate-scale-in"
        >
          {/* Header */}
          <div className="border-b border-warm-stroke px-4 py-3">
            <div className="flex items-center gap-3">
              {imgError ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber/10 text-base font-semibold text-amber">
                  {fallbackLetter}
                </div>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={avatarUrl}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full"
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

          {/* Your Badge */}
          <div className="px-2 py-1.5">
            <Link
              href={`/u/${login}`}
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
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M7 12h10M7 8h10M7 16h6" />
              </svg>
              Your Badge
            </Link>
          </div>

          <div className="mx-3 border-t border-warm-stroke" />

          {/* Links */}
          <div className="px-2 py-1.5">
            <Link
              href="/about"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-amber/[0.06] hover:text-text-primary"
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
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
              About Chapa
            </Link>
            <Link
              href="/terms"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-amber/[0.06] hover:text-text-primary"
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
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
              </svg>
              Terms of Service
            </Link>
            <Link
              href="/privacy"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-amber/[0.06] hover:text-text-primary"
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
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Privacy Policy
            </Link>
          </div>

          <div className="mx-3 border-t border-warm-stroke" />

          {/* Sign out */}
          <div className="px-2 py-1.5">
            <a
              href="/api/auth/logout"
              role="menuitem"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-amber/[0.06] hover:text-text-primary"
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
              Sign out
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
