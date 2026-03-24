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

  it("maintains badge aspect ratio (aspect-[1200/630] class)", () => {
    render(<BadgeSkeleton />);
    const el = screen.getByRole("img", { name: "Loading badge..." });
    expect(el.className).toContain("aspect-[1200/630]");
  });
});
