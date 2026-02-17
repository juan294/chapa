"use client";

import { useState } from "react";
import { InfoTooltip } from "./InfoTooltip";

/**
 * Leader line configuration for hotspots that show an animated path
 * connecting the element to a floating annotation panel.
 */
interface LeaderLineConfig {
  /** SVG path `d` attribute in the 1200×630 viewBox coordinate system */
  path: string;
  /** Panel CSS top position (percentage of overlay container) */
  panelTop: string;
  /** Panel CSS left position (percentage of overlay container) */
  panelLeft: string;
  /** Where the panel sits relative to the connection point */
  panelAnchor: "above" | "below";
}

/**
 * Hotspot definitions positioned as percentages of the 1200×630 badge viewBox.
 * Each hotspot is an invisible region that reveals a tooltip on hover/focus.
 * All hotspots have `leaderLine` for desktop and fall back to InfoTooltip on mobile.
 *
 * Coordinates derived from the badge SVG viewBox (1200×630).
 * Convert: left = pixelX/1200, top = pixelY/630, etc.
 *
 * Key SVG anchors:
 *   PAD=60  metaRowY=160  heatmap=(60,190)  radarCenter=(870,275)
 *   scoreCenter=(870,460) r=46  tierY≈530  footerY=585  verifyX=1145
 */
interface Hotspot {
  id: string;
  tooltip: string;
  position: "top" | "bottom";
  top: string;
  left: string;
  width: string;
  height: string;
  leaderLine: LeaderLineConfig;
}

const HOTSPOTS: Hotspot[] = [
  {
    id: "badge-archetype",
    tooltip:
      "Your developer archetype based on which dimension is strongest. Six types: Builder, Guardian, Marathoner, Polymath, Balanced, Emerging.",
    position: "bottom",
    // Pill at x=60, y=143, ~170×34 → center (144, 159)
    top: "22.5%",
    left: "5%",
    width: "14%",
    height: "5.5%",
    leaderLine: {
      path: "M 144 159 C 128 80 90 0 60 -88",
      panelTop: "-14%",
      panelLeft: "5%",
      panelAnchor: "above",
    },
  },
  {
    id: "badge-watchers",
    tooltip: "People watching your repositories for updates.",
    position: "bottom",
    // Pill after archetype + dot separator → center (312, 159)
    top: "22.5%",
    left: "21%",
    width: "10%",
    height: "5.5%",
    leaderLine: {
      path: "M 312 159 C 305 80 290 0 276 -88",
      panelTop: "-14%",
      panelLeft: "23%",
      panelAnchor: "above",
    },
  },
  {
    id: "badge-forks",
    tooltip: "Times others forked your repositories.",
    position: "bottom",
    // center (450, 159)
    top: "22.5%",
    left: "33%",
    width: "9%",
    height: "5.5%",
    leaderLine: {
      path: "M 450 159 C 455 80 462 0 468 -88",
      panelTop: "-14%",
      panelLeft: "39%",
      panelAnchor: "above",
    },
  },
  {
    id: "badge-stars",
    tooltip:
      "Stars received on your repos \u2014 not repos you\u2019ve starred.",
    position: "bottom",
    // center (594, 159)
    top: "22.5%",
    left: "44%",
    width: "11%",
    height: "5.5%",
    leaderLine: {
      path: "M 594 159 C 610 80 640 0 660 -88",
      panelTop: "-14%",
      panelLeft: "55%",
      panelAnchor: "above",
    },
  },
  {
    id: "badge-heatmap",
    tooltip:
      "Contribution activity over the last 90 days. Darker cells = more contributions that day.",
    position: "top",
    // Grid at x=60, y=190, 622×328 → bottom-center (372, 517)
    top: "30%",
    left: "5%",
    width: "52%",
    height: "52%",
    leaderLine: {
      // Curve down from bottom edge center
      path: "M 372 517 C 365 580 348 640 336 688",
      panelTop: "109%",
      panelLeft: "28%",
      panelAnchor: "below",
    },
  },
  {
    id: "badge-radar",
    tooltip:
      "Your four-dimension profile as a diamond. Each axis is one dimension. Larger shape = stronger scores.",
    position: "top",
    // Center (870,275) r=85 → center (864, 277)
    top: "28%",
    left: "63%",
    width: "18%",
    height: "32%",
    leaderLine: {
      path: "M 864 277 C 880 180 920 40 948 -88",
      panelTop: "-14%",
      panelLeft: "79%",
      panelAnchor: "above",
    },
  },
  {
    id: "badge-score",
    tooltip:
      "Your adjusted composite impact score (0\u2013100), averaged from four dimensions and adjusted by confidence.",
    position: "top",
    // Ring center (870,460) r=46 → center (864, 458)
    top: "65%",
    left: "68%",
    width: "8%",
    height: "15%",
    leaderLine: {
      path: "M 864 458 C 850 530 780 620 720 688",
      panelTop: "109%",
      panelLeft: "60%",
      panelAnchor: "below",
    },
  },
  {
    id: "badge-tier",
    tooltip:
      "Impact tier: Emerging (0\u201339), Solid (40\u201369), High (70\u201384), Elite (85\u2013100).",
    position: "top",
    // Label at (870, ~530) → center (864, 524)
    top: "80%",
    left: "67%",
    width: "10%",
    height: "7%",
    leaderLine: {
      path: "M 864 524 C 880 570 920 630 960 688",
      panelTop: "109%",
      panelLeft: "80%",
      panelAnchor: "below",
    },
  },
  {
    id: "badge-verification",
    tooltip:
      "Cryptographic seal proving these scores haven\u2019t been tampered with.",
    position: "top",
    // Strip at x=1145-1190, y=30-600 → center (1164, 315)
    top: "5%",
    left: "95%",
    width: "4%",
    height: "90%",
    leaderLine: {
      path: "M 1164 315 C 1158 200 1148 50 1140 -88",
      panelTop: "-14%",
      panelLeft: "95%",
      panelAnchor: "above",
    },
  },
  {
    id: "badge-github",
    tooltip:
      "Chapa uses public GitHub metrics. GitHub is not affiliated with or endorsing this project.",
    position: "top",
    // Footer: GitHub logo+text at x=60, y≈575 → center (156, 589)
    top: "90%",
    left: "4%",
    width: "18%",
    height: "7%",
    leaderLine: {
      // Curve left instead of down to avoid overlapping the embed section
      path: "M 156 589 C 80 580 0 560 -60 536",
      panelTop: "85%",
      panelLeft: "-5%",
      panelAnchor: "above",
    },
  },
];

/** Extract the starting point (M x y) from an SVG path `d` string. */
function parsePathStart(d: string): { cx: string; cy: string } {
  const mx = d.match(/^M\s+(\d+)/)?.[1] ?? "0";
  const my = d.match(/^M\s+\d+\s+(\d+)/)?.[1] ?? "0";
  return { cx: mx, cy: my };
}

export function BadgeOverlay() {
  const [activeLeaderLine, setActiveLeaderLine] = useState<string | null>(null);

  // Lazy lookup: only resolve the active hotspot's data when needed (#323)
  const activeHotspot = activeLeaderLine
    ? HOTSPOTS.find((h) => h.id === activeLeaderLine)
    : null;

  return (
    <div
      className="absolute inset-0 z-10 group/badge"
      style={{ overflow: "visible" }}
      role="group"
      aria-label="Badge element tooltips"
    >
      {/* ── Desktop: animated leader line paths (hidden on mobile) ── */}
      {/* Only the active hotspot's line + dot renders (#323 — lazy render) */}
      <svg
        id="leader-lines-svg"
        className="hidden md:block absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1200 630"
        style={{ overflow: "visible" }}
        aria-hidden="true"
      >
        {activeHotspot && (() => {
          const { cx, cy } = parsePathStart(activeHotspot.leaderLine.path);
          return (
            <g key={activeHotspot.id}>
              <path
                d={activeHotspot.leaderLine.path}
                fill="none"
                stroke="var(--color-amber)"
                strokeWidth="1.5"
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={0}
                opacity={0.8}
                style={{
                  transition:
                    "stroke-dashoffset 0.5s ease-out, opacity 0.15s ease-out",
                }}
              />
              <circle
                cx={cx}
                cy={cy}
                r="4"
                fill="var(--color-amber)"
                opacity={0.9}
                style={{ transition: "opacity 0.15s ease-out" }}
              />
            </g>
          );
        })()}
      </svg>

      {/* ── Desktop: leader line annotation panel (hidden on mobile) ── */}
      {/* Only the active hotspot's panel renders (#323 — lazy render) */}
      <div className="hidden md:contents">
        {activeHotspot && (() => {
          const isAbove = activeHotspot.leaderLine.panelAnchor === "above";
          return (
            <div
              key={`panel-${activeHotspot.id}`}
              role="tooltip"
              id={`${activeHotspot.id}-panel`}
              className="absolute z-20 max-w-[220px] rounded-lg bg-card/95 backdrop-blur-xl border border-stroke shadow-lg shadow-black/20 p-3 text-xs text-text-secondary font-body leading-relaxed pointer-events-none transition-all duration-300 ease-out opacity-100 translate-y-0"
              style={{
                top: activeHotspot.leaderLine.panelTop,
                left: activeHotspot.leaderLine.panelLeft,
                transform: isAbove
                  ? "translate(-50%, -100%)"
                  : "translate(-50%, 0%)",
                transitionDelay: "0.35s",
              }}
            >
              <span className="text-amber font-heading text-[10px] uppercase tracking-wider block mb-1">
                {activeHotspot.id.replace("badge-", "")}
              </span>
              {activeHotspot.tooltip}
            </div>
          );
        })()}
      </div>

      {/* ── Hotspot regions ── */}
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
          onMouseEnter={() => setActiveLeaderLine(hotspot.id)}
          onMouseLeave={() => setActiveLeaderLine(null)}
          onFocus={() => setActiveLeaderLine(hotspot.id)}
          onBlur={() => setActiveLeaderLine(null)}
          tabIndex={0}
          aria-describedby={`${hotspot.id}-panel`}
          aria-label={`${hotspot.id.replace("badge-", "")} info`}
        >
          {/* Mobile: standard InfoTooltip (hidden on desktop via md:hidden) */}
          <InfoTooltip
            id={hotspot.id}
            content={hotspot.tooltip}
            position={hotspot.position}
            className={`opacity-0 group-hover/badge:opacity-100 transition-opacity duration-300 md:hidden`}
          />
        </div>
      ))}
    </div>
  );
}
