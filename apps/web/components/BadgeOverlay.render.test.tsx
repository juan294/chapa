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
      (el) => el.getAttribute("tabindex") === "0",
    );
    expect(hotspots.length).toBe(11);
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

  it("shows leader line on focus", () => {
    const { container } = render(<BadgeOverlay />);
    const archetype = screen.getByLabelText("archetype info");
    fireEvent.focus(archetype);
    const svg = container.querySelector("#leader-lines-svg");
    expect(svg?.querySelector("path")).not.toBeNull();
  });

  it("hides leader line on blur", () => {
    const { container } = render(<BadgeOverlay />);
    const archetype = screen.getByLabelText("archetype info");
    fireEvent.focus(archetype);
    fireEvent.blur(archetype);
    const svg = container.querySelector("#leader-lines-svg");
    expect(svg?.querySelector("path")).toBeNull();
  });

  it("renders InfoTooltip for each hotspot", () => {
    render(<BadgeOverlay />);
    expect(screen.getByTestId("tooltip-badge-archetype")).toBeDefined();
    expect(screen.getByTestId("tooltip-badge-heatmap")).toBeDefined();
    expect(screen.getByTestId("tooltip-badge-github")).toBeDefined();
  });
});
