"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// next-themes@0.4 declares ThemeProvider as a const-function, not React.FC.
// React 19's stricter JSX inference drops `children` from IntrinsicAttributes
// for such signatures. Casting to `typeof NextThemesProvider` with a children-
// aware signature satisfies both the JSX transform and the type checker.
const Provider = NextThemesProvider as unknown as React.FC<
  Parameters<typeof NextThemesProvider>[0] & { children: React.ReactNode }
>;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // UX-M7 (#1173): the audience is developers and dark is the documented
  // signature look, so a first-time visitor's OS preference should decide
  // the initial theme instead of always forcing light. `enableSystem` alone
  // isn't enough — next-themes only consults `prefers-color-scheme` on a
  // first visit when `defaultTheme` is itself "system". next-themes' system
  // resolution already falls back to light when there's no OS preference, so
  // light stays the effective fallback without any extra logic here.
  return (
    <Provider attribute="data-theme" defaultTheme="system" enableSystem>
      {children}
    </Provider>
  );
}
