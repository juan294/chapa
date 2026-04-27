import { describe, expect, it } from "vitest";
import { CACHE_VERSION } from "./version";

describe("CACHE_VERSION", () => {
  it("is a monotonically increasing integer string", () => {
    expect(CACHE_VERSION).toMatch(/^v\d+$/);
  });
});
