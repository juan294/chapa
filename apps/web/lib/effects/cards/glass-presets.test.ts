import { describe, it, expect } from "vitest";
import {
  GLASS_PRESETS,
  glassStyle,
  type GlassVariant,
} from "./glass-presets";

const ALL_VARIANTS: GlassVariant[] = ["frost", "smoke", "crystal", "aurora-glass"];

describe("GLASS_PRESETS", () => {
  it("has all four variants", () => {
    for (const variant of ALL_VARIANTS) {
      expect(GLASS_PRESETS[variant]).toBeDefined();
    }
  });

  it("each preset has a label", () => {
    for (const variant of ALL_VARIANTS) {
      expect(typeof GLASS_PRESETS[variant].label).toBe("string");
      expect(GLASS_PRESETS[variant].label.length).toBeGreaterThan(0);
    }
  });

  it("each preset has valid numeric properties", () => {
    for (const variant of ALL_VARIANTS) {
      const p = GLASS_PRESETS[variant];
      expect(p.bgOpacity).toBeGreaterThan(0);
      expect(p.bgOpacity).toBeLessThanOrEqual(1);
      expect(p.blur).toBeGreaterThan(0);
      expect(p.saturation).toBeGreaterThan(0);
      expect(p.borderOpacity).toBeGreaterThan(0);
      expect(p.borderOpacity).toBeLessThanOrEqual(1);
    }
  });

  it("smoke has a shadow", () => {
    expect(GLASS_PRESETS.smoke.shadow).toBeDefined();
    expect(typeof GLASS_PRESETS.smoke.shadow).toBe("string");
  });

  it("crystal has a shadow and inset highlight", () => {
    expect(GLASS_PRESETS.crystal.shadow).toBeDefined();
    expect(GLASS_PRESETS.crystal.insetHighlight).toBe(true);
  });

  it("frost has no shadow or inset highlight", () => {
    expect(GLASS_PRESETS.frost.shadow).toBeUndefined();
    expect(GLASS_PRESETS.frost.insetHighlight).toBeUndefined();
  });
});

describe("glassStyle", () => {
  it("returns a CSSProperties object", () => {
    const style = glassStyle("frost");
    expect(typeof style).toBe("object");
  });

  it("includes backdropFilter for all variants", () => {
    for (const variant of ALL_VARIANTS) {
      const style = glassStyle(variant);
      expect(style.backdropFilter).toBeDefined();
      expect(style.backdropFilter).toContain("blur");
      expect(style.backdropFilter).toContain("saturate");
    }
  });

  it("includes WebkitBackdropFilter for cross-browser support", () => {
    for (const variant of ALL_VARIANTS) {
      const style = glassStyle(variant);
      expect(style.WebkitBackdropFilter).toBeDefined();
      expect(style.WebkitBackdropFilter).toContain("blur");
    }
  });

  it("includes border with accent color opacity", () => {
    for (const variant of ALL_VARIANTS) {
      const style = glassStyle(variant);
      expect(style.border).toBeDefined();
      expect(style.border).toContain("rgba(124, 106, 239");
    }
  });

  it("aurora-glass uses accent background color", () => {
    const style = glassStyle("aurora-glass");
    expect(style.background).toContain("rgba(124, 106, 239");
  });

  it("non-aurora variants use dark background color", () => {
    for (const variant of ["frost", "smoke", "crystal"] as GlassVariant[]) {
      const style = glassStyle(variant);
      expect(style.background).toContain("rgba(19, 20, 30");
    }
  });

  it("smoke includes boxShadow", () => {
    const style = glassStyle("smoke");
    expect(style.boxShadow).toBeDefined();
    expect(typeof style.boxShadow).toBe("string");
  });

  it("crystal includes inset highlight in boxShadow", () => {
    const style = glassStyle("crystal");
    expect(style.boxShadow).toBeDefined();
    expect(style.boxShadow).toContain("inset");
  });

  it("frost has no boxShadow", () => {
    const style = glassStyle("frost");
    expect(style.boxShadow).toBeUndefined();
  });

  it("blur values match preset config", () => {
    for (const variant of ALL_VARIANTS) {
      const style = glassStyle(variant);
      const expected = `blur(${GLASS_PRESETS[variant].blur}px)`;
      expect(style.backdropFilter).toContain(expected);
    }
  });

  it("saturation values match preset config", () => {
    for (const variant of ALL_VARIANTS) {
      const style = glassStyle(variant);
      const expected = `saturate(${GLASS_PRESETS[variant].saturation}%)`;
      expect(style.backdropFilter).toContain(expected);
    }
  });
});
