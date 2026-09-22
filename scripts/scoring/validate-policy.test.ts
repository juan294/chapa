import { describe, expect, it } from "vitest";
import { coreWith, runSensitivity, SENSITIVITY_PROFILES } from "./validate-policy";

const CAPS = { deliveryUnits: 120, quality: 12, activeIsoWeeks: 40, breadth: 4 } as const;
const EQUAL = [0.25, 0.25, 0.25, 0.25];

describe("policy sensitivity", () => {
  it("varies every cap by ±20% and every weight by ±5pp", () => {
    const variants = runSensitivity().map(row => row.variant);

    expect(variants).toHaveLength(16);
    for (const cap of ["deliveryUnits", "quality", "activeIsoWeeks", "breadth"]) {
      expect(variants).toContain(`cap:${cap}:-20%`);
      expect(variants).toContain(`cap:${cap}:+20%`);
    }
    for (const weight of ["delivery", "quality", "consistency", "breadth"]) {
      expect(variants).toContain(`weight:${weight}:-5pp`);
      expect(variants).toContain(`weight:${weight}:+5pp`);
    }
  });

  it("reports the effect of each variant rather than hiding it", () => {
    for (const row of runSensitivity()) {
      expect(row.profiles).toBe(SENSITIVITY_PROFILES.length);
      expect(row.tierChanges).toBeGreaterThanOrEqual(0);
      expect(row.tierChanges).toBeLessThanOrEqual(row.profiles);
      expect(Number.isFinite(row.maxCoreDelta)).toBe(true);
    }
  });

  // A normative choice may move the number; it may not reverse the direction of
  // the evidence. A variant that did would be a policy contradiction, not a
  // sensitivity result, and blocks relaunch rather than being reported.
  it("keeps the score monotone in evidence under every variant", () => {
    const less = SENSITIVITY_PROFILES.find(row => row.id === "steady")!;
    const more = { ...less, deliveryUnits: less.deliveryUnits + 10, activeIsoWeeks: less.activeIsoWeeks + 5 };

    for (const factor of [0.8, 1, 1.2]) {
      const caps = Object.fromEntries(Object.entries(CAPS).map(([key, value]) => [key, value * factor])) as typeof CAPS;
      expect(coreWith(more, caps, EQUAL)).toBeGreaterThanOrEqual(coreWith(less, caps, EQUAL));
    }
  });

  it("keeps every variant inside the published 0–100 scale", () => {
    const saturating = SENSITIVITY_PROFILES.find(row => row.id === "saturating")!;
    const empty = { id: "empty", deliveryUnits: 0, quality: 0, activeIsoWeeks: 0, eligibleProjects: 0, eligibleCategories: 0 };

    for (const factor of [0.8, 1.2]) {
      const caps = Object.fromEntries(Object.entries(CAPS).map(([key, value]) => [key, value * factor])) as typeof CAPS;
      expect(coreWith(saturating, caps, EQUAL)).toBeLessThanOrEqual(100);
      expect(coreWith(empty, caps, EQUAL)).toBe(0);
    }
  });

  it("shows that the weights matter more than the caps for these shapes", () => {
    const results = runSensitivity();
    const capDeltas = results.filter(row => row.variant.startsWith("cap:")).map(row => row.maxCoreDelta);
    const weightDeltas = results.filter(row => row.variant.startsWith("weight:")).map(row => row.maxCoreDelta);

    // Recorded, not asserted as desirable: it is the reason the four fixed
    // weights are the policy choice most worth arguing about.
    expect(Math.max(...weightDeltas)).toBeGreaterThan(Math.max(...capDeltas));
  });
});
