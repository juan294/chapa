import { describe, it, expect } from "vitest";
import { BADGE_CONFIG_OPTIONS } from "@chapa/shared";
import type { BadgeConfig } from "@chapa/shared";
import { STUDIO_CATEGORIES, getOptionLabel } from "./studio-options";

describe("STUDIO_CATEGORIES", () => {
  it("has exactly 9 categories (one per BadgeConfig field)", () => {
    expect(STUDIO_CATEGORIES).toHaveLength(9);
  });

  it("covers every key in BadgeConfig", () => {
    const keys = STUDIO_CATEGORIES.map((c) => c.key);
    const expectedKeys: (keyof BadgeConfig)[] = [
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
    expect(keys).toEqual(expect.arrayContaining(expectedKeys));
    expect(keys).toHaveLength(expectedKeys.length);
  });

  it("every category has a non-empty label", () => {
    for (const cat of STUDIO_CATEGORIES) {
      expect(cat.label).toBeTruthy();
    }
  });

  it("every category has at least 2 options", () => {
    for (const cat of STUDIO_CATEGORIES) {
      expect(cat.options.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("every option has value, label, and description", () => {
    for (const cat of STUDIO_CATEGORIES) {
      for (const opt of cat.options) {
        expect(opt.value).toBeTruthy();
        expect(opt.label).toBeTruthy();
        expect(opt.description).toBeTruthy();
      }
    }
  });

  it("option values exactly match BADGE_CONFIG_OPTIONS for each category", () => {
    for (const cat of STUDIO_CATEGORIES) {
      const optionValues = cat.options.map((o) => o.value);
      const expectedValues = [
        ...BADGE_CONFIG_OPTIONS[cat.key],
      ] as string[];
      expect(optionValues).toEqual(expectedValues);
    }
  });

  it("has no duplicate keys", () => {
    const keys = STUDIO_CATEGORIES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has no duplicate option values within a category", () => {
    for (const cat of STUDIO_CATEGORIES) {
      const values = cat.options.map((o) => o.value);
      expect(new Set(values).size).toBe(values.length);
    }
  });
});

describe("getOptionLabel", () => {
  it("returns the label for a known value", () => {
    expect(getOptionLabel("background", "aurora")).toBe("Aurora Glow");
    expect(getOptionLabel("cardStyle", "frost")).toBe("Frosted Glass");
    expect(getOptionLabel("scoreEffect", "gold-shimmer")).toBe("Gold Shimmer");
  });

  it("returns the raw value if category key is unknown", () => {
    // Cast to bypass TS for testing
    expect(getOptionLabel("unknown" as keyof BadgeConfig, "foo")).toBe("foo");
  });

  it("returns the raw value if option value is not found", () => {
    expect(getOptionLabel("background", "nonexistent")).toBe("nonexistent");
  });

  it("returns correct label for every option in every category", () => {
    for (const cat of STUDIO_CATEGORIES) {
      for (const opt of cat.options) {
        expect(getOptionLabel(cat.key, opt.value)).toBe(opt.label);
      }
    }
  });
});
