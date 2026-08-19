// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const dynamicLoaders = vi.hoisted(() => [] as Array<() => Promise<unknown>>);

vi.mock("next/dynamic", () => ({
  default: vi.fn(
    (
      loader: () => Promise<{ default: React.ComponentType }>,
      opts?: { ssr?: boolean },
    ) => {
      dynamicLoaders.push(loader);
      return function DynamicAnalyticsMock() {
        return (
          <div
            data-testid="dynamic-analytics"
            data-ssr={String(opts?.ssr)}
          />
        );
      };
    },
  ),
}));

describe("ClientAnalytics", () => {
  it("renders both dynamic analytics islands", async () => {
    const { ClientAnalytics } = await import("./ClientAnalytics");

    render(<ClientAnalytics />);

    const islands = screen.getAllByTestId("dynamic-analytics");
    expect(islands).toHaveLength(2);
    expect(islands[0]!.getAttribute("data-ssr")).toBe("false");
    expect(islands[1]!.getAttribute("data-ssr")).toBe("false");
  });

  it("resolves the dynamic analytics component loaders", async () => {
    await import("./ClientAnalytics");

    await expect(Promise.all(dynamicLoaders.map((loader) => loader()))).resolves.toHaveLength(2);
  });
});
