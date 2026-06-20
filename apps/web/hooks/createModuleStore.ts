"use client";

import { useSyncExternalStore } from "react";

/**
 * A small module-level store primitive.
 *
 * Consolidates the recurring "module-level state + subscriber set +
 * getSnapshot + a React hook via `useSyncExternalStore`" pattern that was
 * previously hand-rolled in several places (#774). Create one store per module
 * at import time, then read it reactively from components via `useStore()` or
 * imperatively via `getSnapshot()` / `set()`.
 *
 * The store is intentionally minimal — it holds a single value of type `T`.
 * Callers that need richer state model it as an object value and replace it
 * wholesale with `set()`.
 */
export interface ModuleStore<T> {
  /** Current value (synchronous, for use outside React and in snapshots). */
  getSnapshot: () => T;
  /** Snapshot used during SSR / the first hydration render. */
  getServerSnapshot: () => T;
  /** Replace the value and notify all subscribers. */
  set: (value: T) => void;
  /** Subscribe to changes. Returns an unsubscribe function. */
  subscribe: (callback: () => void) => () => void;
  /** React hook returning the current value, re-rendering on change. */
  useStore: () => T;
}

interface CreateModuleStoreOptions<T> {
  /**
   * Value returned by `getServerSnapshot` (SSR / first hydration render).
   * Defaults to the initial value when omitted.
   */
  serverSnapshot?: T;
}

export function createModuleStore<T>(
  initialValue: T,
  options: CreateModuleStoreOptions<T> = {},
): ModuleStore<T> {
  let value = initialValue;
  const serverValue =
    "serverSnapshot" in options
      ? (options.serverSnapshot as T)
      : initialValue;
  const subscribers = new Set<() => void>();

  const getSnapshot = (): T => value;
  const getServerSnapshot = (): T => serverValue;

  const set = (next: T): void => {
    value = next;
    for (const cb of subscribers) {
      cb();
    }
  };

  const subscribe = (callback: () => void): (() => void) => {
    subscribers.add(callback);
    return () => {
      subscribers.delete(callback);
    };
  };

  const useStore = (): T =>
    useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return { getSnapshot, getServerSnapshot, set, subscribe, useStore };
}
