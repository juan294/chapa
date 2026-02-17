import type { StatsData, ImpactV4Result } from "@chapa/shared";
import { formatCompact } from "@chapa/shared";
import { WARM_AMBER, getTierColor, getArchetypeColor } from "./theme";
import { buildHeatmapCells, renderHeatmapSvg } from "./heatmap";
import { renderGithubBranding } from "./GithubBranding";
import { renderRadarChart } from "./RadarChart";
import { escapeXml } from "./escape";
import { renderVerificationStrip, renderDemoVerificationStrip } from "./VerificationStrip";

interface BadgeOptions {
  includeGithubBranding?: boolean;
  avatarDataUri?: string;
  verificationHash?: string;
  verificationDate?: string;
  /** Render as a demo/sample badge — shows "Simulated metrics" and a sample verification strip */
  demoMode?: boolean;
}

export function renderBadgeSvg(
  stats: StatsData,
  impact: ImpactV4Result,
  options: BadgeOptions = {},
): string {
  const { includeGithubBranding = true, avatarDataUri, verificationHash, verificationDate, demoMode = false } = options;
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

  // ── Archetype + repo metrics pill row (above heatmap, left-aligned) ─
  const metaRowY = 160;
  const reposStr = formatCompact(stats.reposContributed ?? 0);
  const watchStr = formatCompact(stats.totalWatchers ?? 0);
  const forkStr = formatCompact(stats.totalForks ?? 0);
  const starsStr = formatCompact(stats.totalStars ?? 0);

  // Pill dimensions
  const pillH = 34;
  const pillR = 17;
  const pillGap = 8;
  const dotGap = 6; // extra space for · separator between pills
  // Archetype pill: icon(20) + gap(6) + text
  const archetypeText = impact.archetype;
  const archetypePillWidth = 14 + 20 + 6 + archetypeText.length * 10 + 14;
  // Metric pills: icon(16) + gap(4) + "count label"
  const reposLabel = `${reposStr} Repos`;
  const watchLabel = `${watchStr} Watch`;
  const forkLabel = `${forkStr} Fork`;
  const starLabel = `${starsStr} Star`;
  const metricCharW = 7.5;
  const reposPillW = 12 + 16 + 6 + reposLabel.length * metricCharW + 10;
  const watchPillW = 12 + 16 + 6 + watchLabel.length * metricCharW + 10;
  const forkPillW = 12 + 16 + 6 + forkLabel.length * metricCharW + 10;
  // Star uses inline ★ tspan (no separate icon <g>), so width = pad + text("★ " + label) + pad
  const starPillW = 12 + (starLabel.length + 2) * metricCharW + 10;

  // ── Two-column body ─────────────────────────────────────────
  // Left column: heatmap (44px cells + 5px gap = 49px per cell)
  const heatmapX = PAD;
  const heatmapY = 190; // shifted down 30px for meta row
  const heatmapCells = buildHeatmapCells(stats.heatmapData, heatmapX, heatmapY);
  const heatmapSvg = renderHeatmapSvg(heatmapCells);

  // Right column: radar chart + score ring (no pill — it moved above)
  const profileColX = 670;
  const profileColW = W - PAD - profileColX; // 470px

  // Radar chart centered in the right column
  const radarCX = profileColX + profileColW / 2;
  const radarCY = 275;
  const radarR = 85;
  const radarSvg = renderRadarChart(impact.dimensions, radarCX, radarCY, radarR);

  // ── Hero score ring (right column, below radar) ───────────
  const scoreStr = String(impact.adjustedComposite);
  const ringCY = 460;
  const ringR = 46;
  const ringCircumference = 2 * Math.PI * ringR; // ≈289.03
  const ringOffset = ringCircumference * (1 - impact.adjustedComposite / 100);
  const tierLabelY = ringCY + ringR + 24;

  // ── Footer ──────────────────────────────────────────────────
  const footerDividerY = 560;
  const footerY = 585;

  // GitHub branding (footer)
  const brandingSvg = includeGithubBranding
    ? renderGithubBranding(PAD, footerY, W - PAD)
    : "";

  // Verification strip (right edge)
  const verificationSvg = demoMode
    ? renderDemoVerificationStrip()
    : verificationHash && verificationDate
      ? renderVerificationStrip(verificationHash, verificationDate)
      : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <style>
      @keyframes pulse-glow {
        0%, 100% { opacity: 0.7; }
        50% { opacity: 1; }
      }
      @keyframes ring-draw {
        from { stroke-dashoffset: ${ringCircumference.toFixed(2)}; }
        to   { stroke-dashoffset: ${ringOffset.toFixed(2)}; }
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
  ${avatarDataUri ? `<image href="${escapeXml(avatarDataUri)}" x="${avatarCX - avatarR}" y="${avatarCY - avatarR}" width="${avatarR * 2}" height="${avatarR * 2}" clip-path="url(#avatar-clip)"/>` : `<g transform="translate(${avatarCX - 14}, ${avatarCY - 14})">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 6.19 4.01 11.43 9.57 13.28.7.13.96-.3.96-.67 0-.34-.01-1.45-.02-2.61-3.52.64-4.42-.86-4.7-1.65-.16-.4-.84-1.65-1.44-1.98-.49-.26-1.19-.91-.02-.92 1.1-.02 1.89 1.01 2.16 1.43 1.26 2.12 3.27 1.52 4.07 1.16.13-.91.49-1.52.89-1.87-3.11-.35-6.37-1.55-6.37-6.92 0-1.52.55-2.78 1.44-3.76-.14-.35-.63-1.78.14-3.71 0 0 1.17-.37 3.85 1.44 1.12-.31 2.31-.47 3.5-.47s2.38.16 3.5.47c2.68-1.82 3.85-1.44 3.85-1.44.77 1.93.28 3.36.14 3.71.9.98 1.44 2.23 1.44 3.76 0 5.39-3.27 6.57-6.39 6.91.5.43.95 1.28.95 2.58 0 1.87-.02 3.37-.02 3.83 0 .37.26.81.96.67A14.03 14.03 0 0028 14c0-7.73-6.27-14-14-14z" fill="${t.textSecondary}" opacity="0.6"/>
  </g>`}

  <!-- Handle -->
  <text x="${PAD + 72}" y="${headerY - 6}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="26" font-weight="600" fill="${t.textPrimary}">${headerName}</text>
  <!-- ${demoMode ? "Simulated" : "Verified"} icon (shield + checkmark) before subtitle -->
  <g transform="translate(${PAD + 72}, ${headerY + 6})" opacity="0.4">
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5L12 1zm-1.5 14.5l-4-4 1.41-1.41L10.5 12.67l5.59-5.59L17.5 8.5l-7 7z" fill="${demoMode ? "#6B6F7B" : t.accent}" transform="scale(0.7)"/>
  </g>
  <text x="${PAD + 72 + 20}" y="${headerY + 20}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="19" fill="${t.textSecondary}">${demoMode ? "Simulated metrics" : "Verified metrics"}</text>

  <!-- Chapa_ logo (top-right) -->
  <text x="${W - PAD}" y="${headerY + 2}" font-family="'JetBrains Mono', monospace" font-size="22" fill="${t.textSecondary}" opacity="0.7" text-anchor="end" letter-spacing="-0.5">Chapa<tspan fill="${t.accent}">_</tspan></text>

  <!-- ─── Archetype + metric pills row (above heatmap) ────── -->
  <!-- Archetype pill with code-brackets icon -->
  <g transform="translate(${heatmapX}, ${metaRowY - pillH / 2})">
    <rect width="${archetypePillWidth}" height="${pillH}" rx="${pillR}" fill="rgba(124,106,239,0.10)" stroke="rgba(124,106,239,0.25)" stroke-width="1"/>
    <g transform="translate(14, 8)">
      <path d="M8 2L3 8.5L8 15" fill="none" stroke="${archetypeColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M14 2L19 8.5L14 15" fill="none" stroke="${archetypeColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <text x="${14 + 20 + 6 + archetypeText.length * 10 / 2}" y="23" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="17" font-weight="600" fill="${archetypeColor}" text-anchor="middle">${escapeXml(archetypeText)}</text>
  </g>
  <!-- · separator -->
  <text x="${heatmapX + archetypePillWidth + pillGap + dotGap}" y="${metaRowY + 5}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="16" fill="${t.textSecondary}" opacity="0.4">\u00B7</text>
  <!-- Repos pill -->
  <g transform="translate(${heatmapX + archetypePillWidth + pillGap + dotGap * 2 + pillGap}, ${metaRowY - pillH / 2})">
    <rect width="${reposPillW}" height="${pillH}" rx="${pillR}" fill="rgba(124,106,239,0.06)" stroke="rgba(124,106,239,0.15)" stroke-width="1"/>
    <g transform="translate(12, 9)" opacity="0.7">
      <path d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3zm6 0v10M2 8h12" fill="none" stroke="${t.textSecondary}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <text x="${12 + 16 + 6}" y="23" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="14" fill="${t.textSecondary}">${reposLabel}</text>
  </g>
  <!-- · separator -->
  <text x="${heatmapX + archetypePillWidth + pillGap + dotGap * 2 + pillGap + reposPillW + pillGap + dotGap}" y="${metaRowY + 5}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="16" fill="${t.textSecondary}" opacity="0.4">\u00B7</text>
  <!-- Watch pill -->
  <g transform="translate(${heatmapX + archetypePillWidth + pillGap + dotGap * 2 + pillGap + reposPillW + pillGap + dotGap * 2 + pillGap}, ${metaRowY - pillH / 2})">
    <rect width="${watchPillW}" height="${pillH}" rx="${pillR}" fill="rgba(124,106,239,0.06)" stroke="rgba(124,106,239,0.15)" stroke-width="1"/>
    <g transform="translate(12, 9)">
      <path d="M1 7.5C1 7.5 3.5 2.5 8 2.5S15 7.5 15 7.5S12.5 12.5 8 12.5S1 7.5 1 7.5Z" fill="none" stroke="${t.textSecondary}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
      <circle cx="8" cy="7.5" r="2.5" fill="none" stroke="${t.textSecondary}" stroke-width="1.3" opacity="0.7"/>
    </g>
    <text x="${12 + 16 + 6}" y="23" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="14" fill="${t.textSecondary}">${watchLabel}</text>
  </g>
  <!-- · separator -->
  <text x="${heatmapX + archetypePillWidth + pillGap + dotGap * 2 + pillGap + reposPillW + pillGap + dotGap * 2 + pillGap + watchPillW + pillGap + dotGap}" y="${metaRowY + 5}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="16" fill="${t.textSecondary}" opacity="0.4">\u00B7</text>
  <!-- Fork pill -->
  <g transform="translate(${heatmapX + archetypePillWidth + pillGap + dotGap * 2 + pillGap + reposPillW + pillGap + dotGap * 2 + pillGap + watchPillW + pillGap + dotGap * 2 + pillGap}, ${metaRowY - pillH / 2})">
    <rect width="${forkPillW}" height="${pillH}" rx="${pillR}" fill="rgba(124,106,239,0.06)" stroke="rgba(124,106,239,0.15)" stroke-width="1"/>
    <g transform="translate(12, 9)" opacity="0.7">
      <path d="M6 3a2 2 0 1 0-4 0 2 2 0 0 0 4 0zM6 11a2 2 0 1 0-4 0 2 2 0 0 0 4 0zM14 3a2 2 0 1 0-4 0 2 2 0 0 0 4 0zM4 5v2a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V5" fill="none" stroke="${t.textSecondary}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" transform="scale(0.95)"/>
    </g>
    <text x="${12 + 16 + 6}" y="23" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="14" fill="${t.textSecondary}">${forkLabel}</text>
  </g>
  <!-- · separator -->
  <text x="${heatmapX + archetypePillWidth + pillGap + dotGap * 2 + pillGap + reposPillW + pillGap + dotGap * 2 + pillGap + watchPillW + pillGap + dotGap * 2 + pillGap + forkPillW + pillGap + dotGap}" y="${metaRowY + 5}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="16" fill="${t.textSecondary}" opacity="0.4">\u00B7</text>
  <!-- Star pill -->
  <g transform="translate(${heatmapX + archetypePillWidth + pillGap + dotGap * 2 + pillGap + reposPillW + pillGap + dotGap * 2 + pillGap + watchPillW + pillGap + dotGap * 2 + pillGap + forkPillW + pillGap + dotGap * 2 + pillGap}, ${metaRowY - pillH / 2})">
    <rect width="${starPillW}" height="${pillH}" rx="${pillR}" fill="rgba(124,106,239,0.06)" stroke="rgba(124,106,239,0.15)" stroke-width="1"/>
    <text x="12" y="23" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="14" fill="${t.textSecondary}"><tspan fill="${t.accent}">\u2605</tspan> ${starLabel}</text>
  </g>

  <!-- ─── Two-column body ────────────────────────────────── -->

  <!-- Left: heatmap -->
  ${heatmapSvg}

  <!-- Right: radar chart -->
  ${radarSvg}

  <!-- ─── Hero composite score ring (right column) ────────── -->
  <!-- Ring track (background) -->
  <circle cx="${radarCX}" cy="${ringCY}" r="${ringR}" fill="none" stroke="rgba(124,106,239,0.10)" stroke-width="4"/>
  <!-- Ring arc (foreground, tier-colored, animates from 0 to score) -->
  <circle cx="${radarCX}" cy="${ringCY}" r="${ringR}" fill="none" stroke="${tierColor}" stroke-width="4" stroke-dasharray="${ringCircumference.toFixed(2)}" stroke-dashoffset="${ringOffset.toFixed(2)}" stroke-linecap="round" transform="rotate(-90 ${radarCX} ${ringCY})" style="animation: ring-draw 1.2s ease-out 0.5s both"/>
  <!-- Score number (centered inside ring) -->
  <text x="${radarCX}" y="${ringCY}" font-family="'JetBrains Mono', monospace" font-size="52" font-weight="700" fill="${t.textPrimary}" text-anchor="middle" dominant-baseline="central" style="animation: pulse-glow 3s ease-in-out infinite">${scoreStr}</text>
  <!-- Tier label (always visible below ring) -->
  <text x="${radarCX}" y="${tierLabelY}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="17" fill="${tierColor}" text-anchor="middle">${escapeXml(impact.tier)}</text>

  <!-- ─── Footer ─────────────────────────────────────────── -->
  <!-- Divider line -->
  <line x1="${PAD}" y1="${footerDividerY}" x2="${W - PAD}" y2="${footerDividerY}" stroke="${t.stroke}" stroke-width="1"/>

  <!-- Branding: left = GitHub, right = domain -->
  ${brandingSvg}

  <!-- Verification seal (right edge) -->
  ${verificationSvg}
</svg>`;
}
