import type { StatsData, ImpactV6Result, Platform, BadgeConfig } from "@chapa/shared";
import { formatCompact, DEFAULT_BADGE_CONFIG } from "@chapa/shared";
import { WARM_AMBER, accentTint, getTierColor, getArchetypeColor } from "./theme";
import { buildHeatmapCells, renderHeatmapSvg } from "./heatmap";
import { renderBadgeBranding } from "./BadgeBranding";
import { renderRadarChart, type RadarChartLabels } from "./RadarChart";
import { escapeXml } from "./escape";
import {
  renderBackgroundEffect,
  renderBorderEffect,
  renderCardStyleEffect,
  renderScoreEffect,
  renderTierTreatment,
} from "./badge-effects";
import { renderVerificationStrip, renderDemoVerificationStrip } from "./VerificationStrip";
import { VERIFICATION_CORAL } from "../badge-visual-metadata";

/**
 * Locale-resolved strings for the ~10 literals rendered directly onto the
 * badge SVG (#1181 UX-H3). All fields optional and independently defaulted
 * to their current English text — `renderBadgeSvg` stays a pure, synchronous
 * function: the caller (the badge.svg route) resolves these via `getServerT`
 * and passes plain strings in. Existing callers that omit `strings` entirely
 * (share page, og-image route, warm-cache cron, demo/archetype pages) keep
 * producing byte-identical English output.
 */
export interface BadgeI18nStrings {
  metricsSimulated?: string;
  metricsVerified?: string;
  metricsPublic?: string;
  /** Pre-resolved translated label for `impact.tier` (e.g. "Sólido" for "Solid"). */
  tierLabel?: string;
  radarLabels?: Partial<Omit<RadarChartLabels, "noData">>;
  radarNoData?: string;
  verifiedLabel?: string;
  sampleDisclosure?: string;
}

interface BadgeOptions {
  includeBranding?: boolean;
  avatarDataUri?: string;
  verificationHash?: string;
  verificationDate?: string;
  /** Render as a demo/sample badge — shows "Simulated metrics" and a sample verification strip */
  demoMode?: boolean;
  /**
   * Disable SMIL animations on the heatmap (renders static, fully-opaque cells).
   *
   * SMIL `<animate>` does not run when the SVG is embedded via `<img>` (e.g. the
   * badge.svg route consumed in README badges), which would leave cells stuck at
   * `opacity="0"`. Pass `true` for `<img>`-embedded badges; leave `false`/unset for
   * interactive in-DOM previews where animation runs. (#760)
   */
  disableAnimation?: boolean;
  /** Locale-resolved badge strings (#1181). Omit for English (default). */
  strings?: BadgeI18nStrings;
  /**
   * Creator Studio's visual configuration (#1191). Omitted means
   * `DEFAULT_BADGE_CONFIG`, which renders byte-identically to the pre-#1191
   * badge — no existing cached badge or embedded README image moves.
   *
   * Passed IN rather than read from a store: `renderBadgeSvg` must stay pure,
   * because that purity is what makes the SVG cacheable per handle/day/locale
   * and rasterizable to PNG.
   */
  config?: BadgeConfig;
}

/**
 * Render the complete Chapa badge as an SVG markup string (1200x630).
 *
 * Composes header (avatar, handle, verified status), archetype + metric pills,
 * heatmap grid, radar chart, score ring, footer branding, and verification strip
 * into a single self-contained SVG. The output is embeddable as an `<img>` tag.
 *
 * All user-controlled text (handle, display name) is XML-escaped to prevent XSS.
 * The badge always renders in dark theme regardless of the site's current theme.
 *
 * @param stats - Aggregated GitHub stats providing handle, metrics, and heatmap data
 * @param impact - Computed Impact v6 result with dimensions, archetype, tier, and score
 * @param options - Visual options: branding toggle, avatar data URI, verification hash/date, demo mode
 * @returns A complete SVG document as a string, ready for HTTP response or embedding
 */
export function renderBadgeSvg(
  stats: StatsData,
  impact: ImpactV6Result,
  options: BadgeOptions = {},
): string {
  const { includeBranding = true, avatarDataUri, verificationHash, verificationDate, demoMode = false, disableAnimation = false, strings = {}, config = DEFAULT_BADGE_CONFIG } = options;
  const hasVerification = Boolean(verificationHash && verificationDate);
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

  // #1191 — Studio's config compiled to SVG. Pure builders; see badge-effects.ts
  // for the rules every effect must satisfy (no CSS custom properties, and a
  // static first frame whenever SMIL cannot run).
  const effectContext = {
    width: W,
    height: H,
    stroke: t.stroke,
    disableAnimation,
  };
  const borderEffect = renderBorderEffect(config.border, effectContext);
  const backgroundEffect = renderBackgroundEffect(config.background, {
    ...effectContext,
    fill: t.bg,
  });
  const cardStyleEffect = renderCardStyleEffect(config.cardStyle, effectContext);
  const scoreEffect = renderScoreEffect(config.scoreEffect, {
    ...effectContext,
    textPrimary: t.textPrimary,
  });

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
  const heatmapCells = buildHeatmapCells(
    stats.heatmapData,
    heatmapX,
    heatmapY,
    config.heatmapAnimation,
  );
  const heatmapSvg = renderHeatmapSvg(heatmapCells, { disableAnimation });

  // Right column: radar chart + score ring (no pill — it moved above)
  const profileColX = 720;
  const profileColW = W - PAD - profileColX; // 420px

  // Radar chart centered in the right column
  const radarCX = profileColX + profileColW / 2;
  const radarCY = 275;
  const radarR = 85;
  const radarLabels: RadarChartLabels = {
    delivery: strings.radarLabels?.delivery ?? "Delivery",
    quality: strings.radarLabels?.quality ?? "Quality",
    consistency: strings.radarLabels?.consistency ?? "Consistency",
    breadth: strings.radarLabels?.breadth ?? "Breadth",
    craft: strings.radarLabels?.craft ?? "Craft",
    noData: strings.radarNoData ?? "no data yet",
  };
  const radarSvg = renderRadarChart(impact.dimensions, radarCX, radarCY, radarR, radarLabels);

  // ── Hero score ring (right column, below radar) ───────────
  const scoreStr = String(impact.adjustedComposite);
  // #1181 — pre-resolved translated tier label; falls back to the raw tier
  // value (English) for callers that don't pass `strings.tierLabel`. Always
  // escaped below since `impact.tier`/a caller-supplied string both flow
  // into SVG text content.
  const tierLabel = strings.tierLabel ?? impact.tier;
  const ringCY = 460;
  const ringR = 46;
  const ringCircumference = 2 * Math.PI * ringR; // ≈289.03
  const ringOffset = ringCircumference * (1 - impact.adjustedComposite / 100);
  const tierLabelY = ringCY + ringR + 24;
  const tierEffect = renderTierTreatment(config.tierTreatment, {
    tier: impact.tier,
    centerX: radarCX,
    y: tierLabelY,
    color: tierColor,
  });

  // One <defs> block for every effect that needs one. Concatenated in a fixed
  // order so the output stays deterministic.
  const effectDefs = [
    backgroundEffect.defs,
    cardStyleEffect.defs,
    borderEffect.defs,
    scoreEffect.defs,
  ]
    .filter(Boolean)
    .join("\n    ");

  // ── Footer ──────────────────────────────────────────────────
  const footerDividerY = 560;
  const footerY = 585;

  // Platform branding (footer)
  const brandingPlatforms: Platform[] = demoMode
    ? ["github", "bitbucket", "codeberg", "gitlab"]
    : ["github" as Platform, ...(stats.linkedPlatforms?.filter((p): p is Platform => p !== "github") ?? [])];
  const brandingSvg = includeBranding
    ? renderBadgeBranding(PAD, footerY, W - PAD, brandingPlatforms)
    : "";

  // Verification strip (right edge)
  const verificationSvg = demoMode
    ? renderDemoVerificationStrip(strings.sampleDisclosure)
    : verificationHash && verificationDate
      ? renderVerificationStrip(verificationHash, verificationDate, strings.verifiedLabel)
      : "";
  const metricsLabel = demoMode
    ? strings.metricsSimulated ?? "Simulated metrics"
    : hasVerification
      ? strings.metricsVerified ?? "Verified metrics"
      : strings.metricsPublic ?? "Public metrics";

  // ── Accessible name (#1168 UX-L5) ─────────────────────────
  // Gated to the route-served variant (disableAnimation === true — the
  // badge.svg route, og-image rasterization, and warm-cache priming) so it
  // never collides with the share page's own `aria-labelledby` wrapper
  // around the inline-embedded SVG, or with the portal-tooltip convention
  // (BadgeOverlay) used over the demo badges on the landing/archetype pages
  // — both of those are inline (disableAnimation left false/unset).
  const accessibleTitle = `${headerName} — Chapa Impact score ${scoreStr}, ${escapeXml(archetypeText)} archetype`;
  const accessibleDesc = `Chapa developer impact badge for ${headerName}. Composite score ${scoreStr} out of 100, ${escapeXml(impact.tier)} tier, ${escapeXml(archetypeText)} archetype. ${escapeXml(metricsLabel)}.`;
  const a11yAttrs = disableAnimation ? ' role="img"' : "";
  const a11yMarkup = disableAnimation
    ? `\n  <title>${accessibleTitle}</title>\n  <desc>${accessibleDesc}</desc>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"${a11yAttrs}>${a11yMarkup}
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
      .badge-score-pulse {
        animation: pulse-glow 3s ease-in-out infinite;
      }
      /* #1168 UX-M6 — pulse-glow runs infinitely on other people's READMEs
         forever; ring-draw is a one-shot reveal (1.2s, "both" fill) and is
         intentionally left untouched. This rule must come AFTER the base
         .badge-score-pulse rule above so equal-specificity cascade order
         (not !important) is what wins under reduced motion. */
      @media (prefers-reduced-motion: reduce) {
        .badge-score-pulse {
          animation: none;
        }
      }
    </style>${effectDefs ? `
    ${effectDefs}` : ""}
  </defs>

  <!-- Background -->
  ${backgroundEffect.markup}${cardStyleEffect.markup ? `
  ${cardStyleEffect.markup}` : ""}${borderEffect.markup ? `
  ${borderEffect.markup}` : ""}

  <!-- ─── Header row ─────────────────────────────────────── -->
  <!-- Avatar (circular clip) -->
  <defs>
    <clipPath id="avatar-clip">
      <circle cx="${avatarCX}" cy="${avatarCY}" r="${avatarR}"/>
    </clipPath>
  </defs>
  <circle cx="${avatarCX}" cy="${avatarCY}" r="${avatarR}" fill="${accentTint(0.1)}" stroke="${accentTint(0.25)}" stroke-width="2"/>
  ${avatarDataUri ? `<image href="${escapeXml(avatarDataUri)}" x="${avatarCX - avatarR}" y="${avatarCY - avatarR}" width="${avatarR * 2}" height="${avatarR * 2}" clip-path="url(#avatar-clip)"/>` : `<g transform="translate(${avatarCX - 14}, ${avatarCY - 14})">
    <path d="M14 0.875L25.375 5.25L25.375 13.125C25.375 20.125 20.125 25.375 14 27.125C7.875 25.375 2.625 20.125 2.625 13.125L2.625 5.25Z" fill="none" stroke="${t.textSecondary}" stroke-width="1.3" opacity="0.5"/>
    <path d="M8.75 17.5L14 10.5L19.25 17.5" fill="none" stroke="${t.accent}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>
  </g>`}

  <!-- Handle -->
  <text x="${PAD + 72}" y="${headerY - 6}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="26" font-weight="600" fill="${t.textPrimary}">${headerName}</text>
  <!-- Verified icon (shield + checkmark) appears only with a real seal. -->
  ${hasVerification ? `<g transform="translate(${PAD + 72}, ${headerY + 6})" opacity="0.4">
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5L12 1zm-1.5 14.5l-4-4 1.41-1.41L10.5 12.67l5.59-5.59L17.5 8.5l-7 7z" fill="${VERIFICATION_CORAL}" transform="scale(0.7)"/>
  </g>` : ""}
  <text x="${PAD + 72 + (hasVerification ? 20 : 0)}" y="${headerY + 20}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="19" fill="${t.textSecondary}">${metricsLabel}</text>

  <!-- Chapa_ logo (top-right) -->
  <text x="${W - PAD}" y="${headerY + 2}" font-family="'JetBrains Mono', monospace" font-size="22" fill="${t.textSecondary}" opacity="0.7" text-anchor="end" letter-spacing="-0.5">Chapa<tspan fill="${t.accent}">_</tspan></text>

  <!-- ─── Archetype + metric pills row (above heatmap) ────── -->
  <!-- Archetype pill with code-brackets icon -->
  <g transform="translate(${heatmapX}, ${metaRowY - pillH / 2})">
    <rect width="${archetypePillWidth}" height="${pillH}" rx="${pillR}" fill="${accentTint(0.1)}" stroke="${accentTint(0.25)}" stroke-width="1"/>
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
    <rect width="${reposPillW}" height="${pillH}" rx="${pillR}" fill="${accentTint(0.06)}" stroke="${accentTint(0.15)}" stroke-width="1"/>
    <g transform="translate(12, 9)" opacity="0.7">
      <path d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3zm6 0v10M2 8h12" fill="none" stroke="${t.textSecondary}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <text x="${12 + 16 + 6}" y="23" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="14" fill="${t.textSecondary}">${reposLabel}</text>
  </g>
  <!-- · separator -->
  <text x="${heatmapX + archetypePillWidth + pillGap + dotGap * 2 + pillGap + reposPillW + pillGap + dotGap}" y="${metaRowY + 5}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="16" fill="${t.textSecondary}" opacity="0.4">\u00B7</text>
  <!-- Watch pill -->
  <g transform="translate(${heatmapX + archetypePillWidth + pillGap + dotGap * 2 + pillGap + reposPillW + pillGap + dotGap * 2 + pillGap}, ${metaRowY - pillH / 2})">
    <rect width="${watchPillW}" height="${pillH}" rx="${pillR}" fill="${accentTint(0.06)}" stroke="${accentTint(0.15)}" stroke-width="1"/>
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
    <rect width="${forkPillW}" height="${pillH}" rx="${pillR}" fill="${accentTint(0.06)}" stroke="${accentTint(0.15)}" stroke-width="1"/>
    <g transform="translate(12, 9)" opacity="0.7">
      <path d="M6 3a2 2 0 1 0-4 0 2 2 0 0 0 4 0zM6 11a2 2 0 1 0-4 0 2 2 0 0 0 4 0zM14 3a2 2 0 1 0-4 0 2 2 0 0 0 4 0zM4 5v2a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V5" fill="none" stroke="${t.textSecondary}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" transform="scale(0.95)"/>
    </g>
    <text x="${12 + 16 + 6}" y="23" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="14" fill="${t.textSecondary}">${forkLabel}</text>
  </g>
  <!-- · separator -->
  <text x="${heatmapX + archetypePillWidth + pillGap + dotGap * 2 + pillGap + reposPillW + pillGap + dotGap * 2 + pillGap + watchPillW + pillGap + dotGap * 2 + pillGap + forkPillW + pillGap + dotGap}" y="${metaRowY + 5}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="16" fill="${t.textSecondary}" opacity="0.4">\u00B7</text>
  <!-- Star pill -->
  <g transform="translate(${heatmapX + archetypePillWidth + pillGap + dotGap * 2 + pillGap + reposPillW + pillGap + dotGap * 2 + pillGap + watchPillW + pillGap + dotGap * 2 + pillGap + forkPillW + pillGap + dotGap * 2 + pillGap}, ${metaRowY - pillH / 2})">
    <rect width="${starPillW}" height="${pillH}" rx="${pillR}" fill="${accentTint(0.06)}" stroke="${accentTint(0.15)}" stroke-width="1"/>
    <text x="12" y="23" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="14" fill="${t.textSecondary}"><tspan fill="${t.accent}">\u2605</tspan> ${starLabel}</text>
  </g>

  <!-- ─── Two-column body ────────────────────────────────── -->

  <!-- Left: heatmap -->
  ${heatmapSvg}

  <!-- Right: radar chart -->
  ${radarSvg}

  <!-- ─── Hero composite score ring (right column) ────────── -->
  <!-- Ring track (background) -->
  <circle cx="${radarCX}" cy="${ringCY}" r="${ringR}" fill="none" stroke="${accentTint(0.1)}" stroke-width="4"/>
  <!-- Ring arc (foreground, tier-colored, animates from 0 to score) -->
  <circle cx="${radarCX}" cy="${ringCY}" r="${ringR}" fill="none" stroke="${tierColor}" stroke-width="4" stroke-dasharray="${ringCircumference.toFixed(2)}" stroke-dashoffset="${ringOffset.toFixed(2)}" stroke-linecap="round" transform="rotate(-90 ${radarCX} ${ringCY})" style="animation: ring-draw 1.2s ease-out 0.5s both"/>
  <!-- Score number (centered inside ring) -->
  <text class="badge-score-pulse" x="${radarCX}" y="${ringCY}" font-family="'JetBrains Mono', monospace" font-size="52" font-weight="700" fill="${scoreEffect.fill}"${scoreEffect.attrs} text-anchor="middle" dominant-baseline="central">${scoreStr}</text>
  <!-- Tier label (always visible below ring) -->
  <text x="${radarCX}" y="${tierLabelY}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="17" fill="${tierColor}" text-anchor="middle">${escapeXml(tierLabel)}</text>${tierEffect.markup ? `
  ${tierEffect.markup}` : ""}

  <!-- ─── Footer ─────────────────────────────────────────── -->
  <!-- Divider line -->
  <line x1="${PAD}" y1="${footerDividerY}" x2="${W - PAD}" y2="${footerDividerY}" stroke="${t.stroke}" stroke-width="1"/>

  <!-- Branding: left = GitHub, right = domain -->
  ${brandingSvg}

  <!-- Verification seal (right edge) -->
  ${verificationSvg}
</svg>`;
}
