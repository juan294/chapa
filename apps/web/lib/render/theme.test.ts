import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  WARM_AMBER,
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

  it("tier colors are the app's jade accent, converted for the badge (#1225)", () => {
    // #1206 moved the app to Jade and put the badge out of scope, so the two
    // deliberately diverged. #1191 then made Creator Studio render this very
    // SVG, and "jade in Studio, violet in the README" stopped being tenable —
    // so #1225 converged them.
    //
    // The badge always renders dark, so it takes the DARK half of the token.
    // Hex rather than oklch() because the OG-image route rasterizes through
    // resvg, which parses a narrower colour syntax than a browser.
    // oklch(.76 .16 163) -> #1BD093, oklch(.84 .14 163) -> #65E7B0.
    //
    // Both halves stay pinned, so changing EITHER side unintentionally fails.
    expect(getTierColor("Elite")).toBe("#1BD093");
    expect(getTierColor("High")).toBe("#65E7B0");
    expect(themedTokenValue("--color-amber").dark).toBe("oklch(.76 .16 163)");
    expect(themedTokenValue("--color-amber-light").dark).toBe("oklch(.84 .14 163)");
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
    expect(themedTokenValue("--color-bg").dark).toBe("#08170f");
    expect(themedTokenValue("--color-card").dark).toBe("#0f2419");
    expect(themedTokenValue("--color-text-primary").dark).toBe("#dfeae4");
    expect(themedTokenValue("--color-text-secondary").dark).toBe("#a9c0b5");

    expect(WARM_AMBER.bg).toBe("#0C0D14");
    expect(WARM_AMBER.card).toBe("#13141E");
    expect(WARM_AMBER.textPrimary).toBe("#E6EDF3");
    expect(WARM_AMBER.textSecondary).toBe("#9AA4B2");

    expect(WARM_AMBER.bg).not.toBe("#08170f");
    expect(WARM_AMBER.card).not.toBe("#0f2419");
    expect(WARM_AMBER.textPrimary).not.toBe("#dfeae4");
    expect(WARM_AMBER.textSecondary).not.toBe("#a9c0b5");
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
