// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { BadgeSkeleton } from "./BadgeSkeleton";

afterEach(cleanup);

describe("BadgeSkeleton", () => {
  it("renders without crashing", () => {
    const { container } = render(<BadgeSkeleton />);
    expect(container.firstChild).not.toBeNull();
  });

  it('has role="img" with aria-label "Loading badge..."', () => {
    render(<BadgeSkeleton />);
    const el = screen.getByRole("img", { name: "Loading badge..." });
    expect(el).toBeDefined();
  });

  it("has the shimmer animation class", () => {
    const { container } = render(<BadgeSkeleton />);
    const shimmer = container.querySelector(".animate-shimmer");
    expect(shimmer).not.toBeNull();
  });

  // The ratio now sits on the shared BadgeLoadingPlate inside the labelled
  // element; what matters is that the reserved box is still badge-shaped, so
  // the real SVG lands without shifting the page.
  it("maintains badge aspect ratio (aspect-[1200/630] class)", () => {
    render(<BadgeSkeleton />);
    const el = screen.getByRole("img", { name: "Loading badge..." });
    expect(el.querySelector(".aspect-\\[1200\\/630\\]")).not.toBeNull();
  });

  // Same plate as the route-level loading.tsx: the two fallbacks run back to
  // back and must not look like two different states.
  it("names what is happening", () => {
    render(<BadgeSkeleton />);
    expect(screen.getByText("Building the badge")).toBeDefined();
  });
});
