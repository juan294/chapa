import { describe, it, expect } from "vitest";
import { formatCompact } from "./format";

describe("formatCompact", () => {
  it("returns '0' for 0", () => {
    expect(formatCompact(0)).toBe("0");
  });

  it("returns exact number for values < 1000", () => {
    expect(formatCompact(1)).toBe("1");
    expect(formatCompact(42)).toBe("42");
    expect(formatCompact(999)).toBe("999");
  });

  it("formats thousands with one decimal", () => {
    expect(formatCompact(1000)).toBe("1k");
    expect(formatCompact(1234)).toBe("1.2k");
    expect(formatCompact(9999)).toBe("10k");
    expect(formatCompact(15700)).toBe("15.7k");
  });

  it("drops .0 for even thousands", () => {
    expect(formatCompact(2000)).toBe("2k");
    expect(formatCompact(50000)).toBe("50k");
  });

  it("formats millions with one decimal", () => {
    expect(formatCompact(1000000)).toBe("1M");
    expect(formatCompact(1500000)).toBe("1.5M");
    expect(formatCompact(2300000)).toBe("2.3M");
  });

  it("drops .0 for even millions", () => {
    expect(formatCompact(3000000)).toBe("3M");
  });

  it("handles negative values as 0", () => {
    expect(formatCompact(-5)).toBe("0");
  });
});
