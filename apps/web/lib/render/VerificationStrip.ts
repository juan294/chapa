import { escapeXml } from "./escape";

const CORAL = "#E05A47";

/**
 * Render a vertical verification strip on the right edge of the badge SVG.
 * Like a wax seal on a document — subtle coral accent.
 *
 * Placement: right padding zone (x≈1145–1185), full badge height.
 * Elements: separator line, shield icon, rotated text "VERIFIED · {hash} · {date}".
 */
export function renderVerificationStrip(hash: string, date: string): string {
  const safeHash = escapeXml(hash);
  const safeDate = escapeXml(date);

  const lineX = 1145;
  const centerX = 1168;
  const textY = 315; // center of rotation

  return `<g aria-label="Verification seal">
  <!-- Separator line -->
  <line x1="${lineX}" y1="30" x2="${lineX}" y2="600" stroke="${CORAL}" stroke-width="1" opacity="0.15"/>
  <!-- Shield icon -->
  <g transform="translate(${centerX - 8}, 40) scale(0.7)" opacity="0.25">
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5L12 1zm-1.5 14.5l-4-4 1.41-1.41L10.5 12.67l5.59-5.59L17.5 8.5l-7 7z" fill="${CORAL}"/>
  </g>
  <!-- Vertical text (bottom-to-top) -->
  <text transform="rotate(-90 ${centerX} ${textY})" x="${centerX}" y="${textY}" font-family="'JetBrains Mono', monospace" font-size="11" fill="${CORAL}" opacity="0.30" text-anchor="middle" letter-spacing="2">VERIFIED \u00B7 ${safeHash} \u00B7 ${safeDate}</text>
</g>`;
}
