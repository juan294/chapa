/**
 * Render the craft score indicator pill for the badge SVG.
 * Returns empty string if no craft score.
 */
export function renderBadgeCraft(
  x: number,
  y: number,
  craftScore: number | null,
): string {
  if (craftScore == null) return "";

  const label = "AI Craft";
  const scoreStr = String(craftScore);
  // Pill sizing: padX + "AI Craft" + gap + score + padX
  const labelW = label.length * 6.5; // ~10px font, narrower chars
  const scoreW = scoreStr.length * 8; // ~12px font, wider chars
  const gap = 6;
  const padX = 10;
  const pillW = padX + labelW + gap + scoreW + padX;
  const pillH = 24;
  const pillR = 6;

  return `
  <g transform="translate(${x}, ${y})">
    <rect width="${pillW}" height="${pillH}" rx="${pillR}"
      fill="rgba(139,92,246,0.08)" stroke="rgba(139,92,246,0.15)" stroke-width="1"/>
    <text x="${padX}" y="16"
      font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="10"
      fill="#8B8FA0">${label}</text>
    <text x="${padX + labelW + gap}" y="16"
      font-family="'JetBrains Mono', monospace" font-size="12" font-weight="700"
      fill="#8B5CF6">${scoreStr}</text>
  </g>`;
}
