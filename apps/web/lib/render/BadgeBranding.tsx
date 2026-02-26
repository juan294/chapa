import type { Platform } from "@chapa/shared";

/** SVG paths for platform logos (all 24×24 viewBox) */
const PLATFORM_LOGOS: Record<Platform, string> = {
  github:
    "M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z",
  bitbucket:
    "M.778 1.211a.768.768 0 00-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 00.77-.646l3.27-20.03a.768.768 0 00-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z",
  codeberg:
    "M11.955.49A12 12 0 0 0 0 12.49a12 12 0 0 0 1.832 6.373L11.838 5.928a.187.187 0 0 1 .324 0l10.006 12.935A12 12 0 0 0 24 12.49a12 12 0 0 0-12-12 12 12 0 0 0-.045 0zm.375 6.467l4.416 5.774-4.416 3.252-4.416-3.252z",
};

/** Canonical platform ordering: GitHub first, then alphabetical */
const PLATFORM_ORDER: Platform[] = ["github", "bitbucket", "codeberg"];

export function renderBadgeBranding(
  x: number,
  y: number,
  rightX: number,
  platforms: Platform[],
): string {
  const logoSize = 20;
  const logoGap = 12;
  const pillPadX = 10;
  const pillPadY = 5;

  // Sort platforms in canonical order
  const sorted = PLATFORM_ORDER.filter((p) => platforms.includes(p));

  // Grouped pill container for logos
  const pillW = pillPadX * 2 + sorted.length * logoSize + (sorted.length - 1) * logoGap;
  const pillH = logoSize + pillPadY * 2;
  const pillY = y - pillPadY;
  const pillSvg = `<rect x="${x}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="rgba(124,106,239,0.08)" stroke="rgba(124,106,239,0.15)" stroke-width="1"/>`;

  const scale = (logoSize / 24).toFixed(4);
  const logosSvg = sorted
    .map((platform, i) => {
      const logoX = x + pillPadX + i * (logoSize + logoGap);
      return `<g transform="translate(${logoX}, ${y})"><path d="${PLATFORM_LOGOS[platform]}" fill="#9AA4B2" opacity="0.8" transform="scale(${scale})"/></g>`;
    })
    .join("\n    ");

  const textStartX = x + pillW + 12;

  return `
    ${pillSvg}
    ${logosSvg}
    <text x="${textStartX}" y="${y + 14}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="17" fill="#9AA4B2"><tspan opacity="0.5">Forged from </tspan><tspan opacity="0.9">purpose</tspan><tspan opacity="0.5">. Driven by </tspan><tspan opacity="0.9">curiosity</tspan><tspan opacity="0.5">.</tspan></text>
    <text x="${rightX}" y="${y + 14}" font-family="'JetBrains Mono', monospace" font-size="17" fill="#9AA4B2" opacity="0.8" text-anchor="end">chapa.thecreativetoken.com</text>`;
}
