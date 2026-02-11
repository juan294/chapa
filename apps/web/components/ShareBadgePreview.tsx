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
    <div className="rounded-2xl border border-warm-stroke bg-warm-card/50 p-4 animate-pulse-glow-amber">
      <BadgePreviewCard
        config={config}
        stats={stats}
        impact={impact}
        interactive
      />
    </div>
  );
}
