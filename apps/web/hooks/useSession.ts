"use client";

import { useState, useEffect, useCallback } from "react";

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
let cachedResult: SessionUser | null | undefined = undefined;

function fetchSession(): Promise<SessionUser | null> {
  if (cachedPromise) return cachedPromise;

  cachedPromise = fetch("/api/auth/session")
    .then((res) => res.json())
    .then((data: { user: SessionUser | null }) => {
      cachedResult = data.user ?? null;
      return cachedResult;
    })
    .catch(() => {
      cachedResult = null;
      return null;
    });

  return cachedPromise;
}

/**
 * Shared session hook that deduplicates `/api/auth/session` fetches.
 *
 * All components calling `useSession()` share a single network request
 * via a module-level promise cache. The cache is cleared when `invalidate()`
 * is called, causing a fresh fetch on the next render cycle.
 */
export function useSession(): UseSessionReturn {
  const [session, setSession] = useState<SessionUser | null>(() => {
    // If we already have a cached result, use it synchronously
    return cachedResult !== undefined ? cachedResult : null;
  });
  const [loading, setLoading] = useState<boolean>(() => {
    return cachedResult === undefined;
  });

  useEffect(() => {
    // If cached result is already available, the useState initializers
    // have already set the correct values — no fetch needed.
    if (cachedResult !== undefined) return;

    let cancelled = false;

    fetchSession().then((user) => {
      if (!cancelled) {
        setSession(user);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const invalidate = useCallback(() => {
    cachedPromise = null;
    cachedResult = undefined;
    setLoading(true);

    fetchSession().then((user) => {
      setSession(user);
      setLoading(false);
    });
  }, []);

  return { session, loading, invalidate };
}

/**
 * Reset the module-level cache. Exported for testing only.
 * @internal
 */
export function _resetSessionCache(): void {
  cachedPromise = null;
  cachedResult = undefined;
}
