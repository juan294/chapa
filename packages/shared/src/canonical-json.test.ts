import { describe, expect, it } from "vitest";
import { canonicalJson, canonicalSha256 } from "./canonical-json";
describe("canonical-json-v1", () => {
  it("sorts UTF-16 keys, preserves Unicode and normalizes negative zero", async () => {
    expect(canonicalJson({ z: -0, a: ["é", 1e-7] })).toBe('{"a":["é",1e-7],"z":0}');
    expect(await canonicalSha256({ b: 2, a: 1 })).toEqual(await canonicalSha256({ a: 1, b: 2 }));
  });
  it("rejects lossy/non-JSON values and cycles", () => {
    const cycle: Record<string, unknown> = {}; cycle.x = cycle;
    for (const value of [undefined, NaN, Infinity, 1n, new Date(), new Map(), [undefined], Array(1), { x: undefined }, "\ud800", cycle, { get x() { return 1; } }]) expect(() => canonicalJson(value)).toThrow();
  });
});
