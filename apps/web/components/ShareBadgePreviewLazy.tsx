"use client";

import dynamic from "next/dynamic";
import type { BadgeConfig, StatsData, ImpactV4Result } from "@chapa/shared";

const ShareBadgePreview = dynamic(
  () => import("@/components/ShareBadgePreview").then(m => ({ default: m.ShareBadgePreview })),
  { ssr: false, loading: () => <div className="rounded-2xl border border-stroke bg-card p-4 shadow-lg shadow-amber/5 animate-pulse h-[400px]" /> }
);

export function ShareBadgePreviewLazy(props: {
  config: BadgeConfig;
  stats: StatsData;
  impact: ImpactV4Result;
}) {
  return <ShareBadgePreview {...props} />;
}
