import { escapeXml } from "./escape";

const CORAL = "#E05A47";

/**
 * Render a vertical verification strip on the right edge of the badge SVG.
 * Like a wax seal on a document — subtle coral accent.
 *
 * Placement: right padding zone (x≈1145–1185), full badge height.
 * Elements: separator line, rotated text "VERIFIED · {hash} · {date}".
 */
export function renderVerificationStrip(hash: string, date: string): string {
  const safeHash = escapeXml(hash);
  const safeDate = escapeXml(date);

  const lineX = 1145;
  const centerX = 1168;
  const textY = 315; // center of rotation

  const verifyUrl = `https://chapa.thecreativetoken.com/verify/${safeHash}`;

  return `<g aria-label="Verification seal">
  <!-- Separator line -->
  <line x1="${lineX}" y1="30" x2="${lineX}" y2="600" stroke="${CORAL}" stroke-width="1" opacity="0.15"/>
  <!-- Vertical text (bottom-to-top), clickable link to verification page -->
  <a href="${verifyUrl}" target="_blank">
    <text transform="rotate(-90 ${centerX} ${textY})" x="${centerX}" y="${textY}" font-family="'JetBrains Mono', monospace" font-size="11" fill="${CORAL}" opacity="0.50" text-anchor="middle" letter-spacing="2" style="cursor:pointer">VERIFIED \u00B7 ${safeHash} \u00B7 ${safeDate}</text>
  </a>
</g>`;
}
