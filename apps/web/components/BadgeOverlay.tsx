"use client";

import { useState, useRef, useEffect, useMemo, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { InfoTooltip } from "./InfoTooltip";
import { useTranslation } from "@/lib/i18n";

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
interface HotspotBase {
  id: string;
  dictKey: string;
  /** Dictionary key for the desktop panel's uppercase heading (#1109 / UX-H3) — resolved via t(), never derived from `id`. */
  labelKey: string;
  position: "top" | "bottom";
  top: string;
  left: string;
  width: string;
  height: string;
  leaderLine: LeaderLineConfig;
}

const HOTSPOT_BASES: HotspotBase[] = [
  {
    id: "badge-archetype",
    dictKey: "badgeOverlay.archetype",
    labelKey: "badgeOverlayLabels.archetype",
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
    dictKey: "badgeOverlay.watchers",
    labelKey: "badgeOverlayLabels.watchers",
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
    dictKey: "badgeOverlay.forks",
    labelKey: "badgeOverlayLabels.forks",
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
    dictKey: "badgeOverlay.stars",
    labelKey: "badgeOverlayLabels.stars",
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
    dictKey: "badgeOverlay.heatmap",
    labelKey: "badgeOverlayLabels.heatmap",
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
    dictKey: "badgeOverlay.radar",
    labelKey: "badgeOverlayLabels.radar",
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
    dictKey: "badgeOverlay.score",
    labelKey: "badgeOverlayLabels.score",
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
    dictKey: "badgeOverlay.tier",
    labelKey: "badgeOverlayLabels.tier",
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
    dictKey: "badgeOverlay.verification",
    labelKey: "badgeOverlayLabels.verification",
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
    id: "badge-craft",
    dictKey: "badgeOverlay.craft",
    labelKey: "badgeOverlayLabels.craft",
    position: "top",
    // Pill at x=60, y=530, ~110×24 → center (115, 542)
    top: "84%",
    left: "5%",
    width: "9.5%",
    height: "4%",
    leaderLine: {
      path: "M 115 542 C 100 580 80 620 60 688",
      panelTop: "109%",
      panelLeft: "5%",
      panelAnchor: "below",
    },
  },
  {
    id: "badge-github",
    dictKey: "badgeOverlay.github",
    labelKey: "badgeOverlayLabels.github",
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

/** Live pixel position + resolved anchor for the portal-rendered desktop panel. */
interface PanelPosition {
  left: number;
  top: number;
  panelAnchor: "above" | "below";
}

/**
 * Converts a hotspot's viewBox-space `panelTop`/`panelLeft` percentages into
 * viewport-relative pixel coordinates via the overlay container's live
 * `getBoundingClientRect()` — the same conversion the browser already does
 * for CSS `top`/`left` percentages, just computed in JS so the result can be
 * handed to a `position: fixed` element portaled outside the container's
 * (transformed, animated) DOM subtree (#1069 / #1110).
 *
 * Mirrors InfoTooltip's `rect.top < 120` flip guard: an "above"-anchored
 * panel that would still clip above the viewport falls back to anchoring
 * below the hovered hotspot region itself, using that element's own rect.
 */
function computePanelPosition(
  base: HotspotBase,
  overlayEl: HTMLElement,
  hotspotEl: HTMLElement | null,
): PanelPosition {
  const overlayRect = overlayEl.getBoundingClientRect();
  const leftPct = parseFloat(base.leaderLine.panelLeft) / 100;
  const topPct = parseFloat(base.leaderLine.panelTop) / 100;
  const left = overlayRect.left + leftPct * overlayRect.width;
  let top = overlayRect.top + topPct * overlayRect.height;
  let panelAnchor = base.leaderLine.panelAnchor;

  if (panelAnchor === "above" && top < 120 && hotspotEl) {
    top = hotspotEl.getBoundingClientRect().bottom;
    panelAnchor = "below";
  }

  return { left, top, panelAnchor };
}

export function BadgeOverlay() {
  const [activeLeaderLine, setActiveLeaderLine] = useState<string | null>(null);
  const [panelPos, setPanelPos] = useState<PanelPosition | null>(null);
  const { t } = useTranslation();
  const overlayRef = useRef<HTMLDivElement>(null);
  // Only the currently-active hotspot's element is ever needed (for the
  // flip-guard fallback in computePanelPosition) — captured directly from
  // the triggering event's currentTarget in onMouseEnter/onFocus below,
  // rather than tracking every hotspot's ref in a Map.
  const activeHotspotElRef = useRef<HTMLDivElement | null>(null);

  // Build tooltip map from dictionary. Memoized on `t` (stable per locale)
  // since every hotspot's always-present sr-only description (below) needs
  // all 11 entries — unlike the panel heading, which only ever needs the
  // active hotspot's label and is resolved inline where it's used.
  const TOOLTIP_MAP: Record<string, string> = useMemo(
    () => Object.fromEntries(HOTSPOT_BASES.map((h) => [h.id, t(h.dictKey) as string])),
    [t],
  );

  // Lazy lookup: only resolve the active hotspot's data when needed (#323)
  const activeBase = activeLeaderLine
    ? HOTSPOT_BASES.find((h) => h.id === activeLeaderLine)
    : null;

  // Recompute the portal-rendered panel's live position whenever the active
  // hotspot changes, and keep it pinned while active on scroll/resize —
  // same pattern as InfoTooltip's own position effect (design-system.md
  // mandatory tooltip pattern).
  useEffect(() => {
    const update = () => {
      if (!activeBase) {
        setPanelPos(null);
        return;
      }
      const overlayEl = overlayRef.current;
      if (!overlayEl) return;
      setPanelPos(computePanelPosition(activeBase, overlayEl, activeHotspotElRef.current));
    };

    update();

    if (!activeBase) return;
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [activeBase]);

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 z-10 group/badge"
      style={{ overflow: "visible" }}
      role="group"
      aria-label={t('aria.badgeTooltips') as string}
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
        {activeBase && (() => {
          const { cx, cy } = parsePathStart(activeBase.leaderLine.path);
          return (
            <g key={activeBase.id}>
              <path
                d={activeBase.leaderLine.path}
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

      {/* leader line annotation panel (hidden on mobile) */}
      {/* Only the active hotspot's panel renders (#323 — lazy render).
          Portal-rendered to document.body with position: fixed, viewport
          coordinates from computePanelPosition()/getBoundingClientRect(),
          and z-index 99999 (design-system.md mandatory tooltip pattern —
          #1069 / #1110). This escapes the badge preview's transformed,
          animated `animate-scale-in` ancestor and its `z-10` stacking
          context, both of which previously defeated the panel's `absolute`
          positioning and made its z-[99999] ineffective against the fixed
          navbar. `hidden md:block` keeps it desktop-only even though the
          portal target (document.body) sits outside this component's own
          `md:` tree. */}
      {activeBase && panelPos && createPortal(
        (() => {
          const tooltip = TOOLTIP_MAP[activeBase.id] ?? '';
          // Resolved inline (not via a full id→label map) — only the active
          // hotspot's label is ever needed, matching the lazy-render intent
          // above (#323).
          const label = t(activeBase.labelKey) as string;
          return (
            <div
              key={`panel-${activeBase.id}`}
              role="tooltip"
              id={`${activeBase.id}-panel`}
              className="hidden md:block fixed z-[99999] max-w-[220px] rounded-lg bg-card/95 backdrop-blur-xl border border-stroke shadow-lg shadow-black/20 p-3 text-xs text-text-secondary font-body leading-relaxed pointer-events-none transition-all duration-300 ease-out opacity-100 translate-y-0"
              style={{
                top: panelPos.top,
                left: panelPos.left,
                transform: panelPos.panelAnchor === "above"
                  ? "translate(-50%, -100%)"
                  : "translate(-50%, 0%)",
                transitionDelay: "0.35s",
              }}
            >
              <span className="text-amber font-heading text-[10px] uppercase tracking-wider block mb-1">
                {label}
              </span>
              {tooltip}
            </div>
          );
        })(),
        document.body,
      )}

      {/* ── Hotspot regions ── */}
      {HOTSPOT_BASES.map((hotspot) => {
        const tooltip = TOOLTIP_MAP[hotspot.id] ?? '';
        const activate = (e: SyntheticEvent<HTMLDivElement>) => {
          activeHotspotElRef.current = e.currentTarget;
          setActiveLeaderLine(hotspot.id);
        };
        return (
          <div
            key={hotspot.id}
            role="group"
            tabIndex={0}
            className="absolute flex items-center justify-center group-hover/badge:cursor-help rounded hover:bg-amber/5 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-amber"
            style={{
              top: hotspot.top,
              left: hotspot.left,
              width: hotspot.width,
              height: hotspot.height,
            }}
            onMouseEnter={activate}
            onMouseLeave={() => setActiveLeaderLine(null)}
            onFocus={activate}
            onBlur={() => setActiveLeaderLine(null)}
            aria-describedby={`${hotspot.id}-desc`}
            aria-label={`${hotspot.id.replace("badge-", "")} info`}
          >
            {/* Always-present sr-only description for screen readers (W5).
                aria-describedby must point to a DOM element that is always
                present — the lazy-rendered leader-line panel only exists while
                active, which is too late for the AT to read on focus. */}
            <span id={`${hotspot.id}-desc`} className="sr-only">
              {tooltip}
            </span>
            {/* Mobile: standard InfoTooltip (hidden on desktop via md:hidden) */}
            <InfoTooltip
              id={hotspot.id}
              content={tooltip}
              position={hotspot.position}
              className={`opacity-0 group-hover/badge:opacity-100 transition-opacity duration-300 md:hidden`}
            />
          </div>
        );
      })}
    </div>
  );
}
