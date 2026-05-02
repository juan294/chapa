// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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

vi.mock("@/lib/feature-flags", () => ({
  isStudioEnabled: vi.fn(async () => true),
}));

vi.mock("@/lib/jsonld", () => ({
  renderJsonLd: vi.fn(() => '{"@type":"SoftwareApplication"}'),
}));

describe("RootLayout render", () => {
  it("renders providers, skip link, children, and instrumentation", async () => {
    const { default: RootLayout } = await import("./layout");

    render(
      await RootLayout({
        children: <main id="main-content">Child route</main>,
      }),
    );

    expect(screen.getByText("Skip to main content")).toBeTruthy();
    expect(screen.getByTestId("theme-provider")).toBeTruthy();
    expect(screen.getByTestId("feature-flags").getAttribute("data-studio")).toBe(
      "true",
    );
    expect(screen.getByText("Child route")).toBeTruthy();
    expect(screen.getByTestId("instrumentation")).toBeTruthy();
  });
});
