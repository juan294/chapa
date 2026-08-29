"use client";

import type { ImpactTier } from "@chapa/shared";

export function tierPillClasses(tier: ImpactTier): string {
  switch (tier) {
    case "Emerging":
      return "bg-[rgba(107,114,128,0.08)] border-[rgba(107,114,128,0.20)] text-text-secondary";
    case "Solid":
      return "bg-[rgba(26,26,46,0.06)] border-[rgba(26,26,46,0.15)] text-text-primary";
    case "High":
      return "bg-amber/10 border-amber/25 text-amber";
    case "Elite":
      return "tier-elite-pill border-amber/30 text-white font-bold";
  }
}

/** CSS for tier-specific visual treatments. Inject once in the page. */
export const TIER_VISUALS_CSS = `
.tier-score-emerging { color: #6B7280; }
.tier-score-solid { color: #0D2B1D; text-shadow: none; }
.tier-score-high {
  background: linear-gradient(135deg, #009365, #1BD093, #65E7B0, #1BD093, #009365);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
}
.tier-score-elite {
  background: linear-gradient(90deg, #009365, #1BD093, #A99BFF, #D0C9FF, #A99BFF, #1BD093, #009365);
  background-size: 200% 100%;
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  animation: tier-shimmer 3s ease-in-out infinite;
}
@keyframes tier-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

.tier-card-emerging { border: 1px solid rgba(0,0,0,0.08); }
.tier-card-solid { border: 1px solid rgba(0,0,0,0.10); }
.tier-card-high { border: 1px solid rgba(27, 208, 147, 0.25); box-shadow: 0 0 20px rgba(27, 208, 147, 0.08), 0 0 40px rgba(27, 208, 147, 0.03); }
.tier-card-elite { box-shadow: 0 0 40px rgba(27, 208, 147, 0.12), 0 0 80px rgba(27, 208, 147, 0.04); }

@property --elite-angle { syntax: "<angle>"; initial-value: 0deg; inherits: false; }
.elite-border-glow {
  background: conic-gradient(from var(--elite-angle), #009365, #1BD093, #65E7B0, #1BD093, #009365, #1BD093, #65E7B0, #1BD093, #009365);
  animation: elite-border-rotate 4s linear infinite;
  filter: blur(3px); opacity: 0.7;
}
@keyframes elite-border-rotate { 0% { --elite-angle: 0deg; } 100% { --elite-angle: 360deg; } }

@supports not (background: conic-gradient(from var(--elite-angle), red, blue)) {
  .elite-border-glow {
    background: linear-gradient(90deg, #009365, #1BD093, #65E7B0, #1BD093, #009365);
    background-size: 300% 300%;
    animation: elite-border-fallback 3s ease infinite;
    filter: blur(3px); opacity: 0.7;
  }
  @keyframes elite-border-fallback { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
}

.tier-elite-pill { background: linear-gradient(135deg, #009365, #1BD093, #65E7B0); }

.sparkle-dot { animation: sparkle-pulse 2s ease-in-out infinite; }
@keyframes sparkle-pulse { 0%, 100% { opacity: 0; transform: scale(0.5); } 50% { opacity: 0.8; transform: scale(1.2); } }

@media (prefers-reduced-motion: reduce) {
  .tier-score-elite { animation: none !important; background-position: 0% 0%; }
  .elite-border-glow { animation: none !important; background: conic-gradient(from 45deg, #009365, #1BD093, #65E7B0, #1BD093, #009365); }
  .sparkle-dot { animation: none !important; opacity: 0.5; transform: scale(1); }
}
`;

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
