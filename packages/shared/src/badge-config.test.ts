import { describe, it, expect } from "vitest";
import {
  BADGE_CONFIG_OPTIONS,
  DEFAULT_BADGE_CONFIG,
  RETIRED_BADGE_CONFIG_KEYS,
} from "./types";

/**
 * #1191 step 5 — Studio dropped the three categories that can never reach the
 * embeddable badge (interaction, statsDisplay, celebration). A badge is an
 * image: no pointer, no JavaScript loop, and no "on load" moment for a cached
 * file served to every viewer. Keeping them as controls taught the owner "the
 * preview isn't the badge" at exactly the moment the other six stopped being
 * a lookalike, so they were removed rather than labelled.
 */
describe("BadgeConfig schema after the preview-only drop (#1191)", () => {
  const RETIRED = ["interaction", "statsDisplay", "celebration"];

  it("names the retired keys so stored configs can be migrated on read", () => {
    expect([...RETIRED_BADGE_CONFIG_KEYS].sort()).toEqual([...RETIRED].sort());
  });

  it("has exactly the six categories that reach the SVG", () => {
    expect(Object.keys(BADGE_CONFIG_OPTIONS).sort()).toEqual(
      [
        "background",
        "border",
        "cardStyle",
        "heatmapAnimation",
        "scoreEffect",
        "tierTreatment",
      ].sort(),
    );
  });

  it.each(RETIRED)("no longer offers options for %s", (key) => {
    expect(BADGE_CONFIG_OPTIONS).not.toHaveProperty(key);
  });

  it.each(RETIRED)("leaves %s out of the default config", (key) => {
    expect(DEFAULT_BADGE_CONFIG).not.toHaveProperty(key);
  });

  it("keeps the default config in step with the option lists", () => {
    expect(Object.keys(DEFAULT_BADGE_CONFIG).sort()).toEqual(
      Object.keys(BADGE_CONFIG_OPTIONS).sort(),
    );
  });

  it("keeps every default value inside its own option list", () => {
    for (const [key, allowed] of Object.entries(BADGE_CONFIG_OPTIONS)) {
      const value = DEFAULT_BADGE_CONFIG[key as keyof typeof DEFAULT_BADGE_CONFIG];
      expect(allowed as readonly string[], key).toContain(value);
    }
  });

  it("never reuses a retired key for a new category", () => {
    for (const retired of RETIRED_BADGE_CONFIG_KEYS) {
      expect(BADGE_CONFIG_OPTIONS).not.toHaveProperty(retired);
    }
  });
});
