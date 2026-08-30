"use client";

import { memo, useMemo } from "react";
import type { BadgeConfig, StatsData, ImpactV6Result } from "@chapa/shared";
import type { PublicVerificationCode } from "@/lib/profile/public-profile";
import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { buildBadgeI18nStrings } from "@/lib/render/badge-i18n-strings";
import { useTranslation } from "@/lib/i18n";

export type PreviewVerification = PublicVerificationCode;

export interface BadgePreviewCardProps {
  config: BadgeConfig;
  stats: StatsData;
  impact: ImpactV6Result;
  verification?: PreviewVerification | null;
  /**
   * Resolved server-side by `app/studio/page.tsx`, exactly as the badge route
   * resolves it. Omitted renders the Chapa shield placeholder, which is what
   * the real badge does for a handle with no avatar.
   */
  avatarDataUri?: string;
  demoMode?: boolean;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Creator Studio's preview: the real badge, not a lookalike (#1191 step 6).
 *
 * This used to compose `BadgeContent` — a parallel React DOM implementation of
 * the badge interior — inside DOM layers that applied `background`, `cardStyle`
 * and `border` themselves. Every visual element therefore existed twice and was
 * maintained twice, and a customization could look one way here and another in
 * the README. It now injects the string `renderBadgeSvg` produces, which is the
 * same function and the same inputs the badge route uses, so the preview and
 * the artifact cannot disagree.
 *
 * The DOM effect layers are gone rather than kept: the SVG applies all six
 * crossing categories itself, so a surviving wrapper would double them.
 *
 * `dangerouslySetInnerHTML` is safe here for the same reason it is at the three
 * existing call sites (the landing page, the archetype guides, the share
 * page's inline render): `renderBadgeSvg` escapes every user-controlled string
 * itself via `escapeXml`, because React's auto-escaping does not apply to
 * injected markup and cannot substitute for it. See
 * `docs/decisions/2026-08-30-one-badge-artifact.md`, invariant 2.
 */
function BadgePreviewCardInner({
  config,
  stats,
  impact,
  verification = null,
  avatarDataUri,
  demoMode = false,
}: BadgePreviewCardProps) {
  const { t } = useTranslation();

  const svg = useMemo(
    () =>
      renderBadgeSvg(stats, impact, {
        config,
        avatarDataUri,
        verificationHash: verification?.hash,
        verificationDate: verification?.date,
        demoMode,
        strings: buildBadgeI18nStrings(t, impact.tier),
      }),
    [config, stats, impact, verification, avatarDataUri, demoMode, t],
  );

  return (
    <div
      data-testid="badge-preview"
      // The badge is a fixed 1200x630 document with a viewBox, so overriding
      // the root element's own width/height is what makes it scale to the
      // Studio column instead of overflowing it.
      className="relative w-full [&>svg]:block [&>svg]:h-auto [&>svg]:w-full [&>svg]:rounded-2xl"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export const BadgePreviewCard = memo(BadgePreviewCardInner);
