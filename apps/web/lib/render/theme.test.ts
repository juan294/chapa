import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  WARM_AMBER,
  badgeTheme,
  getArchetypeColor,
  getHeatmapColor,
  getTierColor,
} from "./theme";
import { themedTokenValue } from "@/lib/test-helpers/css-tokens";

const globalsCss = readFileSync(
  new URL("../../styles/globals.css", import.meta.url),
  "utf8",
);

describe("WARM_AMBER theme", () => {
  it("has all required color tokens", () => {
    expect(WARM_AMBER.bg).toBeTruthy();
    expect(WARM_AMBER.card).toBeTruthy();
    expect(WARM_AMBER.textPrimary).toBeTruthy();
    expect(WARM_AMBER.textSecondary).toBeTruthy();
    expect(WARM_AMBER.accent).toBeTruthy();
    expect(WARM_AMBER.stroke).toBeTruthy();
  });

  it("has 5 heatmap intensity colors", () => {
    expect(WARM_AMBER.heatmap).toHaveLength(5);
  });
});

describe("getHeatmapColor", () => {
  it("returns intensity 0 color for 0 contributions", () => {
    expect(getHeatmapColor(0)).toBe(WARM_AMBER.heatmap[0]);
  });

  it("returns intensity 4 for high contributions", () => {
    expect(getHeatmapColor(20)).toBe(WARM_AMBER.heatmap[4]);
  });

  it("returns mid-range intensities for moderate counts", () => {
    const color = getHeatmapColor(3);
    expect(WARM_AMBER.heatmap).toContain(color);
  });
});

describe("getTierColor", () => {
  it("returns accent for Elite", () => {
    expect(getTierColor("Elite")).toBe(WARM_AMBER.accent);
  });

  it("returns a color for each tier", () => {
    for (const tier of ["Emerging", "Solid", "High", "Elite"] as const) {
      expect(getTierColor(tier)).toBeTruthy();
    }
  });

  it("preserves the Jade badge independently of the redesigned app accent", () => {
    // App presentation changes first; the renderer remains versioned separately.
    expect(getTierColor("Elite", badgeTheme("jade"))).toBe("#1BD093");
    expect(getTierColor("High", badgeTheme("jade"))).toBe("#65E7B0");
    expect(themedTokenValue("--color-amber").dark).toBe("#ff795f");
    expect(themedTokenValue("--color-amber-light").dark).toBe("#ff9d88");
  });
});

describe("theme.ts brand-alignment invariant comment (#1168 UX-L2)", () => {
  const themeSource = readFileSync(new URL("./theme.ts", import.meta.url), "utf8");

  it("scopes the alignment invariant to accent + archetype colors only, not bg/card/text", () => {
    // The comment previously claimed ALL "shared brand and archetype colors"
    // must stay aligned with globals.css, but bg/card/textPrimary/
    // textSecondary intentionally diverge (see next test) — only accent and
    // the 7 archetype colors are actually kept in lockstep (enforced above).
    // The comment must name that narrower scope explicitly.
    expect(themeSource).toMatch(/accent/i);
    expect(themeSource).toMatch(/archetype/i);
    expect(themeSource).not.toMatch(
      /shared brand and archetype colors must stay\s+\/\/\s*aligned/,
    );
  });

  it("bg/card/textPrimary/textSecondary intentionally diverge from globals.css dark tokens", () => {
    // Documents the actual (intentional) divergence: correcting the drifted
    // WARM_AMBER.bg. // comment. Correcting the comment over changing values
    // (#1168 UX-L2) — changing these hex values would alter every cached
    // badge SVG and every already-embedded README image for a ~2-RGB-step
    // difference that's imperceptible in practice.
    // #1206 — the app's dark surfaces moved to forest green; the badge's own
    // WARM_AMBER literals below did not. #1225 converged the ACCENT and the
    // archetypes but deliberately left the ground alone: it is a cooler canvas
    // tuned for the badge, and moving it is a design decision separate from
    // the brand colour. The divergence this test documents is therefore
    // narrower than it was, and still intentional.
    // #1211 folded each token's two per-theme declarations into one
    // light-dark() value; the dark half is the second argument.
    expect(themedTokenValue("--color-bg").dark).toBe("#141719");
    expect(themedTokenValue("--color-card").dark).toBe("#202528");
    expect(themedTokenValue("--color-text-primary").dark).toBe("#eeeae1");
    expect(themedTokenValue("--color-text-secondary").dark).toBe("#b3b9b9");

    expect(badgeTheme("jade").bg).toBe("#0C0D14");
    expect(badgeTheme("jade").card).toBe("#13141E");
    expect(badgeTheme("jade").textPrimary).toBe("#E6EDF3");
    expect(badgeTheme("jade").textSecondary).toBe("#9AA4B2");

    expect(WARM_AMBER.bg).not.toBe("#141719");
    expect(WARM_AMBER.card).not.toBe("#202528");
    expect(WARM_AMBER.textPrimary).not.toBe("#eeeae1");
    expect(WARM_AMBER.textSecondary).not.toBe("#b3b9b9");
  });
});

describe("getArchetypeColor", () => {
  it("archetype colors are the app's own tokens, converted for the badge (#1225)", () => {
    // Jade re-tuned all seven app archetype tokens onto one oklch lightness
    // and chroma (.62 .14), varying only in hue. #1206 left the badge on the
    // old literals; #1225 converted those same tokens to hex so an archetype
    // is one colour everywhere.
    //
    // .62 was kept rather than lightened for the badge's dark ground: matching
    // the app exactly is the point, and all seven clear AA on #0C0D14 anyway
    // (measured 4.96:1 for Quality Champion up to 5.70:1 for Builder).
    //
    // Both sides stay pinned so an unintended change to either still fails.
    expect(globalsCss).toContain("--color-archetype-builder: oklch(.62 .14 163);");
    expect(globalsCss).toContain("--color-archetype-guardian: oklch(.62 .14 330);");

    expect(getArchetypeColor("Builder")).toBe("#009F6D");
    expect(getArchetypeColor("Quality Champion")).toBe("#B464AE");
    expect(getArchetypeColor("Marathoner")).toBe("#479C4D");
    expect(getArchetypeColor("Polymath")).toBe("#8C8C00");
    expect(getArchetypeColor("Balanced")).toBe("#0A8FD1");
    expect(getArchetypeColor("Emerging")).toBe("#C7692C");
    expect(getArchetypeColor("Artificer")).toBe("#B67700");
  });
});
