"use client";

import type { BadgeConfig, Stats90d, ImpactV3Result } from "@chapa/shared";
import { BadgePreviewCard } from "@/app/studio/BadgePreviewCard";

export interface ShareBadgePreviewProps {
  config: BadgeConfig;
  stats: Stats90d;
  impact: ImpactV3Result;
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
