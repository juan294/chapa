import { describe, it, expect, vi } from "vitest";

vi.mock("@/components/GlobalCommandBar", () => ({
  GlobalCommandBar: () => null,
}));

describe("coming-soon page", () => {
  it("exports metadata with noindex robots directive", async () => {
    const mod = await import("./page");
    expect(mod.metadata).toBeDefined();
    expect(mod.metadata.robots).toEqual({ index: false, follow: false });
  });

  it("exports a default component", async () => {
    const mod = await import("./page");
    expect(typeof mod.default).toBe("function");
  });
});
