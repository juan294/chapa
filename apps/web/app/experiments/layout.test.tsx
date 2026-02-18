import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "layout.tsx"),
  "utf-8",
);

const mockNotFound = vi.fn();
vi.mock("next/navigation", () => ({
  notFound: (...args: unknown[]) => mockNotFound(...args),
}));

const mockIsExperimentsEnabled = vi.fn<() => Promise<boolean>>();
vi.mock("@/lib/feature-flags", () => ({
  isExperimentsEnabled: () => mockIsExperimentsEnabled(),
}));

describe("experiments layout", () => {
  beforeEach(() => {
    vi.resetModules();
    mockNotFound.mockReset();
    mockIsExperimentsEnabled.mockReset();
  });

  it("exports metadata with noindex, nofollow robots directive", async () => {
    const mod = await import("./layout");
    expect(mod.metadata).toBeDefined();
    expect(mod.metadata.robots).toEqual({
      index: false,
      follow: false,
    });
  });

  it("exports a default layout component", async () => {
    const mod = await import("./layout");
    expect(typeof mod.default).toBe("function");
  });

  it("gates on isExperimentsEnabled feature flag", () => {
    expect(SOURCE).toContain("isExperimentsEnabled");
  });

  it("calls notFound when flag is disabled", () => {
    expect(SOURCE).toContain("notFound");
  });

  it("calls notFound when experiments flag returns false", async () => {
    mockIsExperimentsEnabled.mockResolvedValue(false);
    const mod = await import("./layout");
    await mod.default({ children: null });
    expect(mockNotFound).toHaveBeenCalled();
  });

  it("renders children when experiments flag returns true", async () => {
    mockIsExperimentsEnabled.mockResolvedValue(true);
    const mod = await import("./layout");
    const result = await mod.default({ children: "test-content" });
    expect(mockNotFound).not.toHaveBeenCalled();
    expect(result).toBeTruthy();
  });
});
