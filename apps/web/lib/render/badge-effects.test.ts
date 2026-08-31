import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { DEFAULT_BADGE_CONFIG, type BadgeConfig } from "@chapa/shared";
import { renderBadgeSvg } from "./BadgeSvg";
import { renderBorderEffect, renderCardStyleEffect } from "./badge-effects";
import { DEMO_STATS, DEMO_IMPACT } from "./demoData";
import { WARM_AMBER, badgeTheme, getArchetypeColor } from "./theme";
import { VERIFICATION_CORAL } from "../badge-visual-metadata";

const ctx = {
  width: 1200,
  height: 630,
  theme: WARM_AMBER,
  disableAnimation: false,
};

function hash(svg: string): string {
  return createHash("sha256").update(svg).digest("hex").slice(0, 16);
}

/**
 * The default badge is pinned byte-for-byte. Every cached badge and every
 * embedded README image is keyed on handle/day/locale, not on content, so a
 * single changed byte in the default path silently changes what thousands of
 * already-published images look like.
 *
 * **These are not a snapshot to regenerate when they fail.** A failure means
 * the default badge moved, which is either a bug or a deliberate design change
 * that must bump `BADGE_RENDER_VARIANT` in the same commit (see
 * `docs/decisions/2026-08-30-one-badge-artifact.md`).
 *
 * Baseline history — re-baselining is a design-version event, not maintenance:
 *
 * | Variant | Captured at | Why |
 * |---|---|---|
 * | `warm-amber-v3` | develop @ 7d0cc6ae, before `config` existed | #1191 proved teaching the renderer `BadgeConfig` moved nothing |
 * | `jade-v1` | this commit | #1225 converged the badge onto the app's Jade palette — the accent and the seven archetype colours changed on purpose |
 *
 * #1225 is the first deliberate re-baseline. The badge had kept the pre-#1206
 * violet, which was recorded as intentional while Studio previewed a separate
 * DOM badge; once #1191 made Studio render this very SVG, "jade in Studio,
 * violet in the README" stopped being tenable.
 */
describe("default config renders the jade-v1 badge byte-for-byte", () => {
  it.each([
    ["plain", {}, "66c85c46c97e1d53", 30284],
    ["branding + demo", { includeBranding: true, demoMode: true }, "efc776305828e5e9", 30768],
    ["animation disabled", { disableAnimation: true }, "35bdf419ee91e335", 21891],
  ] as const)("%s", (_label, options, expectedHash, expectedLength) => {
    const svg = renderBadgeSvg(DEMO_STATS, DEMO_IMPACT, options);
    expect(svg.length).toBe(expectedLength);
    expect(hash(svg)).toBe(expectedHash);
  });

  it("omitting config is identical to passing the default explicitly", () => {
    const implicit = renderBadgeSvg(DEMO_STATS, DEMO_IMPACT, { demoMode: true });
    const explicit = renderBadgeSvg(DEMO_STATS, DEMO_IMPACT, {
      demoMode: true,
      config: DEFAULT_BADGE_CONFIG,
    });
    expect(implicit).toBe(explicit);
  });
});

describe("renderBorderEffect (#1191)", () => {
  it("emits the legacy border rect for the default value", () => {
    const { defs, markup } = renderBorderEffect("solid-amber", ctx);
    expect(defs).toBe("");
    expect(markup).toBe(
      `<rect x="1" y="1" width="1198" height="628" rx="19" fill="none" stroke="${WARM_AMBER.tint(0.12)}" stroke-width="2"/>`,
    );
  });

  it("emits nothing at all for none", () => {
    expect(renderBorderEffect("none", ctx)).toEqual({ defs: "", markup: "" });
  });

  it("actually removes the border from the rendered badge", () => {
    const withBorder = renderBadgeSvg(DEMO_STATS, DEMO_IMPACT, {
      config: { ...DEFAULT_BADGE_CONFIG, border: "solid-amber" },
    });
    const without = renderBadgeSvg(DEMO_STATS, DEMO_IMPACT, {
      config: { ...DEFAULT_BADGE_CONFIG, border: "none" },
    });
    expect(without).not.toBe(withBorder);
    expect(without).not.toContain('rx="19" fill="none"');
    // The background rect is untouched — only the border went away.
    expect(without).toContain('<rect width="1200" height="630" rx="20"');
  });

  it("paints a gradient border, animated by default", () => {
    const { defs, markup } = renderBorderEffect("gradient-rotating", ctx);
    expect(defs).toContain("<linearGradient");
    expect(defs).toContain("animateTransform");
    expect(markup).toContain('stroke="url(#badge-border-gradient)"');
  });

  it("still paints the gradient when animation is off, at its resting frame", () => {
    // #760: SMIL never runs in an <img> embed or during PNG rasterization. An
    // effect that only exists as an animation renders as nothing there.
    const { defs, markup } = renderBorderEffect("gradient-rotating", {
      ...ctx,
      disableAnimation: true,
    });
    expect(defs).toContain("<linearGradient");
    expect(defs).not.toContain("animateTransform");
    expect(markup).toContain('stroke="url(#badge-border-gradient)"');
  });

  it("puts the gradient definition inside the document's defs", () => {
    const svg = renderBadgeSvg(DEMO_STATS, DEMO_IMPACT, {
      config: { ...DEFAULT_BADGE_CONFIG, border: "gradient-rotating" },
    });
    const defsEnd = svg.indexOf("</defs>");
    expect(svg.indexOf('id="badge-border-gradient"')).toBeGreaterThan(-1);
    expect(svg.indexOf('id="badge-border-gradient"')).toBeLessThan(defsEnd);
  });

  it("uses no CSS custom properties — the badge renders before app CSS exists", () => {
    for (const border of ["solid-amber", "none", "gradient-rotating"] as const) {
      const { defs, markup } = renderBorderEffect(border, ctx);
      expect(defs + markup).not.toContain("var(--");
    }
  });
});

/**
 * #1191 — the categories that cross to SVG. Each has the same two obligations:
 * the default value must leave the badge untouched (the guard above proves the
 * whole document), and a non-default value must actually change what renders.
 */
describe("categories that cross to SVG (#1191)", () => {
  const render = (config: Partial<typeof DEFAULT_BADGE_CONFIG>) =>
    renderBadgeSvg(DEMO_STATS, DEMO_IMPACT, {
      config: { ...DEFAULT_BADGE_CONFIG, ...config },
    });

  const baseline = renderBadgeSvg(DEMO_STATS, DEMO_IMPACT, {
    config: DEFAULT_BADGE_CONFIG,
  });

  it.each([
    ["background", { background: "aurora" as const }],
    ["background", { background: "particles" as const }],
    ["border", { border: "gradient-rotating" as const }],
    ["border", { border: "none" as const }],
    ["scoreEffect", { scoreEffect: "gold-shimmer" as const }],
    ["scoreEffect", { scoreEffect: "chrome" as const }],
    ["scoreEffect", { scoreEffect: "embossed" as const }],
    ["scoreEffect", { scoreEffect: "neon-amber" as const }],
    ["scoreEffect", { scoreEffect: "holographic" as const }],
    ["heatmapAnimation", { heatmapAnimation: "ripple" as const }],
    ["heatmapAnimation", { heatmapAnimation: "waterfall" as const }],
    ["heatmapAnimation", { heatmapAnimation: "scatter" as const }],
  ])("%s: a non-default value changes the rendered badge", (_c, config) => {
    expect(render(config)).not.toBe(baseline);
  });

  it("tierTreatment enhanced decorates a High tier", () => {
    // DEMO_IMPACT is the High tier, which is one of the two that earn it.
    expect(render({ tierTreatment: "enhanced" })).not.toBe(baseline);
  });

  it("tierTreatment enhanced adds nothing to a tier that has not earned it", () => {
    const solid = { ...DEMO_IMPACT, tier: "Solid" as const };
    const plain = renderBadgeSvg(DEMO_STATS, solid, {
      config: DEFAULT_BADGE_CONFIG,
    });
    const enhanced = renderBadgeSvg(DEMO_STATS, solid, {
      config: { ...DEFAULT_BADGE_CONFIG, tierTreatment: "enhanced" },
    });
    expect(enhanced).toBe(plain);
  });

  it("renders deterministically — the same config always yields the same bytes", () => {
    // Purity is what makes the SVG cacheable per handle/day/locale. An effect
    // reading a clock or a random source would break caching silently.
    for (const config of [
      { background: "particles" as const },
      { heatmapAnimation: "scatter" as const },
      { scoreEffect: "holographic" as const },
    ]) {
      expect(render(config)).toBe(render(config));
    }
  });

  it("every effect still paints when animation is off", () => {
    // #760 — SMIL never runs in an <img> embed or during PNG rasterization.
    for (const config of [
      { background: "aurora" as const },
      { background: "particles" as const },
      { border: "gradient-rotating" as const },
      { scoreEffect: "gold-shimmer" as const },
      { scoreEffect: "holographic" as const },
    ]) {
      const svg = renderBadgeSvg(DEMO_STATS, DEMO_IMPACT, {
        disableAnimation: true,
        config: { ...DEFAULT_BADGE_CONFIG, ...config },
      });
      expect(svg).not.toContain("<animate ");
      expect(svg).not.toContain("<animateTransform");
      // The element is still there, just not moving.
      expect(svg.length).toBeGreaterThan(1000);
    }
  });

  it("uses no CSS custom properties anywhere, for any config", () => {
    // The badge renders server-side before app CSS exists.
    for (const background of ["solid", "aurora", "particles"] as const) {
      for (const scoreEffect of ["standard", "gold-leaf", "neon-amber"] as const) {
        expect(render({ background, scoreEffect })).not.toContain("var(--");
      }
    }
  });

  it("puts every effect definition inside the document's defs", () => {
    const svg = render({
      background: "aurora",
      border: "gradient-rotating",
      scoreEffect: "holographic",
    });
    const defsEnd = svg.indexOf("</defs>");
    for (const id of [
      "badge-bg-aurora",
      "badge-border-gradient",
      "badge-score-paint",
    ]) {
      const at = svg.indexOf(`id="${id}"`);
      expect(at, id).toBeGreaterThan(-1);
      expect(at, id).toBeLessThan(defsEnd);
    }
  });
});

// #1242 — a palette is only real if it reaches the artifact. The mock
// approximated it with a CSS filter over the preview; that route is closed
// here, because #1191 made Studio render this very SVG.
describe("a palette recolours the artifact (#1242)", () => {
  const render = (palette: BadgeConfig["palette"]) =>
    renderBadgeSvg(DEMO_STATS, DEMO_IMPACT, {
      config: { ...DEFAULT_BADGE_CONFIG, palette },
    });

  it.each(["indigo", "amber", "crimson", "mono"] as const)(
    "%s replaces the jade accent, ground and heatmap ramp",
    (palette) => {
      const svg = render(palette);
      const theme = badgeTheme(palette);
      expect(svg).toContain(theme.bg);
      expect(svg).toContain(theme.tint(0.12));
      expect(svg).not.toContain(WARM_AMBER.accentRgb);
      expect(svg).not.toContain(WARM_AMBER.bg);
    },
  );

  it("leaves the archetype colour alone — it is a signal, not decoration", () => {
    const builder = getArchetypeColor(DEMO_IMPACT.archetype);
    for (const palette of ["jade", "indigo", "amber", "crimson", "mono"] as const) {
      expect(render(palette)).toContain(builder);
    }
  });

  it("never lets a palette claim the verification coral", () => {
    // The strip carries the badge's one "verified" colour (#1168/#1183), so it
    // must render the same coral whatever the palette is.
    for (const palette of ["jade", "indigo", "amber", "crimson", "mono"] as const) {
      const svg = renderBadgeSvg(DEMO_STATS, DEMO_IMPACT, {
        demoMode: true,
        config: { ...DEFAULT_BADGE_CONFIG, palette },
      });
      expect(svg).toContain(VERIFICATION_CORAL);
    }
  });

  it("recolours the effects too, not just the base badge", () => {
    // A jade shimmer on a violet badge is the failure this guards.
    const svg = renderBadgeSvg(DEMO_STATS, DEMO_IMPACT, {
      config: {
        ...DEFAULT_BADGE_CONFIG,
        palette: "indigo",
        background: "aurora",
        border: "gradient-rotating",
        cardStyle: "aurora-glass",
      },
    });
    expect(svg).toContain(badgeTheme("indigo").accent);
    expect(svg).toContain(badgeTheme("indigo").accentLight);
    expect(svg).not.toContain(WARM_AMBER.accent);
  });
});

describe("cardStyle crosses only partially (#1191)", () => {
  const ctx2 = { width: 1200, height: 630, theme: WARM_AMBER, disableAnimation: false };

  it("flat is the default and adds nothing", () => {
    expect(renderCardStyleEffect("flat", ctx2)).toEqual({ defs: "", markup: "" });
  });

  it.each(["frost", "smoke", "crystal", "aurora-glass"] as const)(
    "%s paints a distinct sheen",
    (cardStyle) => {
      const { defs, markup } = renderCardStyleEffect(cardStyle, ctx2);
      expect(defs).toContain("<linearGradient");
      expect(markup).toContain('fill="url(#badge-card-sheen)"');
    },
  );

  it("gives each glass look a different appearance", () => {
    const looks = (["frost", "smoke", "crystal", "aurora-glass"] as const).map(
      (c) => renderCardStyleEffect(c, ctx2).defs,
    );
    expect(new Set(looks).size).toBe(looks.length);
  });

  it("is an approximation, not a backdrop blur — documented, not a bug", () => {
    // Studio's glass looks use backdrop-filter, which composites against what
    // sits behind the element. SVG has no equivalent: feGaussianBlur blurs the
    // source graphic, and the badge is an opaque plate with nothing behind it.
    // So no blur primitive should appear here, and the ADR records why.
    for (const cardStyle of ["frost", "smoke", "crystal", "aurora-glass"] as const) {
      const { defs, markup } = renderCardStyleEffect(cardStyle, ctx2);
      expect(defs + markup).not.toContain("feGaussianBlur");
      expect(defs + markup).not.toContain("backdrop");
    }
  });
});
