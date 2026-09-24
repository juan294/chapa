"use client";

import type { ImpactTier } from "@chapa/shared";

export function tierPillClasses(tier: ImpactTier): string {
  switch (tier) {
    case "Emerging":
      return "bg-text-secondary/[0.08] border-text-secondary/20 text-text-secondary";
    case "Solid":
      return "bg-text-primary/[0.06] border-text-primary/15 text-text-primary";
    case "High":
      return "bg-amber/10 border-amber/25 text-amber";
    case "Elite":
      return "tier-elite-pill border-amber/30 text-white font-bold";
  }
}

export function SparkleDots() {
  return (
    <>
      <div
        className="sparkle-dot absolute w-1 h-1 rounded-full bg-amber-light"
        style={{ top: "12%", right: "8%", animationDelay: "0s" }}
        aria-hidden="true"
      />
      <div
        className="sparkle-dot absolute w-[3px] h-[3px] rounded-full bg-amber"
        style={{ bottom: "18%", left: "6%", animationDelay: "0.7s" }}
        aria-hidden="true"
      />
      <div
        className="sparkle-dot absolute w-1 h-1 rounded-full bg-amber-light"
        style={{ top: "45%", right: "3%", animationDelay: "1.4s" }}
        aria-hidden="true"
      />
    </>
  );
}
