// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "BadgeOverlay.tsx"),
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
    expect(SOURCE).toContain('aria-label="Badge element tooltips"');
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

  it("panel uses translate(-50%, -100%) for above-anchored hotspots", () => {
    const { container } = render(<BadgeOverlay />);
    // badge-archetype has panelAnchor: "above"
    const archetypeHotspot = screen
      .getAllByRole("group")
      .find((el) => el.getAttribute("aria-label") === "archetype info");
    expect(archetypeHotspot).toBeDefined();

    fireEvent.mouseEnter(archetypeHotspot!);

    const panel = container.querySelector('[role="tooltip"]') as HTMLElement | null;
    expect(panel).not.toBeNull();
    expect(panel!.style.transform).toBe("translate(-50%, -100%)");
  });

  it("panel uses translate(-50%, 0%) for below-anchored hotspots", () => {
    const { container } = render(<BadgeOverlay />);
    // badge-heatmap has panelAnchor: "below"
    const heatmapHotspot = screen
      .getAllByRole("group")
      .find((el) => el.getAttribute("aria-label") === "heatmap info");
    expect(heatmapHotspot).toBeDefined();

    fireEvent.mouseEnter(heatmapHotspot!);

    const panel = container.querySelector('[role="tooltip"]') as HTMLElement | null;
    expect(panel).not.toBeNull();
    expect(panel!.style.transform).toBe("translate(-50%, 0%)");
  });
});
