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

  // Arrow key navigation for menu items (W9)
  useEffect(() => {
    if (!open || !menuRef.current) return;
    function handleMenuKeyDown(e: KeyboardEvent) {
      const items = Array.from(
        menuRef.current?.querySelectorAll('[role="menuitem"]') ?? [],
      ) as HTMLElement[];
      if (items.length === 0) return;
      const currentIndex = items.indexOf(document.activeElement as HTMLElement);

      let nextIndex = -1;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        nextIndex = (currentIndex + 1) % items.length;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        nextIndex = (currentIndex - 1 + items.length) % items.length;
      } else if (e.key === "Home") {
        e.preventDefault();
        nextIndex = 0;
      } else if (e.key === "End") {
        e.preventDefault();
        nextIndex = items.length - 1;
      }
      if (nextIndex >= 0) {
        items[nextIndex].focus();
      }
    }
    document.addEventListener("keydown", handleMenuKeyDown);
    return () => document.removeEventListener("keydown", handleMenuKeyDown);
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
        className="flex items-center gap-2 rounded-full border border-stroke bg-card/60 px-1.5 py-1 transition-colors hover:border-amber/20 hover:bg-card"
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
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-stroke bg-card shadow-xl shadow-stroke animate-scale-in"
        >
          {/* Header */}
          <div className="border-b border-stroke px-4 py-3">
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

          {/* Your Badge + Creator Studio */}
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
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
              Your Badge
            </Link>
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
              Creator Studio
            </Link>
          </div>

          <div className="mx-3 border-t border-stroke" />

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

          <div className="mx-3 border-t border-stroke" />

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
