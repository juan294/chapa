import { VERIFICATION_CORAL } from "../badge-visual-metadata";
import { escapeXml } from "./escape";

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
  <line x1="${lineX}" y1="30" x2="${lineX}" y2="600" stroke="${VERIFICATION_CORAL}" stroke-width="1" opacity="0.15"/>
  <!-- Vertical text (bottom-to-top), clickable link to verification page.
       #1168 UX-H4: 14px/0.9 opacity (was 11px/0.50, ~2.1:1 contrast) \u2014 GitHub
       scales README images ~830/1200, so the un-scaled size must stay legible
       after that shrink. The <a> wrapper is inert in an <img> embed but is a
       working affordance on the share page's inline-SVG path \u2014 never remove it. -->
  <a href="${verifyUrl}" target="_blank">
    <text transform="rotate(-90 ${centerX} ${textY})" x="${centerX}" y="${textY}" font-family="'JetBrains Mono', monospace" font-size="14" font-weight="500" fill="${VERIFICATION_CORAL}" opacity="0.9" text-anchor="middle" letter-spacing="2" style="cursor:pointer">VERIFIED \u00B7 ${safeHash} \u00B7 ${safeDate}</text>
  </a>
</g>`;
}

/**
 * Render a demo/sample verification strip — same visual style as the real
 * strip but with a "NOT A REAL BADGE" message instead of a hash.
 * No clickable link. Used on archetype showcase pages.
 */
export function renderDemoVerificationStrip(): string {
  const lineX = 1145;
  const centerX = 1168;
  const textY = 315;

  return `<g aria-label="Sample badge indicator">
  <line x1="${lineX}" y1="30" x2="${lineX}" y2="600" stroke="${VERIFICATION_CORAL}" stroke-width="1" opacity="0.15"/>
  <!-- #1168 UX-H4: same legibility fix as the real strip (14px/0.9 opacity). -->
  <text transform="rotate(-90 ${centerX} ${textY})" x="${centerX}" y="${textY}" font-family="'JetBrains Mono', monospace" font-size="14" font-weight="500" fill="${VERIFICATION_CORAL}" opacity="0.9" text-anchor="middle" letter-spacing="2">SAMPLE \u00B7 NOT A REAL BADGE \u00B7 FOR ILLUSTRATION ONLY</text>
</g>`;
}
