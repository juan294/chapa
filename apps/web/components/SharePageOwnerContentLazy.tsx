"use client";

import dynamic from "next/dynamic";
import type { ClientImpactV6Result, CraftResult, StatsData } from "@chapa/shared";
import type { TrendSummary } from "@/lib/history/trend";
import type { ClientSnapshotDiff } from "@/lib/history/diff";
import { BadgeSkeleton } from "./BadgeSkeleton";

const SharePageOwnerContent = dynamic(
  () => import("./SharePageOwnerContent").then((m) => ({ default: m.SharePageOwnerContent })),
  { loading: () => <BadgeSkeleton /> },
);

interface Props {
  handle: string;
  stats: StatsData | null;
  // #1067 — the server passes a redacted PublicImpactV6Result (no
  // confidence/confidencePenalties keys) for non-owner visitors, and the
  // full ImpactV6Result for the owner.
  impact: ClientImpactV6Result | null;
  craftResult?: CraftResult | null;
  trend?: TrendSummary | null;
  diff?: ClientSnapshotDiff | null;
}

export function SharePageOwnerContentLazy(props: Props) {
  return <SharePageOwnerContent {...props} />;
}
