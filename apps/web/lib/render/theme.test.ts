import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  WARM_AMBER,
  getArchetypeColor,
  getHeatmapColor,
  getTierColor,
} from "./theme";

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

  it("tier colors intentionally diverge from the app accent until the badge is rebranded (#1206)", () => {
    // Until #1206 the badge's accent was held in lockstep with --color-amber.
    // The Jade rebrand moved the app to green and put the badge explicitly out
    // of scope: it is rendered server-side before app CSS exists, is always
    // dark regardless of theme, and every already-embedded README image would
    // change. So the two are now deliberately different, and this test records
    // that rather than asserting an alignment that no longer holds.
    //
    // Both halves are still pinned, so changing EITHER side unintentionally
    // still fails. Rebranding the badge is its own task; when it happens, this
    // test is the thing to update.
    expect(getTierColor("Elite")).toBe("#8B5CF6");
    expect(getTierColor("High")).toBe("#A78BFA");
    expect(globalsCss).toContain("--color-amber: oklch(.66 .15 163);");
    expect(globalsCss).not.toContain("--color-amber: #8B5CF6;");
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
    // WARM_AMBER literals below did not. The divergence this test documents is
    // therefore wider than it was, and still intentional.
    expect(globalsCss).toContain("--color-bg: #08170f;");
    expect(globalsCss).toContain("--color-card: #0f2419;");
    expect(globalsCss).toContain("--color-text-primary: #dfeae4;");
    expect(globalsCss).toContain("--color-text-secondary: #8ba398;");

    expect(WARM_AMBER.bg).toBe("#0C0D14");
    expect(WARM_AMBER.card).toBe("#13141E");
    expect(WARM_AMBER.textPrimary).toBe("#E6EDF3");
    expect(WARM_AMBER.textSecondary).toBe("#9AA4B2");

    expect(WARM_AMBER.bg).not.toBe("#08170f");
    expect(WARM_AMBER.card).not.toBe("#0f2419");
    expect(WARM_AMBER.textPrimary).not.toBe("#dfeae4");
    expect(WARM_AMBER.textSecondary).not.toBe("#8ba398");
  });
});

describe("getArchetypeColor", () => {
  it("archetype colors intentionally diverge from globals.css tokens (#1206)", () => {
    // These were kept in lockstep until #1206. Jade re-tuned all seven app
    // archetype tokens onto one oklch lightness/chroma (.62 .14, hue only
    // varying) while the badge stayed on the old literals, because the badge
    // is out of scope for the rebrand. An archetype is therefore shown in one
    // color on the badge and another in the app until the badge follows.
    //
    // Both sides stay pinned so an unintended change to either still fails.
    expect(globalsCss).toContain("--color-archetype-builder: oklch(.62 .14 163);");
    expect(globalsCss).toContain("--color-archetype-guardian: oklch(.62 .14 330);");
    expect(globalsCss).not.toContain("--color-archetype-builder: #8B5CF6;");

    expect(getArchetypeColor("Builder")).toBe("#8B5CF6");
    expect(getArchetypeColor("Quality Champion")).toBe("#EC4899");
    expect(getArchetypeColor("Marathoner")).toBe("#22C55E");
    expect(getArchetypeColor("Polymath")).toBe("#EAB308");
    expect(getArchetypeColor("Balanced")).toBe("#0EA5E9");
    expect(getArchetypeColor("Emerging")).toBe("#F97316");
    expect(getArchetypeColor("Artificer")).toBe("#F59E0B");
  });
});
