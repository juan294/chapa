"use client";

import { useMemo } from "react";
import type { StatsData } from "@chapa/shared";
import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { buildBadgeI18nStrings } from "@/lib/render/badge-i18n-strings";
import { useTranslation } from "@/lib/i18n";
import type { ScoreViewModel } from "@/lib/profile/score-view-model";
import { InlineBadgeSvg } from "./InlineBadgeSvg";

export interface BadgeContentProps {
  stats: StatsData;
  /** #1335 — v7.2 is the one scoring policy this wrapper draws. */
  scoring: ScoreViewModel;
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
  scoring,
  className = "",
  style,
}: BadgeContentProps) {
  const { t } = useTranslation();

  const svg = useMemo(
    () =>
      renderBadgeSvg(stats, {
        scoring,
        strings: buildBadgeI18nStrings(t, scoring.tier),
      }),
    [stats, scoring, t],
  );

  return (
    <InlineBadgeSvg
      data-testid="badge-content"
      className={`[&>svg]:block [&>svg]:h-auto [&>svg]:w-full ${className}`}
      style={style}
      svg={svg}
    />
  );
}
