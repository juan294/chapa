import { describe, expect, it } from "vitest";
import { TIERS } from "./tier-data";

describe("illustrative tier fixtures", () => {
  it("keeps sample numbers inside their labelled unrounded tier", () => {
    const bands = { Emerging: [0, 30], Solid: [30, 70], High: [70, 85], Elite: [85, 101] } as const;
    for (const sample of TIERS) {
      const [minimum, maximum] = bands[sample.tier];
      expect(sample.score).toBeGreaterThanOrEqual(minimum);
      expect(sample.score).toBeLessThan(maximum);
    }
  });
});
