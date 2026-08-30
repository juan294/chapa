"use client";

import { useMemo } from "react";
import type { StatsData, ImpactV6Result } from "@chapa/shared";
import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { buildBadgeI18nStrings } from "@/lib/render/badge-i18n-strings";
import { useTranslation } from "@/lib/i18n";

export interface BadgeContentProps {
  stats: StatsData;
  impact: ImpactV6Result;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The badge, rendered in a client component (#1191 step 6).
 *
 * This was a 405-line React DOM reimplementation of the badge interior — its
 * own heatmap, radar chart, tier treatment, stat cards and footer, every one
 * maintained in parallel with `renderBadgeSvg`'s. That duplication is the
 * defect issue #1191 was filed for: the two could drift, and did.
 *
 * It is now a wrapper over the one renderer. Creator Studio does not use it at
 * all any more (it renders `renderBadgeSvg` directly through
 * `BadgePreviewCard`); the remaining callers are the flag-gated
 * `/experiments/*` prototypes, which all render it as
 * `<BadgeContent stats impact />`.
 *
 * `dangerouslySetInnerHTML` is safe here for the reason it is at every other
 * badge call site: `renderBadgeSvg` escapes user-controlled text itself with
 * `escapeXml`, because React's auto-escaping does not reach injected markup.
 * See `docs/decisions/2026-08-30-one-badge-artifact.md`, invariant 2.
 */
export function BadgeContent({
  stats,
  impact,
  className = "",
  style,
}: BadgeContentProps) {
  const { t } = useTranslation();

  const svg = useMemo(
    () =>
      renderBadgeSvg(stats, impact, {
        strings: buildBadgeI18nStrings(t, impact.tier),
      }),
    [stats, impact, t],
  );

  return (
    <div
      data-testid="badge-content"
      className={`[&>svg]:block [&>svg]:h-auto [&>svg]:w-full ${className}`}
      style={style}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
