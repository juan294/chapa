"use client";

import type { BadgeConfig, StatsData, ImpactV4Result } from "@chapa/shared";
import { BadgePreviewCard } from "@/app/studio/BadgePreviewCard";

export interface ShareBadgePreviewProps {
  config: BadgeConfig;
  stats: StatsData;
  impact: ImpactV4Result;
}

export function ShareBadgePreview({
  config,
  stats,
  impact,
}: ShareBadgePreviewProps) {
  return (
    <div className="rounded-2xl border border-stroke bg-card p-4 shadow-lg shadow-amber/5">
      <BadgePreviewCard
        config={config}
        stats={stats}
        impact={impact}
        interactive
      />
    </div>
  );
}
