// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("next/font/google", () => ({
  JetBrains_Mono: () => ({ variable: "font-jetbrains" }),
  Plus_Jakarta_Sans: () => ({ variable: "font-jakarta" }),
}));

vi.mock("@/components/ClientInstrumentation", () => ({
  ClientInstrumentation: () => <div data-testid="instrumentation" />,
}));

vi.mock("@/components/ThemeProvider", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="theme-provider">{children}</div>
  ),
}));

vi.mock("@/components/ClientFeatureFlagsProvider", () => ({
  ClientFeatureFlagsProvider: ({
    children,
    studioEnabled,
  }: {
    children: React.ReactNode;
    studioEnabled: boolean;
  }) => (
    <div data-testid="feature-flags" data-studio={String(studioEnabled)}>
      {children}
    </div>
  ),
}));

vi.mock("@/lib/env", () => ({
  getBaseUrl: () => "https://chapa.example",
}));

const mockIsStudioEnabledSync = vi.fn(() => true);
vi.mock("@/lib/feature-flags-sync", () => ({
  isStudioEnabledSync: () => mockIsStudioEnabledSync(),
}));

vi.mock("@/lib/jsonld", () => ({
  renderJsonLd: vi.fn(() => '{"@type":"SoftwareApplication"}'),
}));

vi.mock("@/lib/i18n/server", () => ({
  getServerLocale: vi.fn().mockResolvedValue("es"),
  getServerT: vi.fn().mockImplementation(() => (key: string) => key),
}));
vi.mock("@/lib/i18n", () => ({
  LanguageProvider: ({
    children,
    initialLocale,
  }: {
    children: React.ReactNode;
    initialLocale: string;
  }) => (
    <div data-testid="language-provider" data-locale={initialLocale}>
      {children}
    </div>
  ),
  LangSync: () => null,
}));

describe("RootLayout render", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsStudioEnabledSync.mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders providers, skip link, children, and instrumentation", async () => {
    const { default: RootLayout } = await import("./layout");

    render(
      await RootLayout({
        children: <main id="main-content">Child route</main>,
      }),
    );

    expect(screen.getByText("Skip to main content")).toBeTruthy();
    expect(screen.getByTestId("theme-provider")).toBeTruthy();
    expect(
      screen.getByTestId("feature-flags").getAttribute("data-studio"),
    ).toBe("true");
    expect(screen.getByText("Child route")).toBeTruthy();
    expect(screen.getByTestId("instrumentation")).toBeTruthy();
  });

  it('renders with lang=DEFAULT_LOCALE ("es") at build time for ISR compatibility', async () => {
    // The layout uses DEFAULT_LOCALE at build time instead of getServerLocale()
    // to avoid cookies()/headers() calls that would force every page into dynamic rendering.
    // Client-side locale detection (LangSync + LanguageProvider) handles actual user locale.
    const { default: RootLayout } = await import("./layout");
    const element = await RootLayout({ children: <span>test</span> });

    // html lang is always DEFAULT_LOCALE ("es") at build time
    expect(element.props.lang).toBe("es");
  });

  it("wraps children in LanguageProvider", async () => {
    const { default: RootLayout } = await import("./layout");

    render(
      await RootLayout({
        children: <main id="main-content">Child route</main>,
      }),
    );

    expect(screen.getByTestId("language-provider")).toBeTruthy();
  });

  it("LanguageProvider receives DEFAULT_LOCALE as initialLocale (ISR-safe build-time default)", async () => {
    const { default: RootLayout } = await import("./layout");

    render(await RootLayout({ children: <span>content</span> }));

    // Always "es" (DEFAULT_LOCALE) at build time — client-side hydration handles actual locale
    expect(
      screen.getByTestId("language-provider").getAttribute("data-locale"),
    ).toBe("es");
  });
});
