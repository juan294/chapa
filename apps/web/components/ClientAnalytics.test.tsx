// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
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

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "ClientAnalytics.tsx"),
  "utf-8",
);

describe("ClientAnalytics", () => {
  it("is a client component", () => {
    expect(SOURCE).toContain('"use client"');
  });

  it("exports a named ClientAnalytics function", () => {
    expect(SOURCE).toMatch(/export function ClientAnalytics/);
  });

  it("dynamically imports Vercel Analytics", () => {
    expect(SOURCE).toContain("@vercel/analytics/react");
  });

  it("dynamically imports Vercel SpeedInsights", () => {
    expect(SOURCE).toContain("@vercel/speed-insights/next");
  });

  it("disables SSR for analytics components", () => {
    expect(SOURCE).toContain("ssr: false");
  });

  it("renders both Analytics and SpeedInsights components", () => {
    expect(SOURCE).toContain("<Analytics />");
    expect(SOURCE).toContain("<SpeedInsights />");
  });

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
