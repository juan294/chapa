"use client";

import dynamic from "next/dynamic";

const GlobalCommandBar = dynamic(
  () => import("@/components/GlobalCommandBar").then(m => ({ default: m.GlobalCommandBar })),
  { ssr: false },
);

export function GlobalCommandBarLazy() {
  return <GlobalCommandBar />;
}
