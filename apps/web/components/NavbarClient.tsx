"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { UserMenu } from "./UserMenu";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Client-side Navbar variant for ISR-compatible pages.
 *
 * Unlike the server-side Navbar (which reads session via `headers()`),
 * this component fetches session from `/api/auth/session` on mount.
 * This avoids calling `headers()` in the render tree, allowing Next.js
 * to serve the page via ISR (Incremental Static Regeneration).
 */

interface SessionUser {
  login: string;
  name: string | null;
  avatar_url: string;
}

export function NavbarClient() {
  const [session, setSession] = useState<SessionUser | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data: { user: SessionUser | null }) => {
        if (data.user) {
          setSession(data.user);
        }
      })
      .catch(() => {
        // Session fetch failed — show logged-out state
      });
  }, []);

  return (
    <nav aria-label="Main navigation" className="fixed top-0 z-50 w-full border-b border-stroke bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        {/* Left: Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="font-heading text-lg tracking-tight text-text-primary">
            Chapa<span className="text-amber animate-cursor-blink">_</span>
          </span>
        </Link>

        {/* Right: Theme toggle + User or login */}
        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          {session ? (
            <UserMenu
              login={session.login}
              name={session.name}
              avatarUrl={session.avatar_url}
            />
          ) : (
            <a
              href="/api/auth/login"
              className="font-heading text-sm text-terminal-dim transition-colors hover:text-amber"
            >
              <span className="text-amber/50">/</span> login
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}
