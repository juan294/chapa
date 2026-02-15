"use client";

import { InfoTooltip } from "./InfoTooltip";

/**
 * Hotspot definitions positioned as percentages of the 1200×630 badge viewBox.
 * Each hotspot is an invisible region that reveals a tooltip on hover/focus.
 */
/**
 * Coordinates derived from the badge SVG viewBox (1200×630).
 * Convert: left = pixelX/1200, top = pixelY/630, etc.
 *
 * Key SVG anchors:
 *   PAD=60  metaRowY=160  heatmap=(60,190)  radarCenter=(870,275)
 *   scoreCenter=(870,460) r=46  tierY≈530  footerY=585  verifyX=1145
 */
const HOTSPOTS: {
  id: string;
  tooltip: string;
  position: "top" | "bottom";
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
    // Pill at x=60, y=143, ~170×34
    top: "22.5%",
    left: "5%",
    width: "14%",
    height: "5.5%",
  },
  {
    id: "badge-watchers",
    tooltip: "People watching your repositories for updates.",
    position: "bottom",
    // Pill after archetype + dot separator
    top: "22.5%",
    left: "21%",
    width: "10%",
    height: "5.5%",
  },
  {
    id: "badge-forks",
    tooltip: "Times others forked your repositories.",
    position: "bottom",
    top: "22.5%",
    left: "33%",
    width: "9%",
    height: "5.5%",
  },
  {
    id: "badge-stars",
    tooltip:
      "Stars received on your repos \u2014 not repos you\u2019ve starred.",
    position: "bottom",
    top: "22.5%",
    left: "44%",
    width: "11%",
    height: "5.5%",
  },
  {
    id: "badge-heatmap",
    tooltip:
      "Contribution activity over the last 90 days. Darker cells = more contributions that day.",
    position: "top",
    // Grid at x=60, y=190, 622×328
    top: "30%",
    left: "5%",
    width: "52%",
    height: "52%",
  },
  {
    id: "badge-radar",
    tooltip:
      "Your four-dimension profile as a diamond. Each axis is one dimension. Larger shape = stronger scores.",
    position: "top",
    // Center (870,275) r=85, including axis labels
    top: "28%",
    left: "63%",
    width: "18%",
    height: "32%",
  },
  {
    id: "badge-score",
    tooltip:
      "Your adjusted composite impact score (0\u2013100), averaged from four dimensions and adjusted by confidence.",
    position: "top",
    // Ring center (870,460) r=46 → box (824,414)-(916,506)
    top: "65%",
    left: "68%",
    width: "8%",
    height: "15%",
  },
  {
    id: "badge-tier",
    tooltip:
      "Impact tier: Emerging (0\u201339), Solid (40\u201369), High (70\u201384), Elite (85\u2013100).",
    position: "top",
    // Label at (870, ~530), ~60px wide
    top: "80%",
    left: "67%",
    width: "10%",
    height: "7%",
  },
  {
    id: "badge-verification",
    tooltip:
      "Cryptographic seal proving these scores haven\u2019t been tampered with.",
    position: "top",
    // Strip at x=1145-1190, y=30-600
    top: "5%",
    left: "95%",
    width: "4%",
    height: "90%",
  },
  {
    id: "badge-github",
    tooltip:
      "Chapa uses public GitHub metrics. GitHub is not affiliated with or endorsing this project.",
    position: "top",
    // Footer: GitHub logo+text at x=60, y≈575
    top: "90%",
    left: "4%",
    width: "18%",
    height: "7%",
  },
];

export function BadgeOverlay() {
  return (
    <div
      className="absolute inset-0 z-10 group/badge"
      role="group"
      aria-label="Badge element tooltips"
    >
      {HOTSPOTS.map((hotspot) => (
        <div
          key={hotspot.id}
          className="absolute flex items-center justify-center group-hover/badge:cursor-help rounded hover:bg-amber/5 transition-colors duration-150"
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
            className="opacity-0 group-hover/badge:opacity-100 transition-opacity duration-300"
          />
        </div>
      ))}
    </div>
  );
}
