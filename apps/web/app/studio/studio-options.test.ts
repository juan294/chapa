import { describe, it, expect } from "vitest";
import { BADGE_CONFIG_OPTIONS } from "@chapa/shared";
import type { BadgeConfig } from "@chapa/shared";
import {
  STUDIO_CATEGORIES,
  getOptionLabel,
  getOptionDescription,
} from "./studio-options";

describe("STUDIO_CATEGORIES", () => {
  it("has exactly 7 categories (one per BadgeConfig field)", () => {
    expect(STUDIO_CATEGORIES).toHaveLength(7);
  });

  it("covers every key in BadgeConfig", () => {
    const keys = STUDIO_CATEGORIES.map((c) => c.key);
    const expectedKeys: (keyof BadgeConfig)[] = [
      "background",
      "cardStyle",
      "border",
      "scoreEffect",
      "heatmapAnimation",
      "tierTreatment",
      "palette",
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

// #1216 — Quick Controls renders a description under every option label, so
// the descriptions that already lived in STUDIO_CATEGORIES now need a
// translated accessor like the labels have.
describe("getOptionDescription", () => {
  it("returns the English description when no translator is supplied", () => {
    expect(getOptionDescription("background", "aurora")).toBe(
      "Animated color waves",
    );
  });

  it("prefers a translation when one resolves", () => {
    const t = ((key: string) =>
      key === "studio.categories.background.descriptions.aurora"
        ? "Ondas de color animadas"
        : key) as Parameters<typeof getOptionDescription>[2];
    expect(getOptionDescription("background", "aurora", t)).toBe(
      "Ondas de color animadas",
    );
  });

  it("falls back to English when the translator echoes the key back", () => {
    const t = ((key: string) => key) as Parameters<
      typeof getOptionDescription
    >[2];
    expect(getOptionDescription("background", "aurora", t)).toBe(
      "Animated color waves",
    );
  });

  it("returns an empty string for an unknown option", () => {
    expect(getOptionDescription("background", "nope")).toBe("");
  });

  it("has a description for every option in every category", () => {
    for (const category of STUDIO_CATEGORIES) {
      for (const option of category.options) {
        expect(getOptionDescription(category.key, option.value)).not.toBe("");
      }
    }
  });
});

// #1191 step 5 — every remaining category renders in the real badge. The
// three that could not (interaction, statsDisplay, celebration) were removed
// rather than labelled "preview only": a badge is a cached image with no
// pointer, no JavaScript loop and no "on load" moment, so those controls had
// exactly one audience — the owner sitting in Studio — and every one of them
// taught that the preview is not the artifact.
describe("every category reaches the embeddable badge (#1191)", () => {
  const RETIRED = ["interaction", "statsDisplay", "celebration"];

  async function badgeSvgSource() {
    const fs = await import("node:fs");
    const path = await import("node:path");
    return fs.readFileSync(
      path.resolve(__dirname, "../../lib/render/BadgeSvg.tsx"),
      "utf8",
    );
  }

  it("offers none of the retired preview-only categories", () => {
    const keys = STUDIO_CATEGORIES.map((c) => String(c.key));
    for (const retired of RETIRED) {
      expect(keys).not.toContain(retired);
    }
  });

  it("is consumed by the SVG renderer, category by category", async () => {
    const source = await badgeSvgSource();
    for (const category of STUDIO_CATEGORIES) {
      expect(source, category.key).toContain(`config.${category.key}`);
    }
  });

  it("leaves no retired category behind in the SVG renderer", async () => {
    const source = await badgeSvgSource();
    for (const retired of RETIRED) {
      expect(source, retired).not.toContain(`config.${retired}`);
    }
  });
});

/**
 * #1226 — the default heatmap animation was labelled "Fade In" and described
 * as a "uniform gentle fade". The badge has never done that: `heatmapDelay`
 * returns `week * 60` for `fade-in` (`apps/web/lib/render/heatmap.ts`), a
 * left-to-right column stagger. It is the same shape as `cascade`
 * (`week * 120`) and differs only in speed.
 *
 * The persisted enum value stays `fade-in` — it is written into every saved
 * Studio config, and renaming it would need the same read-path migration
 * `RETIRED_BADGE_CONFIG_KEYS` got. Only the human-facing label and
 * description change, because those are not persisted.
 */
describe("the default heatmap animation is described truthfully (#1226)", () => {
  const heatmap = STUDIO_CATEGORIES.find(
    (category) => category.key === "heatmapAnimation",
  );

  it("still offers the persisted default value", () => {
    expect(heatmap?.options.map((o) => o.value)).toContain("fade-in");
  });

  it("does not call the default a uniform fade", () => {
    const description = getOptionDescription("heatmapAnimation", "fade-in");
    expect(description.toLowerCase()).not.toContain("uniform");
    expect(description.toLowerCase()).not.toContain("fade");
  });

  it("describes the default as the column sweep it actually is", () => {
    expect(
      getOptionDescription("heatmapAnimation", "fade-in").toLowerCase(),
    ).toContain("column");
  });

  it("keeps the default distinguishable from cascade, its slower twin", () => {
    const fadeIn = getOptionDescription("heatmapAnimation", "fade-in");
    const cascade = getOptionDescription("heatmapAnimation", "cascade");
    expect(cascade.toLowerCase()).toContain("column");
    expect(fadeIn).not.toBe(cascade);
    // Speed is the only real difference, so each has to say which it is.
    expect(`${fadeIn} ${cascade}`.toLowerCase()).toMatch(/quick|fast/);
    expect(`${fadeIn} ${cascade}`.toLowerCase()).toMatch(/slow/);
  });

  it("does not label the default a fade either", () => {
    const label = getOptionLabel("heatmapAnimation", "fade-in");
    expect(label.toLowerCase()).not.toContain("fade");
  });
});
