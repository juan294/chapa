// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

// Minimal InfoTooltip stub — avoids dependency on portal/positioning logic
vi.mock("./InfoTooltip", () => ({
  InfoTooltip: ({ content, id, className }: { content: string; id: string; className?: string }) => (
    <span data-testid={`tooltip-${id}`} className={className}>
      <button type="button" aria-label={`${id} explanation`}>{content}</button>
    </span>
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
  it("root element is a group labeled for badge tooltips", () => {
    render(<BadgeOverlay />);
    expect(
      screen.getByRole("group", { name: "Badge element tooltips" }),
    ).not.toBeNull();
  });

  it("leader lines SVG is aria-hidden", () => {
    const { container } = render(<BadgeOverlay />);
    const svg = container.querySelector("#leader-lines-svg");
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("aria-hidden")).toBe("true");
  });

  it("hotspots have sr-only description spans", () => {
    render(<BadgeOverlay />);
    const descSpan = document.getElementById("badge-archetype-desc");
    expect(descSpan).not.toBeNull();
    expect(descSpan!.className).toContain("sr-only");
  });

  it("hotspots use aria-describedby referencing an existing sr-only span", () => {
    render(<BadgeOverlay />);
    const hotspots = screen.getAllByRole("group").filter(
      (el) => el.getAttribute("aria-label")?.endsWith(" info"),
    );
    for (const hotspot of hotspots) {
      const describedById = hotspot.getAttribute("aria-describedby");
      expect(describedById).not.toBeNull();
      expect(document.getElementById(describedById!)).not.toBeNull();
    }
  });

  it("renders the leader line's circle at the path's parsed M x y start point", () => {
    const { container } = render(<BadgeOverlay />);
    const archetypeHotspot = screen
      .getAllByRole("group")
      .find((el) => el.getAttribute("aria-label") === "archetype info")!;

    fireEvent.mouseEnter(archetypeHotspot);

    // badge-archetype's leaderLine.path starts "M 144 159 ..."
    const circle = container.querySelector("circle");
    expect(circle).not.toBeNull();
    expect(circle!.getAttribute("cx")).toBe("144");
    expect(circle!.getAttribute("cy")).toBe("159");
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
      (el) => el.getAttribute("aria-label")?.endsWith(" info"),
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
      (el) => el.getAttribute("aria-label")?.endsWith(" info"),
    );

    fireEvent.mouseEnter(hotspots[0]!);
    expect(screen.queryByRole("tooltip")).not.toBeNull();

    fireEvent.mouseLeave(hotspots[0]!);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  // #1116 (UX-L2): hotspots are structural, non-actionable regions — 11 of
  // them were previously tabIndex={0}, adding 11 silent stops to the share
  // page's keyboard tab order before its real actions (toolbar, embed
  // snippet). onFocus/onBlur were removed along with tabIndex, so a
  // synthetic focus event must NOT reveal the panel — the element can no
  // longer receive real DOM focus either, since it's not part of the tab
  // order.
  it("does not activate the leader line panel on focus — hotspot is no longer focusable (#1116)", () => {
    render(<BadgeOverlay />);
    const hotspots = screen.getAllByRole("group").filter(
      (el) => el.getAttribute("aria-label")?.endsWith(" info"),
    );

    fireEvent.focus(hotspots[0]!);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("hotspots are excluded from the keyboard tab order (#1116)", () => {
    render(<BadgeOverlay />);
    const hotspots = screen.getAllByRole("group").filter(
      (el) => el.getAttribute("aria-label")?.endsWith(" info"),
    );
    expect(hotspots.length).toBe(11);
    for (const hotspot of hotspots) {
      expect(hotspot.getAttribute("tabindex")).toBeNull();
    }
  });

  it("keeps each explanation button available to desktop keyboard users", () => {
    render(<BadgeOverlay />);
    const explanationButtons = screen.getAllByRole("button", {
      name: / explanation$/,
    });
    expect(explanationButtons).toHaveLength(11);
    for (const button of explanationButtons) {
      expect(button.closest("span")?.className).not.toContain("md:hidden");
    }
  });

  it("switching between hotspots shows the correct tooltip content", () => {
    render(<BadgeOverlay />);
    const hotspots = screen.getAllByRole("group").filter(
      (el) => el.getAttribute("aria-label")?.endsWith(" info"),
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
      (el) => el.getAttribute("aria-label")?.endsWith(" info"),
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
      (el) => el.getAttribute("aria-label")?.endsWith(" info"),
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

  it('archetype hotspot tooltip text says "Seven types" (not Six)', () => {
    render(<BadgeOverlay />);
    const descSpan = document.getElementById("badge-archetype-desc");
    expect(descSpan).not.toBeNull();
    expect(descSpan!.textContent).toContain("Seven types");
    expect(descSpan!.textContent).not.toContain("Six types");
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

  it("every hotspot's panel heading resolves to a non-empty translated string, never the raw hotspot id", () => {
    render(<BadgeOverlay />);
    mockOverlayRect();
    const hotspots = screen.getAllByRole("group").filter(
      (el) => el.getAttribute("aria-label")?.endsWith(" info"),
    );
    expect(hotspots.length).toBe(11);

    for (const hotspot of hotspots) {
      // e.g. aria-label "archetype info" -> raw slug "archetype", the
      // buggy pre-#1109 heading (activeBase.id.replace("badge-", "")).
      const rawSlug = hotspot.getAttribute("aria-label")!.replace(" info", "");

      fireEvent.mouseEnter(hotspot);
      const panel = screen.getByRole("tooltip");
      const heading = panel.querySelector("span")!.textContent;
      expect(heading).toBeTruthy();
      expect(heading).not.toBe(rawSlug);
      expect(heading).not.toContain("badge-");
      fireEvent.mouseLeave(hotspot);
    }
  });
});
