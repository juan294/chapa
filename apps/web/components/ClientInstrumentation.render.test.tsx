// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import dynamic from "next/dynamic";

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

  it("resolves the deferred loader to PostHogInit", async () => {
    await import("./ClientInstrumentation");
    const { PostHogInit } = await import("@/components/PostHogProvider");

    const call = vi.mocked(dynamic).mock.calls[0];
    if (!call) throw new Error("dynamic() was not called");
    const loader = call[0] as () => Promise<{ default: typeof PostHogInit }>;
    const resolved = await loader();

    expect(resolved.default).toBe(PostHogInit);
  });
});
