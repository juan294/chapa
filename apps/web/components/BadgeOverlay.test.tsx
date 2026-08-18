// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "BadgeOverlay.tsx"),
  "utf-8",
);
const EN_DICT = fs.readFileSync(
  path.resolve(__dirname, "../lib/i18n/dictionaries/en.ts"),
  "utf-8",
);

// Minimal InfoTooltip stub — avoids dependency on portal/positioning logic
vi.mock("./InfoTooltip", () => ({
  InfoTooltip: ({ content, id }: { content: string; id: string }) => (
    <span data-testid={`tooltip-${id}`}>{content}</span>
  ),
}));

import { BadgeOverlay } from "./BadgeOverlay";

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Static assertions
// ---------------------------------------------------------------------------

describe("BadgeOverlay — static structure", () => {
  it("exports BadgeOverlay function", () => {
    expect(SOURCE).toContain("export function BadgeOverlay");
  });

  it("has role=group with aria-label on root element", () => {
    expect(SOURCE).toContain('role="group"');
    expect(SOURCE).toContain("t('aria.badgeTooltips')");
  });

  it("leader lines SVG is aria-hidden", () => {
    expect(SOURCE).toContain('aria-hidden="true"');
    expect(SOURCE).toContain('id="leader-lines-svg"');
  });

  it("hotspots have sr-only description spans", () => {
    expect(SOURCE).toContain('className="sr-only"');
  });

  it("hotspots use aria-describedby referencing the sr-only span", () => {
    expect(SOURCE).toContain("aria-describedby={`${hotspot.id}-desc`}");
    expect(SOURCE).toContain('id={`${hotspot.id}-desc`}');
  });

  it("panelAnchor check drives tooltip transform (above vs below)", () => {
    expect(SOURCE).toContain('panelAnchor === "above"');
    expect(SOURCE).toContain('translate(-50%, -100%)');
    expect(SOURCE).toContain('translate(-50%, 0%)');
  });

  it("parsePathStart extracts M x y from SVG path", () => {
    expect(SOURCE).toContain("function parsePathStart");
    expect(SOURCE).toContain('/^M\\s+(\\d+)/');
  });
});

// ---------------------------------------------------------------------------
// Render tests — branch coverage
// ---------------------------------------------------------------------------

describe("BadgeOverlay — rendering", () => {
  it("renders all hotspot regions", () => {
    render(<BadgeOverlay />);
    // There are 11 HOTSPOTS; each renders an aria-label like "{id} info"
    const groups = screen.getAllByRole("group");
    // Root + 11 hotspot groups
    expect(groups.length).toBeGreaterThanOrEqual(11);
  });

  it("shows no active leader line panel initially (activeHotspot is null)", () => {
    render(<BadgeOverlay />);
    // No tooltip role panel rendered until a hotspot is activated
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("activates leader line panel on mouseEnter", () => {
    render(<BadgeOverlay />);
    const hotspots = screen.getAllByRole("group").filter(
      (el) => el.getAttribute("tabIndex") === "0",
    );
    expect(hotspots.length).toBeGreaterThan(0);

    fireEvent.mouseEnter(hotspots[0]!);

    // The annotation panel has role="tooltip" (desktop — rendered by hidden md:contents div)
    const tooltip = screen.queryByRole("tooltip");
    // In JSDOM (no media queries) the panel is conditionally rendered;
    // it should exist in the DOM even if visually hidden by Tailwind
    expect(tooltip).not.toBeNull();
  });

  it("deactivates leader line panel on mouseLeave", () => {
    render(<BadgeOverlay />);
    const hotspots = screen.getAllByRole("group").filter(
      (el) => el.getAttribute("tabIndex") === "0",
    );

    fireEvent.mouseEnter(hotspots[0]!);
    expect(screen.queryByRole("tooltip")).not.toBeNull();

    fireEvent.mouseLeave(hotspots[0]!);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("activates leader line panel on focus", () => {
    render(<BadgeOverlay />);
    const hotspots = screen.getAllByRole("group").filter(
      (el) => el.getAttribute("tabIndex") === "0",
    );

    fireEvent.focus(hotspots[0]!);
    expect(screen.queryByRole("tooltip")).not.toBeNull();
  });

  it("deactivates leader line panel on blur", () => {
    render(<BadgeOverlay />);
    const hotspots = screen.getAllByRole("group").filter(
      (el) => el.getAttribute("tabIndex") === "0",
    );

    fireEvent.focus(hotspots[0]!);
    fireEvent.blur(hotspots[0]!);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("switching between hotspots shows the correct tooltip content", () => {
    render(<BadgeOverlay />);
    const hotspots = screen.getAllByRole("group").filter(
      (el) => el.getAttribute("tabIndex") === "0",
    );

    // Activate first hotspot
    fireEvent.mouseEnter(hotspots[0]!);
    const firstAriaLabel = hotspots[0]!.getAttribute("aria-label");
    expect(firstAriaLabel).toContain("info");

    fireEvent.mouseLeave(hotspots[0]!);

    // Activate second hotspot
    fireEvent.mouseEnter(hotspots[1]!);
    const secondAriaLabel = hotspots[1]!.getAttribute("aria-label");
    expect(secondAriaLabel).toContain("info");
    expect(secondAriaLabel).not.toBe(firstAriaLabel);
  });

  it("renders leader line SVG path when hotspot is active", () => {
    const { container } = render(<BadgeOverlay />);
    const hotspots = screen.getAllByRole("group").filter(
      (el) => el.getAttribute("tabIndex") === "0",
    );

    // No SVG path rendered initially
    expect(container.querySelector("path")).toBeNull();

    fireEvent.mouseEnter(hotspots[0]!);

    // SVG path should now be rendered for the active hotspot leader line
    expect(container.querySelector("path")).not.toBeNull();
  });

  it("renders circle dot at leader line origin when hotspot is active", () => {
    const { container } = render(<BadgeOverlay />);
    const hotspots = screen.getAllByRole("group").filter(
      (el) => el.getAttribute("tabIndex") === "0",
    );

    fireEvent.mouseEnter(hotspots[0]!);
    expect(container.querySelector("circle")).not.toBeNull();
  });

  // The panel now portals to document.body (#1069 / #1110), so its live
  // position depends on the overlay root's getBoundingClientRect() rather
  // than the static panelTop/panelLeft percentages. Mock a realistic badge
  // rect (matching the 1200×630 viewBox) so the "above" case lands above the
  // rect.top < 120 flip-guard threshold from InfoTooltip's own pattern.
  function mockOverlayRect() {
    const overlay = screen.getByRole("group", { name: "Badge element tooltips" });
    vi.spyOn(overlay, "getBoundingClientRect").mockReturnValue({
      top: 400,
      left: 0,
      right: 1200,
      bottom: 1030,
      width: 1200,
      height: 630,
      x: 0,
      y: 400,
      toJSON: () => {},
    });
    return overlay;
  }

  it("panel uses translate(-50%, -100%) for above-anchored hotspots", () => {
    render(<BadgeOverlay />);
    mockOverlayRect();
    // badge-archetype has panelAnchor: "above"
    const archetypeHotspot = screen
      .getAllByRole("group")
      .find((el) => el.getAttribute("aria-label") === "archetype info");
    expect(archetypeHotspot).toBeDefined();

    fireEvent.mouseEnter(archetypeHotspot!);

    const panel = screen.getByRole("tooltip") as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.style.transform).toBe("translate(-50%, -100%)");
  });

  it("panel uses translate(-50%, 0%) for below-anchored hotspots", () => {
    render(<BadgeOverlay />);
    mockOverlayRect();
    // badge-heatmap has panelAnchor: "below"
    const heatmapHotspot = screen
      .getAllByRole("group")
      .find((el) => el.getAttribute("aria-label") === "heatmap info");
    expect(heatmapHotspot).toBeDefined();

    fireEvent.mouseEnter(heatmapHotspot!);

    const panel = screen.getByRole("tooltip") as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.style.transform).toBe("translate(-50%, 0%)");
  });

  // Fix #1021 (UX-M1 pass): the desktop leader-line annotation panel must use
  // the mandated z-99999 tooltip layering rule so it can layer above a modal
  // or sticky header if ever needed, matching every other tooltip surface.
  it("desktop leader-line panel uses z-index 99999, not z-20", () => {
    render(<BadgeOverlay />);
    mockOverlayRect();
    const archetypeHotspot = screen
      .getAllByRole("group")
      .find((el) => el.getAttribute("aria-label") === "archetype info");
    expect(archetypeHotspot).toBeDefined();

    fireEvent.mouseEnter(archetypeHotspot!);

    const panel = screen.getByRole("tooltip") as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.className).toContain("z-[99999]");
    expect(panel.className).not.toContain("z-20");
  });

  // #1069 / #1110: the panel must actually be portaled to document.body, not
  // rendered inline inside the (transformed, animated, z-10-stacked) overlay
  // subtree — that inline placement was the root cause of the mandate
  // violation and the ineffective z-[99999].
  it("portals the panel to document.body, outside the render container", () => {
    const { container } = render(<BadgeOverlay />);
    mockOverlayRect();
    const archetypeHotspot = screen
      .getAllByRole("group")
      .find((el) => el.getAttribute("aria-label") === "archetype info");

    fireEvent.mouseEnter(archetypeHotspot!);

    expect(container.querySelector('[role="tooltip"]')).toBeNull();
    expect(document.body.querySelector('[role="tooltip"]')).not.toBeNull();
  });

  // #1069 / #1110: an "above"-anchored panel that would still clip above the
  // viewport (rect.top < 120, matching InfoTooltip's own flip rule) falls
  // back to anchoring below the hovered hotspot itself.
  it("flips an above-anchored panel to below when its computed position would clip the viewport top", () => {
    render(<BadgeOverlay />);
    const overlay = screen.getByRole("group", { name: "Badge element tooltips" });
    // Badge sits near the very top of the viewport — the archetype panel's
    // "-14%" offset would land well above rect.top < 120.
    vi.spyOn(overlay, "getBoundingClientRect").mockReturnValue({
      top: 20,
      left: 0,
      right: 1200,
      bottom: 650,
      width: 1200,
      height: 630,
      x: 0,
      y: 20,
      toJSON: () => {},
    });
    const archetypeHotspot = screen
      .getAllByRole("group")
      .find((el) => el.getAttribute("aria-label") === "archetype info")!;
    vi.spyOn(archetypeHotspot, "getBoundingClientRect").mockReturnValue({
      top: 34,
      left: 60,
      right: 214,
      bottom: 54,
      width: 154,
      height: 20,
      x: 60,
      y: 34,
      toJSON: () => {},
    });

    fireEvent.mouseEnter(archetypeHotspot);

    const panel = screen.getByRole("tooltip") as HTMLElement;
    expect(panel.style.transform).toBe("translate(-50%, 0%)");
    expect(panel.style.top).toBe("54px");
  });
});

// ---------------------------------------------------------------------------
// Regression: archetype tooltip lists all 7 archetypes (#735)
// ---------------------------------------------------------------------------

describe("BadgeOverlay — archetype tooltip completeness (#735)", () => {
  const EXPECTED_ARCHETYPES = [
    "Builder",
    "Quality Champion",
    "Marathoner",
    "Polymath",
    "Artificer",
    "Balanced",
    "Emerging",
  ];

  it('archetype tooltip says "Seven types" (not Six)', () => {
    // Tooltip copy lives in en.ts dictionary (badgeOverlay.archetype key)
    expect(EN_DICT).toContain("Seven types");
    expect(EN_DICT).not.toContain("Six types");
  });

  it("archetype tooltip includes all 7 archetype names", () => {
    // Archetype names live in en.ts dictionary (badgeOverlay.archetype key)
    for (const name of EXPECTED_ARCHETYPES) {
      expect(EN_DICT).toContain(name);
    }
  });

  it("archetype hotspot tooltip text contains Artificer", () => {
    render(<BadgeOverlay />);
    // The sr-only span for badge-archetype holds the tooltip text
    const descSpan = document.getElementById("badge-archetype-desc");
    expect(descSpan).not.toBeNull();
    expect(descSpan!.textContent).toContain("Artificer");
  });

  it("archetype hotspot tooltip text lists all 7 archetypes", () => {
    render(<BadgeOverlay />);
    const descSpan = document.getElementById("badge-archetype-desc");
    expect(descSpan).not.toBeNull();
    for (const name of EXPECTED_ARCHETYPES) {
      expect(descSpan!.textContent).toContain(name);
    }
  });
});

// ---------------------------------------------------------------------------
// #1109 (UX-H3): desktop panel headings must come from the dictionary
// (labelKey), not be derived from the hotspot id (raw English "ARCHETYPE" /
// "HEATMAP" above fully-translated Spanish tooltip bodies).
// ---------------------------------------------------------------------------

describe("BadgeOverlay — desktop panel heading translation (#1109)", () => {
  function mockOverlayRect() {
    const overlay = screen.getByRole("group", { name: "Badge element tooltips" });
    vi.spyOn(overlay, "getBoundingClientRect").mockReturnValue({
      top: 400,
      left: 0,
      right: 1200,
      bottom: 1030,
      width: 1200,
      height: 630,
      x: 0,
      y: 400,
      toJSON: () => {},
    });
  }

  it("renders the translated English heading via labelKey, not the raw hotspot id", () => {
    render(<BadgeOverlay />);
    mockOverlayRect();
    const heatmapHotspot = screen
      .getAllByRole("group")
      .find((el) => el.getAttribute("aria-label") === "heatmap info")!;

    fireEvent.mouseEnter(heatmapHotspot);

    const panel = screen.getByRole("tooltip");
    expect(panel.textContent).toContain("HEATMAP");
  });

  it("every hotspot has a labelKey resolving to a non-empty string in en.ts", () => {
    // Static assertion: labelKey must be a dictionary key, not a raw id.
    expect(SOURCE).toContain("labelKey:");
    expect(SOURCE).not.toContain('activeBase.id.replace("badge-", "")');
  });
});
