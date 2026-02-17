"use client";

import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from "next-themes";

// Cast needed: next-themes@0.4.6 declares ThemeProvider as a plain function
// value, not a React.FC. React 19's stricter JSX inference drops `children`
// from IntrinsicAttributes for const-function signatures. Safe because
// ThemeProviderProps extends React.PropsWithChildren.
const Provider = NextThemesProvider as React.FC<ThemeProviderProps>;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider attribute="data-theme" defaultTheme="light" enableSystem={false}>
      {children}
    </Provider>
  );
}
