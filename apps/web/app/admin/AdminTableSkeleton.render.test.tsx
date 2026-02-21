// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { AdminTableSkeleton } from "./AdminTableSkeleton";

afterEach(cleanup);

describe("AdminTableSkeleton — render tests", () => {
  describe("rendering", () => {
    it("renders without crashing", () => {
      const { container } = render(<AdminTableSkeleton />);
      expect(container.firstChild).toBeDefined();
    });

    it("renders 5 stat card shimmer blocks", () => {
      const { container } = render(<AdminTableSkeleton />);
      // Stat card blocks are inside the grid
      const grid = container.querySelector(".grid");
      expect(grid).not.toBeNull();
      expect(grid!.children.length).toBe(5);
    });

    it("renders a search bar shimmer area", () => {
      const { container } = render(<AdminTableSkeleton />);
      // The search bar shimmer is inside a rounded-xl card container
      const cards = container.querySelectorAll(".rounded-xl.border");
      // 5 stat cards + 1 table card container
      expect(cards.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe("default row count", () => {
    it("renders 8 data rows by default", () => {
      const { container } = render(<AdminTableSkeleton />);
      // Data rows contain avatar circles (rounded-full)
      const avatars = container.querySelectorAll(".rounded-full");
      expect(avatars.length).toBe(8);
    });
  });

  describe("custom row count", () => {
    it("renders the specified number of data rows", () => {
      const { container } = render(<AdminTableSkeleton rowCount={3} />);
      const avatars = container.querySelectorAll(".rounded-full");
      expect(avatars.length).toBe(3);
    });

    it("renders 0 data rows when rowCount is 0", () => {
      const { container } = render(<AdminTableSkeleton rowCount={0} />);
      const avatars = container.querySelectorAll(".rounded-full");
      expect(avatars.length).toBe(0);
    });

    it("renders many rows when rowCount is large", () => {
      const { container } = render(<AdminTableSkeleton rowCount={20} />);
      const avatars = container.querySelectorAll(".rounded-full");
      expect(avatars.length).toBe(20);
    });
  });

  describe("accessibility", () => {
    it("marks the skeleton table as aria-hidden", () => {
      const { container } = render(<AdminTableSkeleton />);
      const hidden = container.querySelector('[aria-hidden="true"]');
      expect(hidden).not.toBeNull();
    });
  });

  describe("shimmer styling", () => {
    it("uses animate-pulse for shimmer effect", () => {
      const { container } = render(<AdminTableSkeleton />);
      const pulseElements = container.querySelectorAll(".animate-pulse");
      expect(pulseElements.length).toBeGreaterThan(0);
    });

    it("uses design system shimmer colors (bg-amber/10)", () => {
      const { container } = render(<AdminTableSkeleton />);
      // Check that amber shimmer classes are present in the DOM
      const amberElements = container.querySelectorAll('[class*="bg-amber"]');
      expect(amberElements.length).toBeGreaterThan(0);
    });
  });
});
