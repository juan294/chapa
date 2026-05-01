"use client";

import dynamic from "next/dynamic";
import type { ImpactV6Result, StatsData } from "@chapa/shared";
import { BadgeSkeleton } from "./BadgeSkeleton";

const SharePageOwnerContent = dynamic(
  () => import("./SharePageOwnerContent").then((m) => ({ default: m.SharePageOwnerContent })),
  { ssr: false, loading: () => <BadgeSkeleton /> },
);

interface Props {
  handle: string;
  stats: StatsData | null;
  impact: ImpactV6Result | null;
}

export function SharePageOwnerContentLazy(props: Props) {
  return <SharePageOwnerContent {...props} />;
}
