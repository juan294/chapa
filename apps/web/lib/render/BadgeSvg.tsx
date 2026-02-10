import type { Stats90d, ImpactV3Result } from "@chapa/shared";
import { WARM_AMBER, getTierColor } from "./theme";
import { buildHeatmapCells, renderHeatmapSvg } from "./heatmap";
import { renderGithubBranding } from "./GithubBranding";

export function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return c;
    }
  });
}

interface BadgeOptions {
  includeGithubBranding?: boolean;
}

export function renderBadgeSvg(
  stats: Stats90d,
  impact: ImpactV3Result,
  options: BadgeOptions = {},
): string {
  const { includeGithubBranding = true } = options;
  const t = WARM_AMBER;
  const safeHandle = escapeXml(stats.handle);
  const tierColor = getTierColor(impact.tier);

  // Layout constants
  const W = 1200;
  const H = 630;
  const PAD = 60;

  // Heatmap position
  const heatmapX = PAD;
  const heatmapY = 180;
  const heatmapCells = buildHeatmapCells(stats.heatmapData, heatmapX, heatmapY);
  const heatmapSvg = renderHeatmapSvg(heatmapCells);

  // Stats block (right side)
  const statsX = 380;
  const statsY = 180;

  // Impact block (right side, prominent)
  const impactX = 700;
  const impactY = 160;

  // GitHub branding (footer)
  const brandingSvg = includeGithubBranding
    ? renderGithubBranding(PAD, H - 40)
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <style>
      @keyframes pulse-glow {
        0%, 100% { opacity: 0.6; }
        50% { opacity: 1; }
      }
    </style>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" rx="16" fill="${t.bg}"/>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="15" fill="none" stroke="${t.stroke}" stroke-width="2"/>

  <!-- Title block -->
  <text x="${PAD}" y="75" font-family="'JetBrains Mono', 'Courier New', monospace" font-size="42" font-weight="700" fill="${t.accent}">CHAPA</text>
  <text x="${PAD}" y="105" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="16" fill="${t.textSecondary}">Developer Impact Badge</text>
  <text x="${PAD}" y="145" font-family="'JetBrains Mono', 'Courier New', monospace" font-size="24" font-weight="500" fill="${t.textPrimary}">@${safeHandle}</text>

  <!-- Heatmap (13w × 7d) -->
  <text x="${heatmapX}" y="${heatmapY - 12}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="12" fill="${t.textSecondary}">LAST 90 DAYS</text>
  ${heatmapSvg}

  <!-- Stats block -->
  <g font-family="'Plus Jakarta Sans', system-ui, sans-serif">
    <text x="${statsX}" y="${statsY}" font-size="12" fill="${t.textSecondary}" letter-spacing="1">COMMITS</text>
    <text x="${statsX}" y="${statsY + 36}" font-family="'JetBrains Mono', monospace" font-size="40" font-weight="700" fill="${t.textPrimary}">${stats.commitsTotal}</text>

    <text x="${statsX}" y="${statsY + 90}" font-size="12" fill="${t.textSecondary}" letter-spacing="1">PRS MERGED</text>
    <text x="${statsX}" y="${statsY + 126}" font-family="'JetBrains Mono', monospace" font-size="40" font-weight="700" fill="${t.textPrimary}">${stats.prsMergedCount}</text>

    <text x="${statsX}" y="${statsY + 180}" font-size="12" fill="${t.textSecondary}" letter-spacing="1">REVIEWS</text>
    <text x="${statsX}" y="${statsY + 216}" font-family="'JetBrains Mono', monospace" font-size="40" font-weight="700" fill="${t.textPrimary}">${stats.reviewsSubmittedCount}</text>
  </g>

  <!-- Impact block -->
  <g font-family="'JetBrains Mono', 'Courier New', monospace">
    <rect x="${impactX}" y="${impactY}" width="440" height="280" rx="12" fill="${t.card}" stroke="${t.stroke}" stroke-width="1"/>

    <text x="${impactX + 30}" y="${impactY + 45}" font-size="12" fill="${t.textSecondary}" letter-spacing="2" font-family="'Plus Jakarta Sans', system-ui, sans-serif">IMPACT</text>
    <text x="${impactX + 30}" y="${impactY + 100}" font-size="56" font-weight="800" fill="${tierColor}" style="animation: pulse-glow 3s ease-in-out infinite">${impact.tier.toUpperCase()}</text>

    <text x="${impactX + 30}" y="${impactY + 150}" font-size="12" fill="${t.textSecondary}" letter-spacing="1" font-family="'Plus Jakarta Sans', system-ui, sans-serif">SCORE</text>
    <text x="${impactX + 30}" y="${impactY + 190}" font-size="48" font-weight="700" fill="${t.accent}">${impact.adjustedScore}</text>
    <text x="${impactX + 120}" y="${impactY + 190}" font-size="20" fill="${t.textSecondary}">/ 100</text>

    <text x="${impactX + 30}" y="${impactY + 230}" font-size="12" fill="${t.textSecondary}" letter-spacing="1" font-family="'Plus Jakarta Sans', system-ui, sans-serif">CONFIDENCE</text>
    <text x="${impactX + 30}" y="${impactY + 260}" font-size="28" font-weight="500" fill="${t.textPrimary}">${impact.confidence}%</text>
  </g>

  <!-- Active days -->
  <text x="${PAD}" y="${H - 70}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="14" fill="${t.textSecondary}">
    <tspan fill="${t.accent}" font-weight="600">${stats.activeDays}</tspan> active days · <tspan fill="${t.accent}" font-weight="600">${stats.reposContributed}</tspan> repos
  </text>

  <!-- Footer branding -->
  ${brandingSvg}
</svg>`;
}
