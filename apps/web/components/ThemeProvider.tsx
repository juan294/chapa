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
  return (
    <Provider attribute="data-theme" defaultTheme="light" enableSystem={false}>
      {children}
    </Provider>
  );
}
