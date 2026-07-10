// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import dynamic from "next/dynamic";
import { resolveDynamicLoader } from "@/lib/test-helpers/dynamic-mock";

vi.mock("next/dynamic", () => ({
  default: vi.fn(() => {
    const MockComponent = () => <div data-testid="global-command-bar" />;
    MockComponent.displayName = "DynamicMock";
    return MockComponent;
  }),
}));

import { GlobalCommandBarLazy } from "./GlobalCommandBarLazy";

afterEach(cleanup);

describe("GlobalCommandBarLazy render", () => {
  it("renders the lazy-loaded component wrapper", () => {
    render(<GlobalCommandBarLazy />);
    expect(screen.getByTestId("global-command-bar")).toBeDefined();
  });

  it("resolves the deferred loader to GlobalCommandBar", async () => {
    const { GlobalCommandBar } = await import("@/components/GlobalCommandBar");

    const resolved = await resolveDynamicLoader<typeof GlobalCommandBar>(
      dynamic,
    );

    expect(resolved).toBe(GlobalCommandBar);
  });
});
