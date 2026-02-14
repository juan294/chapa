import { describe, it, expect } from "vitest";

describe("experiments layout", () => {
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
});
