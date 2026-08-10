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

function fetchSession(): Promise<SessionUser | null> {
  if (cachedPromise) return cachedPromise;

  cachedPromise = fetch("/api/auth/session")
    .then((res) => {
      if (!res.ok) {
        trackEvent("client_api_error", {
          route: "/api/auth/session",
          status: res.status,
          source: "useSession",
        });
        return { user: null };
      }
      return res.json() as Promise<{ user: SessionUser | null }>;
    })
    .then((data: { user: SessionUser | null }) => {
      return data.user ?? null;
    })
    .catch(() => null);

  return cachedPromise;
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
