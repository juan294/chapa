import { describe, expect, it } from "vitest";
import { createScoringWindow } from "@chapa/shared";
import { calculateCoreV7 } from "./v7";
import { WORKED_EXAMPLE_REFERENCE, workedExampleDisplay, workedExamples } from "./worked-examples";

describe("published worked examples", () => {
  it("produces every figure from the scorer, not from prose", () => {
    for (const example of workedExamples()) {
      const recomputed = calculateCoreV7({
        policyVersion: "v7",
        window: createScoringWindow(WORKED_EXAMPLE_REFERENCE),
        counts: example.inputs.counts,
      });

      expect(recomputed.core.dimensions).toEqual(example.dimensions);
      expect(recomputed.core.composite).toEqual(example.composite);
      expect(recomputed.core.tier).toBe(example.tier);
      expect(recomputed.core.archetype).toBe(example.archetype);
    }
  });

  it("shows complete evidence as points with a definite tier", () => {
    const complete = workedExampleDisplay(workedExamples().find(row => row.id === "complete")!);

    expect(complete.composite).not.toContain("–");
    expect(complete.tier).not.toBeNull();
    expect(complete.archetype).not.toBeNull();
  });

  it("shows incomplete evidence as a range that contains the complete lower bound", () => {
    const [complete, partial] = workedExamples();

    expect(partial!.composite.kind).toBe("range");
    if (partial!.composite.kind === "range" && complete!.composite.kind === "point") {
      // Missing coverage widens the interval upward; it never lowers the score.
      expect(partial!.composite.lower).toBeCloseTo(complete!.composite.value, 10);
      expect(partial!.composite.upper).toBeGreaterThan(complete!.composite.value);
    }
    expect(workedExampleDisplay(partial!).composite).toContain("–");
  });

  it("shows a truthful zero as a real point result, not as unknown", () => {
    const zero = workedExamples().find(row => row.id === "zero")!;

    expect(zero.composite).toEqual({ kind: "point", value: 0, displayValue: 0 });
    expect(zero.tier).toBe("Emerging");
    expect(workedExampleDisplay(zero).composite).toBe("0");
  });

  it("uses the real 365-day window, not an approximation", () => {
    for (const example of workedExamples()) {
      expect(example.window.calendarDays).toBe(365);
      expect(example.window.referenceTime).toBe(WORKED_EXAMPLE_REFERENCE);
    }
  });

  it("keeps the four fixed weights: the composite is the mean of the dimensions", () => {
    const complete = workedExamples().find(row => row.id === "complete")!;
    const values = Object.values(complete.dimensions).map(score => (score.kind === "point" ? score.value : score.lower));

    if (complete.composite.kind === "point") {
      expect(complete.composite.value).toBeCloseTo(values.reduce((a, b) => a + b, 0) / 4, 10);
    }
  });
});
