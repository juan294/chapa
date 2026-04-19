"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * Returns true once the component has hydrated on the client.
 * Returns false on the server and during the initial client render,
 * ensuring SSR and client output are identical (no hydration mismatch).
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
