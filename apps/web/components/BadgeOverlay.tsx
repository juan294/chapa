"use client";

import { InfoTooltip } from "./InfoTooltip";

/**
 * Hotspot definitions positioned as percentages of the 1200×630 badge viewBox.
 * Each hotspot is an invisible region that reveals a tooltip on hover/focus.
 */
const HOTSPOTS: {
  id: string;
  tooltip: string;
  position: "top" | "bottom";
  // Percentage-based positioning within the badge
  top: string;
  left: string;
  width: string;
  height: string;
}[] = [
  {
    id: "badge-archetype",
    tooltip:
      "Your developer archetype based on which dimension is strongest. Six types: Builder, Guardian, Marathoner, Polymath, Balanced, Emerging.",
    position: "bottom",
    top: "13%",
    left: "2%",
    width: "14%",
    height: "7%",
  },
  {
    id: "badge-watchers",
    tooltip: "People watching your repositories for updates.",
    position: "bottom",
    top: "13%",
    left: "17%",
    width: "10%",
    height: "7%",
  },
  {
    id: "badge-forks",
    tooltip: "Times others forked your repositories.",
    position: "bottom",
    top: "13%",
    left: "28%",
    width: "10%",
    height: "7%",
  },
  {
    id: "badge-stars",
    tooltip:
      "Stars received on your repos \u2014 not repos you\u2019ve starred.",
    position: "bottom",
    top: "13%",
    left: "39%",
    width: "10%",
    height: "7%",
  },
  {
    id: "badge-heatmap",
    tooltip:
      "Contribution activity over the last 90 days. Darker cells = more contributions that day.",
    position: "top",
    top: "30%",
    left: "2%",
    width: "48%",
    height: "50%",
  },
  {
    id: "badge-radar",
    tooltip:
      "Your four-dimension profile as a diamond. Each axis is one dimension. Larger shape = stronger scores.",
    position: "top",
    top: "25%",
    left: "52%",
    width: "30%",
    height: "40%",
  },
  {
    id: "badge-score",
    tooltip:
      "Your adjusted composite impact score (0\u2013100), averaged from four dimensions and adjusted by confidence.",
    position: "top",
    top: "68%",
    left: "55%",
    width: "22%",
    height: "18%",
  },
  {
    id: "badge-tier",
    tooltip:
      "Impact tier: Emerging (0\u201339), Solid (40\u201369), High (70\u201384), Elite (85\u2013100).",
    position: "top",
    top: "86%",
    left: "55%",
    width: "22%",
    height: "10%",
  },
  {
    id: "badge-verification",
    tooltip:
      "Cryptographic seal proving these scores haven\u2019t been tampered with.",
    position: "top",
    top: "25%",
    left: "84%",
    width: "14%",
    height: "65%",
  },
];

export function BadgeOverlay() {
  return (
    <div
      className="absolute inset-0 z-10"
      role="group"
      aria-label="Badge element tooltips"
    >
      {HOTSPOTS.map((hotspot) => (
        <div
          key={hotspot.id}
          className="absolute flex items-center justify-center cursor-help rounded hover:bg-amber/5 transition-colors duration-150"
          style={{
            top: hotspot.top,
            left: hotspot.left,
            width: hotspot.width,
            height: hotspot.height,
          }}
        >
          <InfoTooltip
            id={hotspot.id}
            content={hotspot.tooltip}
            position={hotspot.position}
          />
        </div>
      ))}
    </div>
  );
}
