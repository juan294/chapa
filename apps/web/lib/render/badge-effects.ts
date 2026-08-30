import type { BadgeConfig } from "@chapa/shared";
import { WARM_AMBER } from "./theme";

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
      <stop offset="0%" stop-color="${WARM_AMBER.accent}"/>
      <stop offset="50%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="${WARM_AMBER.accent}"/>
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

/* ── Background ─────────────────────────────────────────────── */

const AURORA_GRADIENT_ID = "badge-bg-aurora";

/**
 * The badge's background plate.
 *
 * `solid` is the default and emits the pre-#1191 rect verbatim.
 */
export function renderBackgroundEffect(
  background: BadgeConfig["background"],
  ctx: BadgeEffectContext & { fill: string },
): BadgeEffectFragment {
  const { width, height, fill, disableAnimation } = ctx;
  const plate = `<rect width="${width}" height="${height}" rx="20" fill="${fill}"/>`;

  switch (background) {
    case "aurora": {
      // Colour waves, as a gradient whose stops drift. With animation off the
      // gradient still paints — a static aurora, not a blank plate.
      const drift = disableAnimation
        ? ""
        : `<animate attributeName="x1" values="0;0.4;0" dur="12s" repeatCount="indefinite"/>`;
      return {
        defs: `<linearGradient id="${AURORA_GRADIENT_ID}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${WARM_AMBER.accent}" stop-opacity="0.20"/>
      <stop offset="55%" stop-color="#0EA5E9" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#F59E0B" stop-opacity="0.16"/>
      ${drift}
    </linearGradient>`,
        markup: `${plate}
  <rect width="${width}" height="${height}" rx="20" fill="url(#${AURORA_GRADIENT_ID})"/>`,
      };
    }

    case "particles": {
      // Deterministic positions: renderBadgeSvg is pure, so no Math.random.
      // The same handle always gets the same sky.
      const dots = Array.from({ length: 28 }, (_, i) => {
        const x = ((i * 137) % (width - 80)) + 40;
        const y = ((i * 89) % (height - 80)) + 40;
        const r = 1 + (i % 3) * 0.6;
        const twinkle = disableAnimation
          ? ""
          : `<animate attributeName="opacity" values="0.15;0.5;0.15" dur="${3 + (i % 4)}s" begin="${(i % 7) * 0.3}s" repeatCount="indefinite"/>`;
        return `<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="#C4B5FD" opacity="0.28">${twinkle}</circle>`;
      }).join("");
      return { defs: "", markup: `${plate}\n  <g>${dots}</g>` };
    }

    case "solid":
    default:
      return { defs: "", markup: plate };
  }
}

/* ── Score effect ───────────────────────────────────────────── */

const SCORE_GRADIENT_ID = "badge-score-paint";
const SCORE_FILTER_ID = "badge-score-filter";

export interface ScoreEffectFragment extends BadgeEffectFragment {
  /** Paint for the score text's `fill` attribute. */
  fill: string;
  /** Extra attributes for the score `<text>` element, or "". */
  attrs: string;
}

/**
 * The hero composite score's paint.
 *
 * `standard` is the default and returns the theme's primary text colour, so the
 * score element is emitted exactly as before.
 */
export function renderScoreEffect(
  scoreEffect: BadgeConfig["scoreEffect"],
  ctx: BadgeEffectContext & { textPrimary: string },
): ScoreEffectFragment {
  const { textPrimary, disableAnimation } = ctx;
  const paint = `url(#${SCORE_GRADIENT_ID})`;

  const gradient = (stops: string, animated: boolean) =>
    `<linearGradient id="${SCORE_GRADIENT_ID}" x1="0" y1="0" x2="1" y2="0">
      ${stops}
      ${animated && !disableAnimation ? `<animate attributeName="x1" values="-1;1" dur="2.5s" repeatCount="indefinite"/><animate attributeName="x2" values="0;2" dur="2.5s" repeatCount="indefinite"/>` : ""}
    </linearGradient>`;

  switch (scoreEffect) {
    case "gold-shimmer":
      return {
        defs: gradient(
          `<stop offset="0%" stop-color="#B45309"/><stop offset="50%" stop-color="#FDE68A"/><stop offset="100%" stop-color="#B45309"/>`,
          true,
        ),
        markup: "",
        fill: paint,
        attrs: "",
      };

    case "gold-leaf":
      return {
        defs: gradient(
          `<stop offset="0%" stop-color="#A16207"/><stop offset="45%" stop-color="#FCD34D"/><stop offset="100%" stop-color="#78350F"/>`,
          false,
        ),
        markup: "",
        fill: paint,
        attrs: "",
      };

    case "chrome":
      return {
        defs: gradient(
          `<stop offset="0%" stop-color="#6B7280"/><stop offset="50%" stop-color="#F3F4F6"/><stop offset="100%" stop-color="#6B7280"/>`,
          false,
        ),
        markup: "",
        fill: paint,
        attrs: "",
      };

    case "embossed":
      return {
        defs: `<filter id="${SCORE_FILTER_ID}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="0" flood-color="#000000" flood-opacity="0.55"/>
    </filter>`,
        markup: "",
        fill: textPrimary,
        attrs: ` filter="url(#${SCORE_FILTER_ID})"`,
      };

    case "neon-amber":
      return {
        defs: `<filter id="${SCORE_FILTER_ID}" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="glow"/>
      <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`,
        markup: "",
        fill: "#FBBF24",
        attrs: ` filter="url(#${SCORE_FILTER_ID})"`,
      };

    case "holographic":
      return {
        defs: gradient(
          `<stop offset="0%" stop-color="#F472B6"/><stop offset="33%" stop-color="#60A5FA"/><stop offset="66%" stop-color="#34D399"/><stop offset="100%" stop-color="#F472B6"/>`,
          true,
        ),
        markup: "",
        fill: paint,
        attrs: "",
      };

    case "standard":
    default:
      return { defs: "", markup: "", fill: textPrimary, attrs: "" };
  }
}

/* ── Tier treatment ─────────────────────────────────────────── */

/**
 * Decoration around the tier label.
 *
 * `standard` is the default and adds nothing. `enhanced` adds sparkle marks,
 * and only for the tiers that earn them — decorating every tier equally would
 * make the decoration meaningless.
 */
export function renderTierTreatment(
  treatment: BadgeConfig["tierTreatment"],
  ctx: { tier: string; centerX: number; y: number; color: string },
): BadgeEffectFragment {
  if (treatment !== "enhanced") return EMPTY_FRAGMENT;
  if (ctx.tier !== "High" && ctx.tier !== "Elite") return EMPTY_FRAGMENT;

  const { centerX, y, color } = ctx;
  const spark = (dx: number, scale: number) =>
    `<path d="M ${centerX + dx} ${y - 6} l ${2.5 * scale} ${5 * scale} l ${5 * scale} ${2.5 * scale} l ${-5 * scale} ${2.5 * scale} l ${-2.5 * scale} ${5 * scale} l ${-2.5 * scale} ${-5 * scale} l ${-5 * scale} ${-2.5 * scale} l ${5 * scale} ${-2.5 * scale} Z" fill="${color}" opacity="0.85"/>`;
  return {
    defs: "",
    markup: `${spark(-58, 0.7)}${spark(52, 0.55)}`,
  };
}

/* ── Card style ─────────────────────────────────────────────── */

const CARD_GRADIENT_ID = "badge-card-sheen";

/**
 * The card surface treatment — the one category that crosses only PARTIALLY.
 *
 * Studio's glass looks are built from `backdrop-filter: blur()`, which composites
 * against whatever sits behind the element. SVG has no equivalent: `feGaussianBlur`
 * blurs the source graphic, not the backdrop, and the badge is an opaque plate
 * with nothing behind it to sample. So these are approximations — a sheen
 * gradient per look — and they will NOT match the DOM preview pixel for pixel.
 *
 * That is a documented limitation of the "one artifact" work rather than a bug
 * to fix (docs/decisions/2026-08-30-one-badge-artifact.md). `flat` is the
 * default and adds nothing, so the default badge is untouched.
 */
export function renderCardStyleEffect(
  cardStyle: BadgeConfig["cardStyle"],
  ctx: BadgeEffectContext,
): BadgeEffectFragment {
  const { width, height } = ctx;

  const sheens: Record<string, string> = {
    frost: `<stop offset="0%" stop-color="#E0F2FE" stop-opacity="0.10"/><stop offset="100%" stop-color="#E0F2FE" stop-opacity="0.02"/>`,
    smoke: `<stop offset="0%" stop-color="#F5F3FF" stop-opacity="0.08"/><stop offset="100%" stop-color="#1F2937" stop-opacity="0.06"/>`,
    crystal: `<stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.14"/><stop offset="45%" stop-color="#FFFFFF" stop-opacity="0.02"/><stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.10"/>`,
    "aurora-glass": `<stop offset="0%" stop-color="${WARM_AMBER.accentLight}" stop-opacity="0.12"/><stop offset="50%" stop-color="#38BDF8" stop-opacity="0.07"/><stop offset="100%" stop-color="#FBBF24" stop-opacity="0.10"/>`,
  };

  const stops = sheens[cardStyle];
  if (!stops) return EMPTY_FRAGMENT;

  return {
    defs: `<linearGradient id="${CARD_GRADIENT_ID}" x1="0" y1="0" x2="0.6" y2="1">
      ${stops}
    </linearGradient>`,
    markup: `<rect width="${width}" height="${height}" rx="20" fill="url(#${CARD_GRADIENT_ID})"/>`,
  };
}
