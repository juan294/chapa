import type { BadgeConfig } from "@chapa/shared";
import { DEFAULT_BADGE_CONFIG } from "@chapa/shared";
import { badgeTheme } from "./theme";
import { escapeXml } from "./escape";
import type { ScoringStatus, ScoringStatusKind } from "@/lib/collection/scoring-status";
import type { ScoringRenderSelection } from "@/lib/scoring-render-selection";

/**
 * Badge/OG placeholder states (#1335 phase 4). A `ready` `ScoringStatus`
 * renders through the normal `renderBadgeSvg` pipeline unchanged (it either
 * has a receipt to draw, or — for `collecting`/`action_needed` with a prior
 * receipt — falls back to that receipt with the existing "stale" label, per
 * the phase-4 plan's Surfaces section). These three states are what render
 * instead when there is no receipt at all to draw:
 *
 * - `collecting` — evidence is still being gathered; no score exists yet.
 * - `action_needed` — collection stalled on something only the owner can fix
 *   (a lost connection, an exhausted retry budget).
 * - `unregistered` — the handle has never signed up.
 * - `unavailable` — the `readScoringStatus` authority read itself failed (a
 *   genuine DB error, never "no receipt found"). Under the plan's invariant
 *   ("failed authority reads are unavailable"), this must never fall through
 *   to a legacy v6 render: drawn ONLY when the normal materialize pipeline's
 *   own independent receipt lookup also failed to find a real v7.2 receipt
 *   (a handle WITH a drawable receipt still renders it normally — see each
 *   route's post-materialize check). Not derived from a `ScoringStatus` at
 *   all, since the whole point is that no `ScoringStatus` could be read.
 *
 * These states intentionally reuse `ScoringStatusKind`'s own string values
 * (plus `unavailable`) as the `data-chapa-state` attribute, so the release
 * probe and monitoring never need a second vocabulary for the same fact.
 */
export type BadgeStatusState = Exclude<ScoringStatusKind, "ready"> | "unavailable";

/** A `ScoringStatus` known not to be `ready` — what every placeholder-drawing
 * helper below actually consumes, since a `ready` status never reaches them
 * (`badgeStatusState` filters it out first). */
export type NonReadyScoringStatus = Exclude<ScoringStatus, { readonly kind: "ready" }>;

/**
 * Maps a resolved `ScoringStatus` to the state a badge/OG render must show in
 * place of a normal score, or `null` when the normal render pipeline already
 * has something honest to draw (a ready receipt, or a collecting/paused
 * status with a prior receipt to fall back on).
 */
export function badgeStatusState(status: ScoringStatus | null): BadgeStatusState | null {
  if (!status) return null;
  switch (status.kind) {
    case "unregistered":
      return "unregistered";
    case "collecting":
      return status.hasPriorReceipt ? null : "collecting";
    case "action_needed":
      return status.hasPriorReceipt ? null : "action_needed";
    case "ready":
      return null;
  }
}

/**
 * True when a v7.2-selected render must show the "unavailable" placeholder
 * rather than whatever the normal materialize pipeline's own independent
 * receipt lookup produced (#1335 phase 4). `scoringStatus === null` means
 * the `readScoringStatus` authority read itself failed — never "no receipt
 * found", which is its own real `ScoringStatus` already handled earlier by
 * `badgeStatusState`. A handle WITH a drawable receipt (found independently
 * by the normal pipeline) still renders it normally: that is what the
 * `policyVersion !== "v7.2"` half of this check protects. Shared by
 * badge.svg, og-image and the share page, whose post-materialize check was
 * previously three independently-drifting copies of the same condition.
 */
export function needsUnavailablePlaceholder(
  scoringSelection: Pick<ScoringRenderSelection, "machinePolicy">,
  scoringStatus: ScoringStatus | null,
  policyVersion: string | undefined,
): boolean {
  return scoringSelection.machinePolicy === "v7.2" && scoringStatus === null && policyVersion !== "v7.2";
}

/**
 * Locale-resolved copy for the status placeholder. Every field is optional
 * and defaults to English, mirroring `BadgeI18nStrings` (`BadgeSvg.tsx`).
 * `collectingHeading` is the FULLY interpolated sentence (the caller resolves
 * `{percent}` via `lib/i18n/interpolate` before passing it in, the same
 * convention `storedBadgeActivityUnavailable` uses) — this module stays a
 * pure, synchronous renderer with no i18n dependency of its own.
 */
export interface BadgeStatusStrings {
  collectingHeading?: string;
  actionNeededHeading?: string;
  unregisteredHeading?: string;
  unregisteredDomain?: string;
  unavailableHeading?: string;
  tagline?: string;
}

export interface BadgeStatusOptions {
  readonly handle: string;
  readonly displayName?: string | null;
  /** 0-99, required only for `collecting` (used to build the English default heading). */
  readonly percent?: number;
  readonly config?: BadgeConfig;
  readonly disableAnimation?: boolean;
  readonly strings?: BadgeStatusStrings;
}

const W = 1200;
const H = 630;
const PAD = 60;

function wordmark(t: ReturnType<typeof badgeTheme>): string {
  return `<text x="${W - PAD}" y="82" font-family="'JetBrains Mono', monospace" font-size="22" fill="${t.textSecondary}" opacity="0.7" text-anchor="end" letter-spacing="-0.5">Chapa<tspan fill="${t.accent}">_</tspan></text>`;
}

function identityHeader(handle: string, displayName: string | null | undefined, t: ReturnType<typeof badgeTheme>): string {
  const safeHandle = escapeXml(handle);
  const headerName = displayName ? escapeXml(displayName) : `@${safeHandle}`;
  const avatarCX = PAD + 30;
  const avatarCY = 80;
  const avatarR = 30;
  return `
  <circle cx="${avatarCX}" cy="${avatarCY}" r="${avatarR}" fill="${t.tint(0.1)}" stroke="${t.tint(0.25)}" stroke-width="2"/>
  <g transform="translate(${avatarCX - 14}, ${avatarCY - 14})">
    <path d="M14 0.875L25.375 5.25L25.375 13.125C25.375 20.125 20.125 25.375 14 27.125C7.875 25.375 2.625 20.125 2.625 13.125L2.625 5.25Z" fill="none" stroke="${t.textSecondary}" stroke-width="1.3" opacity="0.5"/>
    <path d="M8.75 17.5L14 10.5L19.25 17.5" fill="none" stroke="${t.accent}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>
  </g>
  <text data-element="name" x="${PAD + 72}" y="74" font-family="'JetBrains Mono', monospace" font-size="32" font-weight="700" fill="${t.textPrimary}">${headerName}</text>`;
}

/** A determinate progress bar for the `collecting` state — the only one of
 * the three placeholder states with a meaningful percent to draw. */
function progressBar(percent: number, t: ReturnType<typeof badgeTheme>): string {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const barW = 480;
  const barX = PAD;
  const barY = 330;
  const barH = 10;
  return `
  <rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="5" fill="${t.tint(0.12)}"/>
  <rect x="${barX}" y="${barY}" width="${(barW * clamped) / 100}" height="${barH}" rx="5" fill="${t.accent}"/>`;
}

/**
 * Renders the placeholder shown in place of a scored badge when there is no
 * receipt to draw: still evidence-collecting, paused on an owner action, or
 * the handle never signed up. Deliberately a separate, small renderer rather
 * than a `renderBadgeSvg` branch — like the badge route's existing
 * `fallbackSvg`, this draws no score, heatmap or radar, so it does not touch
 * the one scored-badge implementation `docs/decisions/2026-08-30-one-badge-artifact.md`
 * protects.
 */
export function renderBadgeStatusSvg(state: BadgeStatusState, options: BadgeStatusOptions): string {
  const { handle, displayName = null, percent = 0, config = DEFAULT_BADGE_CONFIG, disableAnimation = false, strings = {} } = options;
  const t = badgeTheme(config.colorPalette);
  const safeHandle = escapeXml(handle);
  const clampedPercent = Math.max(0, Math.min(99, Math.round(percent)));

  const headingY = 380;
  const bodyY = 412;
  let heading: string;
  let body = "";
  switch (state) {
    case "collecting":
      heading = strings.collectingHeading ?? `Scoring in progress, ${clampedPercent}%`;
      break;
    case "action_needed":
      heading = strings.actionNeededHeading ?? "Scoring paused: action needed";
      break;
    case "unregistered":
      heading = strings.unregisteredHeading ?? "Not on Chapa yet";
      body = strings.unregisteredDomain ?? "chapa.thecreativetoken.com";
      break;
    case "unavailable":
      heading = strings.unavailableHeading ?? "Scoring status unavailable";
      break;
  }

  const accessibleTitle = `${displayName ? escapeXml(displayName) : `@${safeHandle}`} — Chapa ${escapeXml(heading)}`;
  const a11yAttrs = disableAnimation ? ' role="img"' : "";
  const a11yMarkup = disableAnimation ? `\n  <title>${accessibleTitle}</title>` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" data-chapa-state="${state}"${a11yAttrs}>${a11yMarkup}
  <rect width="${W}" height="${H}" rx="4" fill="${t.bg}" stroke="${t.tint(0.12)}" stroke-width="2"/>
  <line x1="60" y1="134" x2="1120" y2="134" stroke="${t.stroke}"/>
  ${wordmark(t)}
  ${identityHeader(handle, displayName, t)}
  <text x="${PAD}" y="${headingY}" font-family="'JetBrains Mono', monospace" font-size="28" font-weight="700" fill="${t.textPrimary}">${escapeXml(heading)}</text>
  ${state === "collecting" ? progressBar(clampedPercent, t) : ""}
  ${body ? `<text x="${PAD}" y="${bodyY}" font-family="'JetBrains Mono', monospace" font-size="18" fill="${t.accent}">${escapeXml(body)}</text>` : ""}
</svg>`;
}

/**
 * Builds the interpolated `BadgeStatusStrings` for one `ScoringStatus`, given
 * a plain `(key) => string` translator (`getServerT(locale)` cast to that
 * shape). Shared by the badge, OG image and share page routes so the same
 * dictionary keys back every surface.
 */
export function buildBadgeStatusStrings(t: (key: string) => string, status: NonReadyScoringStatus, interpolate: (template: string, values: Record<string, string>) => string): BadgeStatusStrings {
  switch (status.kind) {
    case "collecting":
      return { collectingHeading: interpolate(t("scoring.status.badgeCollecting"), { percent: String(Math.max(0, Math.min(99, Math.round(status.percent)))) }) };
    case "action_needed":
      return { actionNeededHeading: t("scoring.status.badgeActionNeeded") };
    case "unregistered":
      return {
        unregisteredHeading: t("scoring.status.badgeUnregistered"),
        unregisteredDomain: t("scoring.status.badgeUnregisteredDomain"),
      };
  }
}

/**
 * Locale-resolved strings for the `unavailable` state — no interpolation
 * needed (no percent, no receipt-derived data), so this takes no
 * `ScoringStatus` at all: there is no status to read from when the read
 * itself is what failed.
 */
export function buildBadgeUnavailableStrings(t: (key: string) => string): BadgeStatusStrings {
  return { unavailableHeading: t("scoring.status.badgeUnavailable") };
}
