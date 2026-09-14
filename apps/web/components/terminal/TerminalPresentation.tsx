"use client";

import { createContext, useContext } from "react";

/** Keep fixed ink terminals legible in either page theme, without overriding
 * the page's tokens or changing the themed Studio terminal. */
export const TerminalPresentation = createContext<"themed" | "ink">("themed");

export function useInkTerminal(): boolean {
  return useContext(TerminalPresentation) === "ink";
}
