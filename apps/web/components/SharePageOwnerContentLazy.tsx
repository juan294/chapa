"use client";

import dynamic from "next/dynamic";
import type { CraftResult, ImpactV6Result, StatsData } from "@chapa/shared";
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
}

export function SharePageOwnerContentLazy(props: Props) {
  return <SharePageOwnerContent {...props} />;
}
