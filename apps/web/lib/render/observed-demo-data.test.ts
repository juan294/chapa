import { expect, it } from "vitest";
import { LANDING_OBSERVED_DEMO, STUDIO_OBSERVED_DEMO } from "./observed-demo-data";
it.each([[LANDING_OBSERVED_DEMO, 92, 92], [STUDIO_OBSERVED_DEMO, 82, 72]] as const)("uses calculated, explicitly illustrative sample values without publication identity", (model, core, craft) => {
  expect(model.illustrative).toBe(true);
  expect(model.policyVersion).toBe("v7.2");
  expect(model.identity).toBeNull();
  expect(model.composite.kind).toBe("point");
  if (model.composite.kind !== "point") throw new Error("Expected point");
  expect(model.composite.display).toBe(core);
  const values = Object.values(model.dimensions).map(value => { if (value.kind !== "point") throw new Error("Expected point"); return value.value; });
  expect(model.composite.value).toBe(values.reduce((sum, value) => sum + value, 0) / 4);
  expect(model.reportCraft).toMatchObject({ status: "scored", report: { result: { point: { displayValue: craft } } } });
  expect(model.archetype).toBe("Balanced");
});
