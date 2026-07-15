"use client";

import dynamic from "next/dynamic";
import type { CraftResult, ImpactV6Result, StatsData } from "@chapa/shared";
import type { TrendSummary } from "@/lib/history/trend";
import type { SnapshotDiff } from "@/lib/history/diff";
import { BadgeSkeleton } from "./BadgeSkeleton";

const SharePageOwnerContent = dynamic(
  () => import("./SharePageOwnerContent").then((m) => ({ default: m.SharePageOwnerContent })),
  { loading: () => <BadgeSkeleton /> },
);

interface Props {
  handle: string;
  stats: StatsData | null;
  impact: ImpactV6Result | null;
  craftResult?: CraftResult | null;
  trend?: TrendSummary | null;
  diff?: SnapshotDiff | null;
}

export function SharePageOwnerContentLazy(props: Props) {
  return <SharePageOwnerContent {...props} />;
}
