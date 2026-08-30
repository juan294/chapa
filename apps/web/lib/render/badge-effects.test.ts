import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { DEFAULT_BADGE_CONFIG } from "@chapa/shared";
import { renderBadgeSvg } from "./BadgeSvg";
import { renderBorderEffect } from "./badge-effects";
import { DEMO_STATS, DEMO_IMPACT } from "./demoData";

const ctx = {
  width: 1200,
  height: 630,
  stroke: "rgba(139,92,246,0.12)",
  disableAnimation: false,
};

function hash(svg: string): string {
  return createHash("sha256").update(svg).digest("hex").slice(0, 16);
}

/**
 * #1191 — the first and most important guard of the "one badge artifact" work.
 *
 * Teaching renderBadgeSvg to consume BadgeConfig is only safe if the DEFAULT
 * config renders byte-identically to the pre-#1191 badge. Every cached badge
 * and every embedded README image is keyed on handle/day/locale, not on
 * content, so a single changed byte in the default path silently changes what
 * thousands of already-published images look like.
 *
 * These hashes were captured from develop at 7d0cc6ae, immediately before the
 * config parameter existed. They are not a snapshot to be regenerated when
 * they fail: a failure here means the default badge moved, which is either a
 * bug or a deliberate design change that must bump BADGE_RENDER_VARIANT in the
 * same commit (see docs/decisions/2026-08-30-one-badge-artifact.md).
 */
describe("default config renders the pre-#1191 badge byte-for-byte (#1191)", () => {
  it.each([
    ["plain", {}, "df8b08c4ad25062c", 29978],
    ["branding + demo", { includeBranding: true, demoMode: true }, "123dc054efa0200e", 30462],
    ["animation disabled", { disableAnimation: true }, "81c3d7f8e0ee2057", 21585],
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
      '<rect x="1" y="1" width="1198" height="628" rx="19" fill="none" stroke="rgba(139,92,246,0.12)" stroke-width="2"/>',
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
