"use client";

import dynamic from "next/dynamic";
import type { GlobalCommandBarProps } from "./GlobalCommandBar";

const GlobalCommandBar = dynamic(
  () => import("@/components/GlobalCommandBar").then(m => ({ default: m.GlobalCommandBar })),
  { ssr: false },
);

export function GlobalCommandBarLazy(props: GlobalCommandBarProps = {}) {
  return <GlobalCommandBar {...props} />;
}
