"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { trackEvent } from "@/lib/analytics/posthog";

export interface SessionUser {
  login: string;
  name: string | null;
  avatar_url: string;
  isAdmin?: boolean;
}

interface UseSessionReturn {
  session: SessionUser | null;
  loading: boolean;
  invalidate: () => void;
}

/**
 * Module-level promise cache for session fetching.
 *
 * Multiple hook instances share the same in-flight fetch promise,
 * preventing redundant `/api/auth/session` requests on pages where
 * several components need session data (e.g. the share page).
 */
let cachedPromise: Promise<SessionUser | null> | null = null;

/**
 * Fetch the current session, deduplicated via the module-level promise cache.
 *
 * Exported (#1184 / FE-L6) so callers outside `useSession()` — e.g.
 * `KeyboardShortcutsListener`'s `go-profile` shortcut — share the same
 * in-flight request, cache, and `client_api_error` instrumentation instead of
 * issuing a bespoke `fetch("/api/auth/session")` that silently loses both.
 */
export function fetchSession(): Promise<SessionUser | null> {
  if (cachedPromise) return cachedPromise;

  // Bound to this specific attempt so the failure handlers below only ever
  // clear a cache entry they themselves created — an `invalidate()` (or a
  // fresh retry) that has since replaced `cachedPromise` is never clobbered.
  const promise: Promise<SessionUser | null> = fetch("/api/auth/session")
    .then((res) => {
      if (!res.ok) {
        trackEvent("client_api_error", {
          route: "/api/auth/session",
          status: res.status,
          source: "useSession",
        });
        // A non-ok response (e.g. a 429 from the fail-closed rate limiter
        // during a Redis blip) is a transport/server failure, not a genuine
        // "logged out" answer. Don't let it poison the cache permanently —
        // clear it so the next caller retries against the network instead of
        // reusing this negative result forever.
        if (cachedPromise === promise) cachedPromise = null;
        return null;
      }
      return res.json() as Promise<{ user: SessionUser | null }>;
    })
    .then((data) => (data ? (data.user ?? null) : null))
    .catch(() => {
      if (cachedPromise === promise) cachedPromise = null;
      return null;
    });

  cachedPromise = promise;
  return promise;
}

/**
 * Clear the module-level session cache.
 *
 * Call this on logout so that a subsequent login as a different user
 * does not see the previous user's session data.
 */
export function clearSessionCache(): void {
  cachedPromise = null;
}

/**
 * Shared session hook that deduplicates `/api/auth/session` fetches.
 *
 * All components calling `useSession()` share a single network request
 * via a module-level promise cache. The cache is cleared when `invalidate()`
 * is called, causing a fresh fetch on the next render cycle.
 */
export function useSession(): UseSessionReturn {
  // Every mount starts from the same hydration-safe snapshot that the server
  // renders. A module-level result may already exist because an earlier client
  // component fetched the session while a lazy subtree was still loading; using
  // that value synchronously would make the subtree's first client render differ
  // from its server HTML.
  const [session, setSession] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(false);
  const requestGenerationRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    const generation = ++requestGenerationRef.current;

    // A fulfilled cached promise still invokes this handler in a microtask, so
    // every mount keeps its hydration-neutral first render without a second
    // synchronous result cache.
    fetchSession().then((user) => {
      if (
        mountedRef.current &&
        requestGenerationRef.current === generation
      ) {
        setSession(user);
        setLoading(false);
      }
    });

    return () => {
      mountedRef.current = false;
      requestGenerationRef.current += 1;
    };
  }, []);

  const invalidate = useCallback(() => {
    const generation = ++requestGenerationRef.current;
    clearSessionCache();
    setLoading(true);

    fetchSession().then((user) => {
      if (
        mountedRef.current &&
        requestGenerationRef.current === generation
      ) {
        setSession(user);
        setLoading(false);
      }
    });
  }, []);

  return { session, loading, invalidate };
}
