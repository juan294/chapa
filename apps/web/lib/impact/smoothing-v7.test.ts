import { describe, expect, it } from "vitest";
import { calculateTrendV7 } from "./smoothing";
import type { TrendAnchor, PublicScoringReceipt } from "@chapa/shared";
const prior: TrendAnchor = { policyVersion: "v7", referenceDate: "2026-09-01", receiptRevisionId: "prior", rawPoint: 60, unroundedValue: 60, previousAnchorRevisionId: null };
function receipt(date: string, value: number): Pick<PublicScoringReceipt, "policyVersion" | "revisionId" | "window" | "core" | "action"> {
  return { policyVersion: "v7", action: "create", revisionId: "current", window: { referenceDate: date } as PublicScoringReceipt["window"], core: { composite: { kind: "point", value, displayValue: Math.round(value) } } as PublicScoringReceipt["core"] };
}
describe("v7 unrounded trend", () => {
  it("uses elapsed UTC days and repeats from the same prior-day anchor", () => {
    const current = receipt("2026-09-04", 70);
    const result = calculateTrendV7(current, prior);
    expect(result.status).toBe("point");
    if (result.status === "point") expect(result.anchor.unroundedValue).toBeCloseTo(0.85 ** 3 * 60 + (1 - 0.85 ** 3) * 70, 12);
    expect(calculateTrendV7(current, prior)).toEqual(result);
    expect(() => calculateTrendV7(current, { ...prior, referenceDate: "2026-09-04" })).toThrow();
  });
  it("converges without integer stalling and never smooths ranges", () => {
    let previous = prior;
    for (let day = 2; day < 29; day++) {
      const result = calculateTrendV7(receipt(`2026-09-${String(day).padStart(2, "0")}`, 70), previous);
      if (result.status !== "point") throw new Error("Expected point");
      previous = result.anchor;
    }
    expect(previous.unroundedValue).toBeGreaterThan(69.8);
    const range = receipt("2026-09-29", 70);
    Object.assign(range.core, { composite: { kind: "range", lower: 60, upper: 80, displayLower: 60, displayUpper: 80 } });
    expect(calculateTrendV7(range, previous)).toEqual({ status: "gap", referenceDate: "2026-09-29", reason: "range" });
    expect(calculateTrendV7({ ...receipt("2026-09-30", 70), action: "retract" }, previous)).toEqual({ status: "gap", referenceDate: "2026-09-30", reason: "missing" });
    expect(calculateTrendV7(receipt("2026-09-30", 70), null)).toMatchObject({ anchor: { unroundedValue: 70 } });
  });
});
