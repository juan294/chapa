import type { BadgeConfig } from "@chapa/shared";

/**
 * SVG effect builders for the badge (#1191).
 *
 * These exist so Creator Studio's `BadgeConfig` reaches the artifact people
 * actually embed, rather than only a DOM lookalike. Every function here is
 * PURE: config in, SVG string out. That is not a style preference — it is what
 * keeps `renderBadgeSvg` cacheable per handle/day/locale and rasterizable by
 * `svg-to-png.ts`. Never read a store, a clock, or a random source from here.
 *
 * Two more rules the badge imposes on any effect:
 *
 *   - **No CSS custom properties.** The badge renders server-side before app
 *     CSS exists, so every colour must be a literal.
 *   - **Every animation needs a static first frame.** SMIL does not run when
 *     the SVG is embedded via `<img>` (README badges) or during rasterization
 *     to PNG (OG images). `disableAnimation` must produce the effect's resting
 *     appearance, never an invisible element — that was #760.
 */

export interface BadgeEffectContext {
  width: number;
  height: number;
  /** The badge theme's border colour, used by the default border. */
  stroke: string;
  /**
   * True for `<img>` embeds and PNG rasterization, where SMIL never runs.
   * An effect must still render its resting appearance.
   */
  disableAnimation: boolean;
}

export interface BadgeEffectFragment {
  /** Emitted inside the document's `<defs>`. */
  defs: string;
  /** Emitted in document order, where the effect paints. */
  markup: string;
}

export const EMPTY_FRAGMENT: BadgeEffectFragment = { defs: "", markup: "" };

const BORDER_GRADIENT_ID = "badge-border-gradient";

/**
 * The badge's outer border.
 *
 * `solid-amber` is the default and MUST emit byte-identical markup to the
 * pre-#1191 renderer, so no existing cached badge or embedded README image
 * moves when this ships.
 */
export function renderBorderEffect(
  border: BadgeConfig["border"],
  ctx: BadgeEffectContext,
): BadgeEffectFragment {
  const { width, height, stroke, disableAnimation } = ctx;
  const rect = (paint: string) =>
    `<rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="19" fill="none" stroke="${paint}" stroke-width="2"/>`;

  switch (border) {
    case "none":
      return EMPTY_FRAGMENT;

    case "gradient-rotating": {
      // A rotating conic look is not expressible in SVG, so this is a linear
      // gradient whose transform rotates. When animation is off the gradient
      // still paints — the resting frame is the un-rotated gradient, which is
      // a legitimate border rather than an invisible one.
      const animate = disableAnimation
        ? ""
        : `<animateTransform attributeName="gradientTransform" type="rotate" from="0 0.5 0.5" to="360 0.5 0.5" dur="6s" repeatCount="indefinite"/>`;
      return {
        defs: `<linearGradient id="${BORDER_GRADIENT_ID}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#8B5CF6"/>
      <stop offset="50%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#8B5CF6"/>
      ${animate}
    </linearGradient>`,
        markup: rect(`url(#${BORDER_GRADIENT_ID})`),
      };
    }

    case "solid-amber":
    default:
      return { defs: "", markup: rect(stroke) };
  }
}
