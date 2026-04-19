"use client";

import dynamic from "next/dynamic";
import type { BadgeConfig, StatsData, ImpactV6Result } from "@chapa/shared";

const ShareBadgePreview = dynamic(
  () => import("@/components/ShareBadgePreview").then(m => ({ default: m.ShareBadgePreview })),
  { ssr: false, loading: () => <div className="w-full aspect-[1200/630] rounded-2xl border border-stroke bg-card shadow-lg shadow-amber/5 animate-pulse" /> }
);

export function ShareBadgePreviewLazy(props: {
  config: BadgeConfig;
  stats: StatsData;
  impact: ImpactV6Result;
}) {
  return <ShareBadgePreview {...props} />;
}
