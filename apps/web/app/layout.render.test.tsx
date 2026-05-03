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

const mockIsStudioEnabled = vi.fn(async () => true);
vi.mock("@/lib/feature-flags", () => ({
  isStudioEnabled: () => mockIsStudioEnabled(),
}));

vi.mock("@/lib/jsonld", () => ({
  renderJsonLd: vi.fn(() => '{"@type":"SoftwareApplication"}'),
}));

const mockGetServerLocale = vi.fn(async (): Promise<"en" | "es"> => "en");
vi.mock("@/lib/i18n/server", () => ({
  getServerLocale: () => mockGetServerLocale(),
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
    mockIsStudioEnabled.mockResolvedValue(true);
    mockGetServerLocale.mockImplementation(async () => "en");
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

  it('renders with lang="es" when locale resolves to es', async () => {
    mockGetServerLocale.mockImplementation(async () => "es");

    const { default: RootLayout } = await import("./layout");
    const element = await RootLayout({ children: <span>test</span> });

    // The html element is the root — check its lang prop
    expect(element.props.lang).toBe("es");
  });

  it('renders with lang="en" when no cookie and no relevant Accept-Language', async () => {
    mockGetServerLocale.mockImplementation(async () => "en");

    const { default: RootLayout } = await import("./layout");
    const element = await RootLayout({ children: <span>test</span> });

    expect(element.props.lang).toBe("en");
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

  it("LanguageProvider receives the resolved locale as initialLocale", async () => {
    mockGetServerLocale.mockImplementation(async () => "es");

    const { default: RootLayout } = await import("./layout");

    render(await RootLayout({ children: <span>content</span> }));

    expect(
      screen.getByTestId("language-provider").getAttribute("data-locale"),
    ).toBe("es");
  });
});
