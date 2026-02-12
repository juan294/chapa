import type { Stats90d, ImpactV4Result } from "@chapa/shared";
import { WARM_AMBER, getTierColor, getArchetypeColor } from "./theme";
import { buildHeatmapCells, renderHeatmapSvg } from "./heatmap";
import { renderGithubBranding } from "./GithubBranding";
import { renderRadarChart } from "./RadarChart";
import { escapeXml } from "./escape";

interface BadgeOptions {
  includeGithubBranding?: boolean;
  avatarDataUri?: string;
}

export function renderBadgeSvg(
  stats: Stats90d,
  impact: ImpactV4Result,
  options: BadgeOptions = {},
): string {
  const { includeGithubBranding = true, avatarDataUri } = options;
  const t = WARM_AMBER;
  const safeHandle = escapeXml(stats.handle);
  const headerName = stats.displayName
    ? escapeXml(stats.displayName)
    : `@${safeHandle}`;
  const tierColor = getTierColor(impact.tier);
  const archetypeColor = getArchetypeColor(impact.archetype);

  // Layout constants
  const W = 1200;
  const H = 630;
  const PAD = 60;

  // ── Header row ──────────────────────────────────────────────
  const headerY = 80;
  const avatarCX = PAD + 30;
  const avatarCY = headerY;
  const avatarR = 30;

  // ── Two-column body ─────────────────────────────────────────
  // Left column: heatmap (38px cells + 5px gap = 43px per cell)
  // 13 weeks = 559px wide, 7 days = 301px tall
  const heatmapLabelY = 160;
  const heatmapX = PAD;
  const heatmapY = heatmapLabelY + 25;
  const heatmapCells = buildHeatmapCells(stats.heatmapData, heatmapX, heatmapY);
  const heatmapSvg = renderHeatmapSvg(heatmapCells);

  // Right column: radar chart + archetype + composite + confidence
  const profileColX = 670;
  const profileColW = W - PAD - profileColX; // 470px
  const profileLabelY = 160;

  // Radar chart centered in the right column
  const radarCX = profileColX + profileColW / 2;
  const radarCY = profileLabelY + 120;
  const radarR = 85;
  const radarSvg = renderRadarChart(impact.dimensions, radarCX, radarCY, radarR);

  // Archetype label + composite score + tier (below radar chart)
  const archetypeY = radarCY + radarR + 42;
  const archetypeText = `\u2605 ${impact.archetype}`;
  const archetypePillWidth = archetypeText.length * 11 + 30;

  // ── Dimension cards (4 across full width) ─────────────────────
  // Defense-in-depth: coerce numeric values
  const dims = impact.dimensions;
  const safeBuilding = String(Number(dims.building));
  const safeGuarding = String(Number(dims.guarding));
  const safeConsistency = String(Number(dims.consistency));
  const safeBreadth = String(Number(dims.breadth));

  const cardsY = 470;
  const cardGap = 12;
  const totalCardWidth = W - PAD * 2;
  const cardW = Math.floor((totalCardWidth - cardGap * 3) / 4);
  const cardH = 55;

  // ── Footer ──────────────────────────────────────────────────
  const footerDividerY = 545;
  const footerY = 580;

  // GitHub branding (footer)
  const brandingSvg = includeGithubBranding
    ? renderGithubBranding(PAD, footerY, W - PAD)
    : "";

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
  <!-- Avatar (circular clip) -->
  <defs>
    <clipPath id="avatar-clip">
      <circle cx="${avatarCX}" cy="${avatarCY}" r="${avatarR}"/>
    </clipPath>
  </defs>
  <circle cx="${avatarCX}" cy="${avatarCY}" r="${avatarR}" fill="rgba(124,106,239,0.10)" stroke="rgba(124,106,239,0.25)" stroke-width="2"/>
  ${avatarDataUri ? `<image href="${avatarDataUri}" x="${avatarCX - avatarR}" y="${avatarCY - avatarR}" width="${avatarR * 2}" height="${avatarR * 2}" clip-path="url(#avatar-clip)"/>` : `<g transform="translate(${avatarCX - 14}, ${avatarCY - 14})">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 6.19 4.01 11.43 9.57 13.28.7.13.96-.3.96-.67 0-.34-.01-1.45-.02-2.61-3.52.64-4.42-.86-4.7-1.65-.16-.4-.84-1.65-1.44-1.98-.49-.26-1.19-.91-.02-.92 1.1-.02 1.89 1.01 2.16 1.43 1.26 2.12 3.27 1.52 4.07 1.16.13-.91.49-1.52.89-1.87-3.11-.35-6.37-1.55-6.37-6.92 0-1.52.55-2.78 1.44-3.76-.14-.35-.63-1.78.14-3.71 0 0 1.17-.37 3.85 1.44 1.12-.31 2.31-.47 3.5-.47s2.38.16 3.5.47c2.68-1.82 3.85-1.44 3.85-1.44.77 1.93.28 3.36.14 3.71.9.98 1.44 2.23 1.44 3.76 0 5.39-3.27 6.57-6.39 6.91.5.43.95 1.28.95 2.58 0 1.87-.02 3.37-.02 3.83 0 .37.26.81.96.67A14.03 14.03 0 0028 14c0-7.73-6.27-14-14-14z" fill="${t.textSecondary}" opacity="0.6"/>
  </g>`}

  <!-- Handle + subtitle -->
  <text x="${PAD + 72}" y="${headerY - 6}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="26" font-weight="600" fill="${t.textPrimary}">${headerName}</text>
  <text x="${PAD + 72}" y="${headerY + 20}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="19" fill="${t.textSecondary}">Last 90 days</text>

  <!-- Verified icon (shield + checkmark, dimmed — no text label) -->
  <g transform="translate(${PAD + 72 + headerName.length * 13 + 8}, ${headerY - 20})" opacity="0.4">
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5L12 1zm-1.5 14.5l-4-4 1.41-1.41L10.5 12.67l5.59-5.59L17.5 8.5l-7 7z" fill="${t.accent}" transform="scale(0.75)"/>
  </g>

  <!-- Chapa_ logo (top-right) -->
  <text x="${W - PAD}" y="${headerY + 2}" font-family="'JetBrains Mono', monospace" font-size="22" fill="${t.textSecondary}" opacity="0.7" text-anchor="end" letter-spacing="-0.5">Chapa<tspan fill="${t.accent}">_</tspan></text>

  <!-- ─── Two-column body ────────────────────────────────── -->

  <!-- Left: ACTIVITY + heatmap -->
  <text x="${heatmapX}" y="${heatmapLabelY}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="14" fill="${t.textPrimary}" opacity="0.5" letter-spacing="2.5">ACTIVITY</text>
  ${heatmapSvg}

  <!-- Right: DEVELOPER PROFILE + radar chart + archetype + composite -->
  <text x="${profileColX}" y="${profileLabelY}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="14" fill="${t.textPrimary}" opacity="0.5" letter-spacing="2.5">DEVELOPER PROFILE</text>

  <!-- Radar chart -->
  ${radarSvg}

  <!-- Archetype pill badge -->
  <g transform="translate(${radarCX - archetypePillWidth / 2}, ${archetypeY - 22})">
    <rect width="${archetypePillWidth}" height="34" rx="17" fill="rgba(124,106,239,0.10)" stroke="rgba(124,106,239,0.25)" stroke-width="1"/>
    <text x="${archetypePillWidth / 2}" y="23" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="17" font-weight="600" fill="${archetypeColor}" text-anchor="middle">${archetypeText}</text>
  </g>

  <!-- Composite score + tier + confidence -->
  <text x="${radarCX}" y="${archetypeY + 24}" font-family="'JetBrains Mono', monospace" font-size="22" font-weight="700" fill="${t.textPrimary}" text-anchor="middle" style="animation: pulse-glow 3s ease-in-out infinite">${impact.adjustedComposite}</text>
  <text x="${radarCX + 20}" y="${archetypeY + 24}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="17" fill="${tierColor}" text-anchor="start">${impact.tier}</text>
  <text x="${radarCX}" y="${archetypeY + 46}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="15" fill="${t.textPrimary}" opacity="0.7" text-anchor="middle">${impact.confidence}% Confidence</text>

  <!-- ─── Dimension cards (4 across full width) ────────────── -->
  <!-- Card 1: Building -->
  <g transform="translate(${PAD}, ${cardsY})">
    <rect width="${cardW}" height="${cardH}" rx="10" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
    <text x="${cardW / 2}" y="26" font-family="'JetBrains Mono', monospace" font-size="28" font-weight="700" fill="${t.textPrimary}" text-anchor="middle">${safeBuilding}</text>
    <text x="${cardW / 2}" y="45" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="13" fill="${t.textSecondary}" text-anchor="middle" letter-spacing="1.5">BUILDING</text>
  </g>

  <!-- Card 2: Guarding -->
  <g transform="translate(${PAD + cardW + cardGap}, ${cardsY})">
    <rect width="${cardW}" height="${cardH}" rx="10" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
    <text x="${cardW / 2}" y="26" font-family="'JetBrains Mono', monospace" font-size="28" font-weight="700" fill="${t.textPrimary}" text-anchor="middle">${safeGuarding}</text>
    <text x="${cardW / 2}" y="45" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="13" fill="${t.textSecondary}" text-anchor="middle" letter-spacing="1.5">GUARDING</text>
  </g>

  <!-- Card 3: Consistency -->
  <g transform="translate(${PAD + (cardW + cardGap) * 2}, ${cardsY})">
    <rect width="${cardW}" height="${cardH}" rx="10" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
    <text x="${cardW / 2}" y="26" font-family="'JetBrains Mono', monospace" font-size="28" font-weight="700" fill="${t.textPrimary}" text-anchor="middle">${safeConsistency}</text>
    <text x="${cardW / 2}" y="45" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="13" fill="${t.textSecondary}" text-anchor="middle" letter-spacing="1.5">CONSISTENCY</text>
  </g>

  <!-- Card 4: Breadth -->
  <g transform="translate(${PAD + (cardW + cardGap) * 3}, ${cardsY})">
    <rect width="${cardW}" height="${cardH}" rx="10" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
    <text x="${cardW / 2}" y="26" font-family="'JetBrains Mono', monospace" font-size="28" font-weight="700" fill="${t.textPrimary}" text-anchor="middle">${safeBreadth}</text>
    <text x="${cardW / 2}" y="45" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="13" fill="${t.textSecondary}" text-anchor="middle" letter-spacing="1.5">BREADTH</text>
  </g>

  <!-- ─── Footer ─────────────────────────────────────────── -->
  <!-- Divider line -->
  <line x1="${PAD}" y1="${footerDividerY}" x2="${W - PAD}" y2="${footerDividerY}" stroke="${t.stroke}" stroke-width="1"/>

  <!-- Branding: left = GitHub, right = domain -->
  ${brandingSvg}
</svg>`;
}
