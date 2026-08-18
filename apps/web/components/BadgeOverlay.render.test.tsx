// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { BadgeOverlay } from "./BadgeOverlay";

vi.mock("./InfoTooltip", () => ({
  InfoTooltip: ({ id, content }: { id: string; content: string }) => (
    <span data-testid={`tooltip-${id}`}>{content}</span>
  ),
}));

afterEach(cleanup);

describe("BadgeOverlay", () => {
  it("renders the overlay container", () => {
    render(<BadgeOverlay />);
    expect(screen.getByRole("group", { name: "Badge element tooltips" })).toBeDefined();
  });

  it("renders SVG for leader lines", () => {
    const { container } = render(<BadgeOverlay />);
    expect(container.querySelector("#leader-lines-svg")).not.toBeNull();
  });

  it("renders all 11 hotspot regions", () => {
    render(<BadgeOverlay />);
    const hotspots = screen.getAllByRole("group").filter(
      (el) => el.getAttribute("aria-label")?.endsWith(" info"),
    );
    expect(hotspots.length).toBe(11);
  });

  // #1116 (UX-L2): these hotspots are structural annotation regions, not
  // widgets — no unique action lives behind focusing them, so they must be
  // excluded from the keyboard tab order. Screen reader users still get the
  // content via the always-present sr-only description (tested below),
  // which is reachable in reading order without requiring focus.
  it("hotspots are not focusable via Tab (#1116)", () => {
    render(<BadgeOverlay />);
    const hotspots = screen.getAllByRole("group").filter(
      (el) => el.getAttribute("aria-label")?.endsWith(" info"),
    );
    expect(hotspots.length).toBe(11);
    for (const hotspot of hotspots) {
      expect(hotspot.getAttribute("tabindex")).toBeNull();
      expect(hotspot.tabIndex).toBe(-1);
    }
  });

  it("hotspots have aria-label", () => {
    render(<BadgeOverlay />);
    expect(screen.getByLabelText("archetype info")).toBeDefined();
    expect(screen.getByLabelText("heatmap info")).toBeDefined();
    expect(screen.getByLabelText("radar info")).toBeDefined();
    expect(screen.getByLabelText("score info")).toBeDefined();
    expect(screen.getByLabelText("tier info")).toBeDefined();
  });

  it("shows leader line on hotspot hover", () => {
    const { container } = render(<BadgeOverlay />);
    const archetype = screen.getByLabelText("archetype info");
    fireEvent.mouseEnter(archetype);
    // After hover, SVG should contain a path element
    const svg = container.querySelector("#leader-lines-svg");
    expect(svg?.querySelector("path")).not.toBeNull();
    expect(svg?.querySelector("circle")).not.toBeNull();
  });

  it("hides leader line on mouse leave", () => {
    const { container } = render(<BadgeOverlay />);
    const archetype = screen.getByLabelText("archetype info");
    fireEvent.mouseEnter(archetype);
    fireEvent.mouseLeave(archetype);
    const svg = container.querySelector("#leader-lines-svg");
    expect(svg?.querySelector("path")).toBeNull();
  });

  // #1116 (UX-L2): onFocus/onBlur were removed along with tabIndex — the
  // hotspot can no longer receive DOM focus, so firing a synthetic focus
  // event must NOT reveal the leader line. Hover remains the reveal
  // mechanism (see "shows leader line on hotspot hover" above).
  it("does not show leader line on focus — hotspot is no longer focusable (#1116)", () => {
    const { container } = render(<BadgeOverlay />);
    const archetype = screen.getByLabelText("archetype info");
    fireEvent.focus(archetype);
    const svg = container.querySelector("#leader-lines-svg");
    expect(svg?.querySelector("path")).toBeNull();
  });

  it("renders InfoTooltip for each hotspot", () => {
    render(<BadgeOverlay />);
    expect(screen.getByTestId("tooltip-badge-archetype")).toBeDefined();
    expect(screen.getByTestId("tooltip-badge-heatmap")).toBeDefined();
    expect(screen.getByTestId("tooltip-badge-github")).toBeDefined();
  });

  // W5 — BadgeOverlay desktop tooltip SR announcement
  // Each hotspot must have a permanently-present sr-only description element
  // so aria-describedby always resolves, even before hover/focus activates the
  // leader-line panel and regardless of viewport breakpoint.
  it("each hotspot has a sr-only description element in DOM before any interaction", () => {
    const { container } = render(<BadgeOverlay />);
    // archetype hotspot must have its description always in the DOM
    const archetypeDesc = container.querySelector(
      "#badge-archetype-desc",
    );
    expect(archetypeDesc).not.toBeNull();
    expect(archetypeDesc?.classList.contains("sr-only")).toBe(true);
    // heatmap description must also always be present
    const heatmapDesc = container.querySelector("#badge-heatmap-desc");
    expect(heatmapDesc).not.toBeNull();
    expect(heatmapDesc?.classList.contains("sr-only")).toBe(true);
  });

  it("each hotspot's aria-describedby always points to a present DOM element", () => {
    const { container } = render(<BadgeOverlay />);
    const hotspots = Array.from(
      container.querySelectorAll<HTMLElement>("[aria-describedby]"),
    );
    for (const hotspot of hotspots) {
      const describedById = hotspot.getAttribute("aria-describedby");
      expect(describedById).not.toBeNull();
      const referencedEl = container.querySelector(`#${describedById}`);
      expect(referencedEl).not.toBeNull();
    }
  });

  // #1116 (UX-L2): all 11 hotspots must be reachable by assistive tech via
  // reading order (sr-only description present, non-empty, no interaction
  // required) — this is precisely what makes it safe to drop them from the
  // keyboard tab order.
  it("all 11 hotspots have non-empty sr-only descriptions reachable without any interaction (#1116)", () => {
    const { container } = render(<BadgeOverlay />);
    const hotspots = screen.getAllByRole("group").filter(
      (el) => el.getAttribute("aria-label")?.endsWith(" info"),
    );
    expect(hotspots.length).toBe(11);
    for (const hotspot of hotspots) {
      const describedById = hotspot.getAttribute("aria-describedby");
      expect(describedById).toBeTruthy();
      const descEl = container.querySelector(`#${describedById}`);
      expect(descEl).not.toBeNull();
      expect(descEl?.classList.contains("sr-only")).toBe(true);
      expect(descEl?.textContent?.trim().length).toBeGreaterThan(0);
      // Not gated behind tabIndex/focus — the element is unfocusable and the
      // description is present at initial render.
      expect(hotspot.getAttribute("tabindex")).toBeNull();
    }
  });
});
