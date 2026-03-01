import { describe, it, expect } from "vitest";
import { seededRandom, mulberry32 } from "./prng";

describe("seededRandom", () => {
  it("returns a number between 0 and 1", () => {
    const result = seededRandom(42);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(1);
  });

  it("is deterministic for the same seed", () => {
    expect(seededRandom(123)).toBe(seededRandom(123));
  });

  it("produces different values for different seeds", () => {
    expect(seededRandom(1)).not.toBe(seededRandom(2));
  });
});

describe("mulberry32", () => {
  it("returns a generator function", () => {
    const rng = mulberry32(42);
    expect(typeof rng).toBe("function");
  });

  it("produces values between 0 and 1", () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const val = rng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it("is deterministic for the same seed", () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    for (let i = 0; i < 10; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it("produces a sequence of different values", () => {
    const rng = mulberry32(42);
    const values = new Set(Array.from({ length: 20 }, () => rng()));
    expect(values.size).toBeGreaterThan(15);
  });
});
