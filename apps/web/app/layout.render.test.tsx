// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
// layout.tsx reads DEFAULT_LOCALE from "@/lib/i18n/types", NOT from the mocked
// "@/lib/i18n" barrel below, so these assert against the real value (#1201).
import { DEFAULT_LOCALE } from "@/lib/i18n/types";
import { DOCUMENT_LOCALE_BOOTSTRAP } from "@/lib/i18n/document-locale-bootstrap";

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
    flags,
  }: {
    children: React.ReactNode;
    flags: { studioEnabled: boolean; webmcpEnabled: boolean };
  }) => (
    <div
      data-testid="feature-flags"
      data-studio={String(flags.studioEnabled)}
      data-webmcp={String(flags.webmcpEnabled)}
    >
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
  isInsightsEnabledSync: () => false,
  isBitbucketEnabledSync: () => false,
  isCodebergEnabledSync: () => false,
  isGitlabEnabledSync: () => false,
}));

vi.mock("@/lib/feature-flags", () => ({
  isStudioEnabled: () => Promise.resolve(mockIsStudioEnabledSync()),
  isWebmcpEnabled: () => Promise.resolve(true),
  isInsightsEnabled: () => Promise.resolve(false),
  isBitbucketEnabled: () => Promise.resolve(false),
  isCodebergEnabled: () => Promise.resolve(false),
  isGitlabEnabled: () => Promise.resolve(false),
}));

vi.mock("@/lib/jsonld", () => ({
  renderJsonLd: vi.fn(() => '{"@type":"SoftwareApplication"}'),
}));

vi.mock("@/lib/i18n/server", () => ({
  getServerLocale: vi.fn().mockResolvedValue("es"),
  getServerT: vi.fn().mockImplementation(() => (key: string) => key),
}));
vi.mock("@/lib/i18n", () => ({
  DEFAULT_LOCALE: "es",
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

    // Root-level copy sits outside per-page locale providers. Both supported
    // labels are present and CSS selects the one matching <html lang> after a
    // locale-segmented page synchronizes the document language.
    const spanishSkip = screen.getByText("Saltar al contenido principal");
    const englishSkip = screen.getByText("Skip to main content");
    expect(spanishSkip.getAttribute("lang")).toBe("es");
    expect(spanishSkip.getAttribute("data-document-locale")).toBe("es");
    expect(englishSkip.getAttribute("lang")).toBe("en");
    expect(englishSkip.getAttribute("data-document-locale")).toBe("en");
    expect(screen.getByTestId("theme-provider")).toBeTruthy();
    expect(
      screen.getByTestId("feature-flags").getAttribute("data-studio"),
    ).toBe("true");
    expect(
      screen.getByTestId("feature-flags").getAttribute("data-webmcp"),
    ).toBe("true");
    expect(screen.getByText("Child route")).toBeTruthy();
    expect(screen.getByTestId("instrumentation")).toBeTruthy();
    expect(
      document.querySelector(
        `template[data-chapa-document-locale="${DEFAULT_LOCALE}"]`,
      ),
    ).not.toBeNull();
  });

  it("renders with lang=DEFAULT_LOCALE at build time for ISR compatibility", async () => {
    // The layout uses DEFAULT_LOCALE at build time instead of getServerLocale()
    // to avoid dynamic cookie/header calls that would force every page into dynamic rendering.
    // Client-side locale detection (LangSync + LanguageProvider) handles actual user locale.
    const { default: RootLayout } = await import("./layout");
    const element = await RootLayout({ children: <span>test</span> });

    // html lang is always DEFAULT_LOCALE at build time
    expect(element.props.lang).toBe(DEFAULT_LOCALE);
  });

  it("mounts the initial locale bootstrap before hydration", async () => {
    const { default: RootLayout } = await import("./layout");
    const element = await RootLayout({ children: <span>test</span> });
    const body = element.props.children as ReactElement<{ children: ReactNode }>;
    const bootstrap = Children.toArray(body.props.children).find(
      (child) =>
        isValidElement<{ id?: string }>(child) &&
        child.props.id === "chapa-document-locale",
    );

    expect(bootstrap).toBeDefined();
    expect(
      (bootstrap as ReactElement<{ strategy: string }>).props.strategy,
    ).toBe("beforeInteractive");
    expect(
      (bootstrap as ReactElement<{ children: string }>).props.children,
    ).toBe(DOCUMENT_LOCALE_BOOTSTRAP);
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

    // Always DEFAULT_LOCALE at build time — client-side hydration handles actual locale
    expect(
      screen.getByTestId("language-provider").getAttribute("data-locale"),
    ).toBe(DEFAULT_LOCALE);
  });
});
