import type { Stats90d, ImpactV3Result } from "@chapa/shared";
import { WARM_AMBER, getTierColor } from "./theme";
import { buildHeatmapCells, renderHeatmapSvg } from "./heatmap";
import { renderGithubBranding } from "./GithubBranding";
import { escapeXml } from "./escape";

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

  // ── Header row ──────────────────────────────────────────────
  const headerY = 70;
  const avatarCX = PAD + 24;
  const avatarCY = headerY;
  const avatarR = 24;

  // ── Two-column body ─────────────────────────────────────────
  // Left column: heatmap
  const heatmapLabelY = 175;
  const heatmapX = PAD;
  const heatmapY = heatmapLabelY + 22;
  const heatmapCells = buildHeatmapCells(stats.heatmapData, heatmapX, heatmapY);
  const heatmapSvg = renderHeatmapSvg(heatmapCells);

  // Right column: impact score
  const scoreColX = 580;
  const scoreLabelY = 175;
  const scoreValueY = scoreLabelY + 75;

  // ── Stats row ───────────────────────────────────────────────
  const statsY = 480;

  // ── Footer ──────────────────────────────────────────────────
  const footerDividerY = 540;
  const footerY = 570;

  // GitHub branding (footer)
  const brandingSvg = includeGithubBranding
    ? renderGithubBranding(PAD, footerY, W - PAD)
    : "";

  // Tier pill dimensions
  const tierText = `\u2605 ${impact.tier}`;
  const tierPillWidth = tierText.length * 8 + 24;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <style>
      @keyframes pulse-glow {
        0%, 100% { opacity: 0.7; }
        50% { opacity: 1; }
      }
    </style>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" rx="20" fill="${t.bg}"/>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="19" fill="none" stroke="${t.stroke}" stroke-width="2"/>

  <!-- ─── Header row ─────────────────────────────────────── -->
  <!-- Avatar placeholder (circle with amber ring) -->
  <circle cx="${avatarCX}" cy="${avatarCY}" r="${avatarR}" fill="rgba(226,168,75,0.10)" stroke="rgba(226,168,75,0.20)" stroke-width="2"/>
  <g transform="translate(${avatarCX - 10}, ${avatarCY - 10})">
    <path d="M10 0C4.48 0 0 4.48 0 10c0 4.42 2.86 8.16 6.84 9.49.5.09.66-.21.66-.47 0-.24-.01-1.03-.01-1.86-2.51.46-3.16-.61-3.36-1.18-.11-.29-.6-1.18-1.03-1.41-.35-.19-.85-.65-.01-.66.79-.01 1.35.72 1.54 1.03.9 1.51 2.34 1.09 2.91.83.09-.65.35-1.09.64-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.26 2.75 1.03.8-.22 1.65-.34 2.5-.34s1.7.11 2.5.34c1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.69 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85 0 1.34-.01 2.41-.01 2.75 0 .26.18.58.68.48A10.02 10.02 0 0020 10c0-5.52-4.48-10-10-10z" fill="${t.textSecondary}" opacity="0.5" transform="scale(1)"/>
  </g>

  <!-- Handle + subtitle -->
  <text x="${PAD + 60}" y="${headerY - 4}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="18" font-weight="600" fill="${t.textPrimary}">@${safeHandle}</text>
  <text x="${PAD + 60}" y="${headerY + 16}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="13" fill="${t.textSecondary}">Last 90 days</text>

  <!-- Chapa. logo (top-right) -->
  <text x="${W - PAD}" y="${headerY + 2}" font-family="'JetBrains Mono', monospace" font-size="16" fill="${t.textSecondary}" opacity="0.5" text-anchor="end" letter-spacing="-0.5">Chapa<tspan fill="${t.accent}">.</tspan></text>

  <!-- ─── Two-column body ────────────────────────────────── -->

  <!-- Left: ACTIVITY + heatmap -->
  <text x="${heatmapX}" y="${heatmapLabelY}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11" fill="${t.textSecondary}" opacity="0.6" letter-spacing="2">ACTIVITY</text>
  ${heatmapSvg}

  <!-- Right: IMPACT SCORE + score + tier pill + confidence -->
  <text x="${scoreColX}" y="${scoreLabelY}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11" fill="${t.textSecondary}" opacity="0.6" letter-spacing="2">IMPACT SCORE</text>

  <!-- Large score number -->
  <text x="${scoreColX}" y="${scoreValueY}" font-family="'JetBrains Mono', monospace" font-size="72" font-weight="700" fill="${t.textPrimary}" letter-spacing="-3" style="animation: pulse-glow 3s ease-in-out infinite">${impact.adjustedScore}</text>

  <!-- Tier pill badge -->
  <g transform="translate(${scoreColX + (impact.adjustedScore >= 10 ? 100 : 58)}, ${scoreValueY - 48})">
    <rect width="${tierPillWidth}" height="28" rx="14" fill="rgba(226,168,75,0.10)" stroke="rgba(226,168,75,0.20)" stroke-width="1"/>
    <text x="${tierPillWidth / 2}" y="18" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="13" font-weight="600" fill="${tierColor}" text-anchor="middle">${tierText}</text>
  </g>

  <!-- Confidence -->
  <text x="${scoreColX + (impact.adjustedScore >= 10 ? 100 : 58)}" y="${scoreValueY + 4}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="13" fill="${t.textSecondary}">${impact.confidence}% Confidence</text>

  <!-- ─── Stats row ──────────────────────────────────────── -->
  <text x="${W / 2}" y="${statsY}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="14" fill="${t.textSecondary}" text-anchor="middle">
    <tspan>${stats.commitsTotal} commits</tspan>
    <tspan fill="${t.stroke}" dx="12">|</tspan>
    <tspan dx="12">${stats.prsMergedCount} PRs merged</tspan>
    <tspan fill="${t.stroke}" dx="12">|</tspan>
    <tspan dx="12">${stats.reviewsSubmittedCount} reviews</tspan>
  </text>

  <!-- ─── Footer ─────────────────────────────────────────── -->
  <!-- Divider line -->
  <line x1="${PAD}" y1="${footerDividerY}" x2="${W - PAD}" y2="${footerDividerY}" stroke="${t.stroke}" stroke-width="1"/>

  <!-- Branding: left = GitHub, right = domain -->
  ${brandingSvg}
</svg>`;
}
