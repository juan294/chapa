// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/ClientAnalytics", () => ({
  ClientAnalytics: () => <div data-testid="client-analytics" />,
}));

vi.mock("next/dynamic", () => ({
  default: vi.fn(
    (
      _loader: () => Promise<{ default: React.ComponentType }>,
      opts?: { ssr?: boolean },
    ) =>
      function DynamicPostHogMock() {
        return (
          <div data-testid="posthog-init" data-ssr={String(opts?.ssr)} />
        );
      },
  ),
}));

describe("ClientInstrumentation render", () => {
  it("renders deferred PostHog init and analytics islands", async () => {
    const { ClientInstrumentation } = await import("./ClientInstrumentation");

    render(<ClientInstrumentation />);

    expect(screen.getByTestId("posthog-init").getAttribute("data-ssr")).toBe(
      "false",
    );
    expect(screen.getByTestId("client-analytics")).toBeTruthy();
  });
});
