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
  // powered by next-themes with attribute="data-theme" and
  // defaultTheme="light" — every color token in globals.css is keyed off
  // this attribute, so a wrong value here would silently break theming
  // site-wide with no render-visible symptom (the mocked child still
  // renders either way).
  it("configures next-themes with the app's data-theme attribute, light default, and no OS-preference override", () => {
    render(
      <ThemeProvider>
        <span>child content</span>
      </ThemeProvider>,
    );
    expect(nextThemesProviderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        attribute: "data-theme",
        defaultTheme: "light",
        enableSystem: false,
      }),
    );
  });
});
