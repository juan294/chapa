// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

type NextThemesProviderProps = {
  attribute?: string;
  defaultTheme?: string;
  enableSystem?: boolean;
  children: React.ReactNode;
};

const nextThemesProviderMock = vi.fn((props: NextThemesProviderProps) => (
  <div data-testid="theme-provider">{props.children}</div>
));

vi.mock("next-themes", () => ({
  ThemeProvider: (props: NextThemesProviderProps) => nextThemesProviderMock(props),
}));

import { ThemeProvider } from "./ThemeProvider";

afterEach(cleanup);

describe("ThemeProvider render", () => {
  it("renders children", () => {
    render(
      <ThemeProvider>
        <span>child content</span>
      </ThemeProvider>,
    );
    expect(screen.getByText("child content")).toBeDefined();
  });

  // Design system contract (docs/design-system.md): theme switching is
  // powered by next-themes with attribute="data-theme" — every color token
  // in globals.css is keyed off this attribute, so a wrong value here would
  // silently break theming site-wide with no render-visible symptom (the
  // mocked child still renders either way).
  //
  // UX-M7 (#1173): the audience is developers and dark is the documented
  // signature look, so first-time visitors should get their OS preference
  // (enableSystem) rather than being forced to light. defaultTheme="system"
  // is required alongside enableSystem — next-themes only consults the OS
  // preference on a first visit when defaultTheme itself is "system"; a
  // defaultTheme of "light" would keep enableSystem from ever mattering on
  // first paint. next-themes' own system-resolution already falls back to
  // light when prefers-color-scheme reports no preference, so no extra
  // fallback logic is needed here.
  it("configures next-themes with the app's data-theme attribute and OS-preference detection (light as the resolved no-preference fallback)", () => {
    render(
      <ThemeProvider>
        <span>child content</span>
      </ThemeProvider>,
    );
    expect(nextThemesProviderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        attribute: "data-theme",
        defaultTheme: "system",
        enableSystem: true,
      }),
    );
  });
});
