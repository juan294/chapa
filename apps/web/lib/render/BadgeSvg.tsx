import type { Stats90d, ImpactV3Result } from "@chapa/shared";
import { WARM_AMBER, getTierColor } from "./theme";
import { buildHeatmapCells, renderHeatmapSvg } from "./heatmap";
import { renderGithubBranding } from "./GithubBranding";
import { escapeXml } from "./escape";

interface BadgeOptions {
  includeGithubBranding?: boolean;
  avatarDataUri?: string;
}

export function renderBadgeSvg(
  stats: Stats90d,
  impact: ImpactV3Result,
  options: BadgeOptions = {},
): string {
  const { includeGithubBranding = true, avatarDataUri } = options;
  const t = WARM_AMBER;
  const safeHandle = escapeXml(stats.handle);
  const headerName = stats.displayName
    ? escapeXml(stats.displayName)
    : `@${safeHandle}`;
  const tierColor = getTierColor(impact.tier);

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

  // Right column: impact score + achievement cards + active days
  const scoreColX = 670;
  const scoreColW = W - PAD - scoreColX; // 470px
  const scoreLabelY = 160;
  const scoreValueY = scoreLabelY + 95;

  // ── Achievement cards ─────────────────────────────────────────
  // Defense-in-depth: coerce numeric stats to prevent XSS from malformed data
  const safeCommits = String(Number(stats.commitsTotal));
  const safePRs = String(Number(stats.prsMergedCount));
  const safeReviews = String(Number(stats.reviewsSubmittedCount));
  const safeActiveDays = String(Number(stats.activeDays));

  const cardsY = scoreValueY + 40;
  const cardGap = 12;
  const cardW = Math.floor((scoreColW - cardGap * 2) / 3);
  const cardH = 85;

  // ── Active days bar ───────────────────────────────────────────
  const activeDaysY = cardsY + cardH + 16;
  const barH = 60;
  const activeDaysRatio = Math.min(stats.activeDays / 90, 1);

  // ── Footer ──────────────────────────────────────────────────
  const footerDividerY = 540;
  const footerY = 575;

  // GitHub branding (footer)
  const brandingSvg = includeGithubBranding
    ? renderGithubBranding(PAD, footerY, W - PAD)
    : "";

  // Tier pill dimensions
  const tierText = `\u2605 ${impact.tier}`;
  const tierPillWidth = tierText.length * 12 + 30;

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
  <text x="${PAD + 72}" y="${headerY - 6}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="22" font-weight="600" fill="${t.textPrimary}">${headerName}</text>
  <text x="${PAD + 72}" y="${headerY + 20}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="19" fill="${t.textSecondary}">Last 90 days</text>

  <!-- Verified icon (shield + checkmark, dimmed — no text label) -->
  <g transform="translate(${PAD + 72 + headerName.length * 11 + 8}, ${headerY - 20})" opacity="0.4">
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5L12 1zm-1.5 14.5l-4-4 1.41-1.41L10.5 12.67l5.59-5.59L17.5 8.5l-7 7z" fill="${t.accent}" transform="scale(0.75)"/>
  </g>

  <!-- Chapa_ logo (top-right) -->
  <text x="${W - PAD}" y="${headerY + 2}" font-family="'JetBrains Mono', monospace" font-size="20" fill="${t.textSecondary}" opacity="0.5" text-anchor="end" letter-spacing="-0.5">Chapa<tspan fill="${t.accent}">_</tspan></text>

  <!-- ─── Two-column body ────────────────────────────────── -->

  <!-- Left: ACTIVITY + heatmap -->
  <text x="${heatmapX}" y="${heatmapLabelY}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="14" fill="${t.textPrimary}" opacity="0.5" letter-spacing="2.5">ACTIVITY</text>
  ${heatmapSvg}

  <!-- Right: IMPACT SCORE + score + tier pill + confidence -->
  <text x="${scoreColX}" y="${scoreLabelY}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="14" fill="${t.textPrimary}" opacity="0.5" letter-spacing="2.5">IMPACT SCORE</text>

  <!-- Large score number -->
  <text x="${scoreColX}" y="${scoreValueY}" font-family="'JetBrains Mono', monospace" font-size="84" font-weight="700" fill="${t.textPrimary}" letter-spacing="-4" style="animation: pulse-glow 3s ease-in-out infinite">${impact.adjustedScore}</text>

  <!-- Tier pill badge (beside score) -->
  <g transform="translate(${scoreColX + (impact.adjustedScore >= 10 ? 120 : 68)}, ${scoreValueY - 48})">
    <rect width="${tierPillWidth}" height="34" rx="17" fill="rgba(124,106,239,0.10)" stroke="rgba(124,106,239,0.25)" stroke-width="1"/>
    <text x="${tierPillWidth / 2}" y="23" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="17" font-weight="600" fill="${tierColor}" text-anchor="middle">${tierText}</text>
  </g>

  <!-- Confidence (below tier) -->
  <text x="${scoreColX + (impact.adjustedScore >= 10 ? 120 : 68)}" y="${scoreValueY + 5}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="17" fill="${t.textSecondary}">${impact.confidence}% Confidence</text>

  <!-- ─── Achievement cards (3 stat blocks) ────────────────── -->
  <!-- Card 1: commits -->
  <g transform="translate(${scoreColX}, ${cardsY})">
    <rect width="${cardW}" height="${cardH}" rx="10" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
    <text x="${cardW / 2}" y="38" font-family="'JetBrains Mono', monospace" font-size="34" font-weight="700" fill="${t.textPrimary}" text-anchor="middle">${safeCommits}</text>
    <text x="${cardW / 2}" y="62" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="13" fill="${t.textSecondary}" text-anchor="middle" letter-spacing="1.5">COMMITS</text>
  </g>

  <!-- Card 2: PRs merged -->
  <g transform="translate(${scoreColX + cardW + cardGap}, ${cardsY})">
    <rect width="${cardW}" height="${cardH}" rx="10" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
    <text x="${cardW / 2}" y="38" font-family="'JetBrains Mono', monospace" font-size="34" font-weight="700" fill="${t.textPrimary}" text-anchor="middle">${safePRs}</text>
    <text x="${cardW / 2}" y="62" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="13" fill="${t.textSecondary}" text-anchor="middle" letter-spacing="1.5">PRS MERGED</text>
  </g>

  <!-- Card 3: reviews -->
  <g transform="translate(${scoreColX + (cardW + cardGap) * 2}, ${cardsY})">
    <rect width="${cardW}" height="${cardH}" rx="10" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
    <text x="${cardW / 2}" y="38" font-family="'JetBrains Mono', monospace" font-size="34" font-weight="700" fill="${t.textPrimary}" text-anchor="middle">${safeReviews}</text>
    <text x="${cardW / 2}" y="62" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="13" fill="${t.textSecondary}" text-anchor="middle" letter-spacing="1.5">REVIEWS</text>
  </g>

  <!-- ─── Active Days bar ──────────────────────────────────── -->
  <g transform="translate(${scoreColX}, ${activeDaysY})">
    <rect width="${scoreColW}" height="${barH}" rx="10" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
    <text x="16" y="26" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="13" fill="${t.textSecondary}" letter-spacing="1.5">ACTIVE DAYS</text>
    <text x="${scoreColW - 16}" y="26" font-family="'JetBrains Mono', monospace" font-size="17" fill="${t.textPrimary}" text-anchor="end"><tspan fill="#4ADE80" font-weight="700">${safeActiveDays}</tspan><tspan fill="${t.textSecondary}">/90</tspan></text>
    <!-- Progress bar background -->
    <rect x="16" y="38" width="${scoreColW - 32}" height="12" rx="6" fill="rgba(255,255,255,0.06)"/>
    <!-- Progress bar fill (gradient from accent to green) -->
    <defs><linearGradient id="active-days-grad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${t.accent}"/><stop offset="100%" stop-color="#4ADE80"/></linearGradient></defs>
    <rect x="16" y="38" width="${Math.round((scoreColW - 32) * activeDaysRatio)}" height="12" rx="6" fill="url(#active-days-grad)"/>
  </g>

  <!-- ─── Footer ─────────────────────────────────────────── -->
  <!-- Divider line -->
  <line x1="${PAD}" y1="${footerDividerY}" x2="${W - PAD}" y2="${footerDividerY}" stroke="${t.stroke}" stroke-width="1"/>

  <!-- Branding: left = GitHub, right = domain -->
  ${brandingSvg}
</svg>`;
}
