"use client";

import dynamic from "next/dynamic";

const GlobalCommandBar = dynamic(
  () => import("@/components/GlobalCommandBar").then(m => ({ default: m.GlobalCommandBar })),
  { ssr: false },
);

export function GlobalCommandBarLazy({
  isAdmin,
  skipShortcutsListener,
}: {
  isAdmin?: boolean;
  skipShortcutsListener?: boolean;
} = {}) {
  return (
    <GlobalCommandBar isAdmin={isAdmin} skipShortcutsListener={skipShortcutsListener} />
  );
}
