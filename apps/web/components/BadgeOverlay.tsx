"use client";

import { useState, useRef, useEffect, useMemo, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { InfoTooltip } from "./InfoTooltip";
import { useTranslation } from "@/lib/i18n";

interface Bounds { x: number; y: number; width: number; height: number }
interface HotspotBase {
  id: string;
  dictKey: string;
  labelKey: string;
  element: string;
  bounds: Bounds;
  position: "top" | "bottom";
  panelAnchor: "above" | "below";
}

// Initial Ice Terminal viewBox bounds; after hydration the actual SVG elements
// supply metric/label bounds, including translated text and variable pill widths.
const HOTSPOT_BASES: HotspotBase[] = ([
  ["archetype", "archetype", 60, 156, 134, 34, "above"],
  ["watchers", "watchers", 347, 156, 104, 34, "above"],
  ["forks", "forks", 479, 156, 97, 34, "above"],
  ["stars", "stars", 604, 156, 97, 34, "above"],
  ["heatmap", "activity", 60, 246, 544, 291, "below"],
  ["radar", "dimensions", 790, 210, 280, 190, "above"],
  ["score", "score", 884, 420, 92, 92, "below"],
  ["tier", "tier", 850, 519, 160, 24, "below"],
  ["verification", "verification", 1140, 30, 50, 570, "above"],
  ["craft", "craft", 785, 265, 60, 24, "above"],
  ["github", "platforms", 60, 580, 136, 30, "below"],
] as const).map(([key, element, x, y, width, height, panelAnchor]) => ({
  id: `badge-${key}`,
  dictKey: `badgeOverlay.${key}`,
  labelKey: `badgeOverlayLabels.${key}`,
  element,
  bounds: { x, y, width, height },
  position: panelAnchor === "above" ? "bottom" : "top",
  panelAnchor,
}));

interface PanelPosition { left: number; top: number; panelAnchor: "above" | "below" }

/** Position from the real transformed hotspot, never an unrotated percentage
 * of the enclosing badge's axis-aligned viewport rectangle. */
function computePanelPosition(base: HotspotBase, hotspotEl: HTMLElement): PanelPosition {
  const rect = hotspotEl.getBoundingClientRect();
  let panelAnchor = base.panelAnchor;
  if (panelAnchor === "above" && rect.top < 120) panelAnchor = "below";
  else if (panelAnchor === "below" && rect.bottom > window.innerHeight - 120 && rect.top >= 120) panelAnchor = "above";
  const halfWidth = Math.min(110, (window.innerWidth - 32) / 2);
  return {
    left: Math.max(halfWidth + 16, Math.min(rect.left + rect.width / 2, window.innerWidth - halfWidth - 16)),
    top: panelAnchor === "above" ? rect.top - 12 : rect.bottom + 12,
    panelAnchor,
  };
}

/** Transform a rendered SVG element's local box back into root viewBox space.
 * Root and target screen matrices share the same page rotation/scale, which
 * cancel here; CSS percentages then rotate with the badge exactly once. */
function elementBounds(svg: SVGSVGElement, target: SVGGraphicsElement): Bounds | null {
  const rootMatrix = svg.getScreenCTM?.();
  const targetMatrix = target.getScreenCTM?.();
  if (!rootMatrix || !targetMatrix || !target.getBBox) return null;
  const matrix = rootMatrix.inverse().multiply(targetMatrix);
  const box = target.getBBox();
  const points = [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]].map(([x, y]) => {
    const point = svg.createSVGPoint(); point.x = x!; point.y = y!;
    return point.matrixTransform(matrix);
  });
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

export function BadgeOverlay() {
  const [activeLeaderLine, setActiveLeaderLine] = useState<string | null>(null);
  const [panelPos, setPanelPos] = useState<PanelPosition | null>(null);
  const { t } = useTranslation();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<Record<string, Bounds>>({});
  const activeHotspotElRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const measure = () => {
      const svg = overlayRef.current?.parentElement?.querySelector<SVGSVGElement>("svg:not(#leader-lines-svg)");
      if (!svg || cancelled) return;
      const measured: Record<string, Bounds> = {};
      for (const base of HOTSPOT_BASES) {
        // The score hotspot covers the whole ring; its marker identifies text.
        if (base.element === "score") continue;
        let target = svg.querySelector<SVGGraphicsElement>(`[data-element="${base.element}"]`);
        if (base.element === "platforms") target = target?.querySelector<SVGGraphicsElement>("rect") ?? target;
        const box = target && elementBounds(svg, target);
        if (box && box.width > 0 && box.height > 0) measured[base.id] = box;
      }
      setBounds(measured);
    };
    measure();
    void document.fonts?.ready.then(measure);
    return () => { cancelled = true; };
  }, [t]);

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
      const hotspotEl = activeHotspotElRef.current;
      if (!hotspotEl) return;
      setPanelPos(computePanelPosition(activeBase, hotspotEl));
    };

    update();

    if (!activeBase) return;
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [activeBase, bounds]);

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
          const box = bounds[activeBase.id] ?? activeBase.bounds;
          const cx = box.x + box.width / 2;
          const cy = activeBase.panelAnchor === "above" ? box.y : box.y + box.height;
          const end = cy + (activeBase.panelAnchor === "above" ? -16 : 16);
          return (
            <g key={activeBase.id}>
              <path
                d={`M ${cx} ${cy} L ${cx} ${end}`}
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
              className="hidden md:block fixed z-[99999] max-w-[min(220px,calc(100vw-32px))] rounded-[3px] bg-card border border-stroke shadow-card p-3 text-xs text-text-secondary font-body leading-relaxed pointer-events-none transition-all duration-300 ease-out opacity-100 translate-y-0"
              style={{
                top: panelPos.top,
                left: panelPos.left,
                transform: panelPos.panelAnchor === "above"
                  ? "translate(-50%, -100%)"
                  : "translate(-50%, 0%)",
                transitionDelay: "0.35s",
              }}
            >
              <span className="text-amber-text font-heading text-[11px] uppercase tracking-wider block mb-1">
                {label}
              </span>
              {tooltip}
            </div>
          );
        })(),
        document.body,
      )}

      {/* ── Hotspot regions ── */}
      {/* #1116 (UX-L2): these 11 regions are structural annotations, not
          widgets — they perform no action, so they are intentionally left
          unfocusable and excluded from the keyboard tab order. Their content
          is already exposed to assistive tech via the always-present
          sr-only <span> below (aria-describedby), reachable in normal
          reading order without any interaction — so removing them from the
          tab order strands no screen-reader-only functionality. The
          keyboard focus/blur handlers that used to drive the desktop
          leader-line reveal were removed since they can no longer fire;
          hover (onMouseEnter/onMouseLeave) remains the desktop
          leader-line/panel reveal for sighted mouse users, and the
          InfoTooltip buttons cover touch and keyboard access at all viewport
          sizes without making the structural regions themselves tab stops. */}
      {HOTSPOT_BASES.map((hotspot) => {
        const tooltip = TOOLTIP_MAP[hotspot.id] ?? '';
        const box = bounds[hotspot.id] ?? hotspot.bounds;
        const activate = (e: SyntheticEvent<HTMLDivElement>) => {
          activeHotspotElRef.current = e.currentTarget;
          setActiveLeaderLine(hotspot.id);
        };
        return (
          <div
            key={hotspot.id}
            role="group"
            className="absolute flex items-center justify-center group-hover/badge:cursor-help rounded hover:bg-amber/5 transition-colors duration-150"
            style={{
              top: `${box.y / 630 * 100}%`,
              left: `${box.x / 1200 * 100}%`,
              width: `${box.width / 1200 * 100}%`,
              height: `${box.height / 630 * 100}%`,
            }}
            onMouseEnter={activate}
            onMouseLeave={() => setActiveLeaderLine(null)}
            aria-describedby={`${hotspot.id}-desc`}
            data-hotspot={hotspot.id}
            aria-label={`${t(hotspot.labelKey)} — ${t("aria.moreInfo")}`}
          >
            {/* Always-present sr-only description for screen readers (W5).
                aria-describedby must point to a DOM element that is always
                present — the lazy-rendered leader-line panel only exists while
                active, which is too late for the AT to read on focus. */}
            <span id={`${hotspot.id}-desc`} className="sr-only">
              {tooltip}
            </span>
            {/* One real tooltip control per explanation. On desktop it stays
                visually hidden until keyboard focus; mouse hover uses the
                larger leader-line panel. */}
            <InfoTooltip
              id={hotspot.id}
              content={tooltip}
              position={hotspot.position}
              className="opacity-0 group-hover/badge:opacity-100 focus-within:opacity-100 transition-opacity duration-300 md:group-hover/badge:opacity-0 md:pointer-events-none"
            />
          </div>
        );
      })}
    </div>
  );
}
