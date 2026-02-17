import { describe, it, expect } from "vitest";
import { STUDIO_PRESETS } from "./defaults";
import type { StudioPreset } from "./defaults";

describe("effects/defaults", () => {
  describe("STUDIO_PRESETS", () => {
    it("is an array", () => {
      expect(Array.isArray(STUDIO_PRESETS)).toBe(true);
    });

    it("has at least one preset", () => {
      expect(STUDIO_PRESETS.length).toBeGreaterThan(0);
    });

    it("each preset has required fields", () => {
      for (const preset of STUDIO_PRESETS) {
        expect(typeof preset.id).toBe("string");
        expect(typeof preset.label).toBe("string");
        expect(preset.id.length).toBeGreaterThan(0);
        expect(preset.label.length).toBeGreaterThan(0);
        expect(preset.config).toBeDefined();
      }
    });

    it("each preset config has all 9 badge config keys", () => {
      const requiredKeys = [
        "background",
        "cardStyle",
        "border",
        "scoreEffect",
        "heatmapAnimation",
        "interaction",
        "statsDisplay",
        "tierTreatment",
        "celebration",
      ];
      for (const preset of STUDIO_PRESETS) {
        for (const key of requiredKeys) {
          expect(preset.config).toHaveProperty(key);
        }
      }
    });

    it("has unique preset ids", () => {
      const ids = STUDIO_PRESETS.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("includes a minimal preset", () => {
      expect(STUDIO_PRESETS.some((p) => p.id === "minimal")).toBe(true);
    });

    it("includes a premium preset", () => {
      expect(STUDIO_PRESETS.some((p) => p.id === "premium")).toBe(true);
    });

    it("includes a holographic preset", () => {
      expect(STUDIO_PRESETS.some((p) => p.id === "holographic")).toBe(true);
    });

    it("includes a maximum preset", () => {
      expect(STUDIO_PRESETS.some((p) => p.id === "maximum")).toBe(true);
    });

    it("preset config values are strings", () => {
      for (const preset of STUDIO_PRESETS) {
        for (const val of Object.values(preset.config)) {
          expect(typeof val).toBe("string");
        }
      }
    });
  });

  describe("StudioPreset type", () => {
    it("type is usable (compile-time check via assignment)", () => {
      const p: StudioPreset = STUDIO_PRESETS[0]!;
      expect(p).toBeDefined();
    });
  });
});
