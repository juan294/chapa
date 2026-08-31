import { WARM_AMBER, type BadgeTheme } from "./theme";
import type { Platform } from "@chapa/shared";
import {
  BADGE_PLATFORM_LOGOS,
  orderBadgePlatforms,
} from "../badge-visual-metadata";

/**
 * Render the badge footer branding strip as SVG markup.
 *
 * Produces a pill containing platform logos (GitHub, Bitbucket, Codeberg, GitLab)
 * in canonical order, followed by the tagline and the chapa domain name.
 * Personal badges show only connected platforms; demo badges show all four.
 *
 * @param x - Left edge X coordinate for the branding strip
 * @param y - Baseline Y coordinate for text and logo placement
 * @param rightX - Right edge X coordinate (used for right-aligned domain text)
 * @param platforms - Array of platform identifiers whose logos should appear
 * @returns SVG markup string containing the branding elements
 */
export function renderBadgeBranding(
  x: number,
  y: number,
  rightX: number,
  platforms: Platform[],
  theme: BadgeTheme = WARM_AMBER,
): string {
  const logoSize = 20;
  const logoGap = 12;
  const pillPadX = 10;
  const pillPadY = 5;

  // Sort platforms in canonical order
  const sorted = orderBadgePlatforms(platforms);

  // Grouped pill container for logos
  const pillW = pillPadX * 2 + sorted.length * logoSize + (sorted.length - 1) * logoGap;
  const pillH = logoSize + pillPadY * 2;
  const pillY = y - pillPadY;
  const pillSvg = `<rect x="${x}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="${theme.tint(0.08)}" stroke="${theme.tint(0.15)}" stroke-width="1"/>`;

  const scale = (logoSize / 24).toFixed(4);
  const logosSvg = sorted
    .map((platform, i) => {
      const logoX = x + pillPadX + i * (logoSize + logoGap);
      return `<g transform="translate(${logoX}, ${y})"><path d="${BADGE_PLATFORM_LOGOS[platform]}" fill="#9AA4B2" opacity="0.8" transform="scale(${scale})"/></g>`;
    })
    .join("\n    ");

  const textStartX = x + pillW + 12;

  return `
    ${pillSvg}
    ${logosSvg}
    <text x="${textStartX}" y="${y + 14}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="17" fill="#9AA4B2"><tspan opacity="0.5">Forged from </tspan><tspan opacity="0.9">purpose</tspan><tspan opacity="0.5">. Driven by </tspan><tspan opacity="0.9">curiosity</tspan><tspan opacity="0.5">.</tspan></text>
    <text x="${rightX}" y="${y + 14}" font-family="'JetBrains Mono', monospace" font-size="17" fill="#9AA4B2" opacity="0.8" text-anchor="end">chapa.thecreativetoken.com</text>`;
}
