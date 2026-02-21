// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { AdminStatsCards } from "./AdminStatsCards";

afterEach(cleanup);

describe("AdminStatsCards — render tests", () => {
  const defaultProps = {
    totalUsers: 100,
    tierCounts: { Elite: 10, High: 30, Solid: 40, Emerging: 20 },
  };

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { container } = render(<AdminStatsCards {...defaultProps} />);
      expect(container.firstChild).toBeDefined();
    });

    it("renders all five stat cards", () => {
      render(<AdminStatsCards {...defaultProps} />);
      expect(screen.getByText("Total Users")).toBeDefined();
      expect(screen.getByText("Elite")).toBeDefined();
      expect(screen.getByText("High")).toBeDefined();
      expect(screen.getByText("Solid")).toBeDefined();
      expect(screen.getByText("Emerging")).toBeDefined();
    });
  });

  describe("total users card", () => {
    it("displays the totalUsers value", () => {
      render(<AdminStatsCards {...defaultProps} totalUsers={42} />);
      expect(screen.getByText("42")).toBeDefined();
    });

    it("displays zero when totalUsers is 0", () => {
      render(
        <AdminStatsCards totalUsers={0} tierCounts={{ Elite: 0, High: 0, Solid: 0, Emerging: 0 }} />,
      );
      // All 5 cards show "0" (totalUsers + 4 tier counts)
      expect(screen.getAllByText("0").length).toBe(5);
    });
  });

  describe("tier count values", () => {
    it("displays the correct Elite count", () => {
      render(<AdminStatsCards {...defaultProps} />);
      expect(screen.getByText("10")).toBeDefined();
    });

    it("displays the correct High count", () => {
      render(<AdminStatsCards {...defaultProps} />);
      expect(screen.getByText("30")).toBeDefined();
    });

    it("displays the correct Solid count", () => {
      render(<AdminStatsCards {...defaultProps} />);
      expect(screen.getByText("40")).toBeDefined();
    });

    it("displays the correct Emerging count", () => {
      render(<AdminStatsCards {...defaultProps} />);
      expect(screen.getByText("20")).toBeDefined();
    });

    it("falls back to 0 for missing tier counts", () => {
      render(<AdminStatsCards totalUsers={5} tierCounts={{}} />);
      // All tier cards should show 0 when the key is missing
      const zeros = screen.getAllByText("0");
      // 4 tier cards show 0, plus totalUsers shows 5
      expect(zeros.length).toBe(4);
    });
  });

  describe("percentage detail", () => {
    it("shows percentage for each tier when totalUsers > 0", () => {
      render(<AdminStatsCards {...defaultProps} />);
      expect(screen.getByText("10%")).toBeDefined();
      expect(screen.getByText("30%")).toBeDefined();
      expect(screen.getByText("40%")).toBeDefined();
      expect(screen.getByText("20%")).toBeDefined();
    });

    it("does not show percentage when totalUsers is 0", () => {
      render(
        <AdminStatsCards totalUsers={0} tierCounts={{ Elite: 0, High: 0, Solid: 0, Emerging: 0 }} />,
      );
      expect(screen.queryByText(/%/)).toBeNull();
    });

    it("rounds percentage to nearest integer", () => {
      render(
        <AdminStatsCards
          totalUsers={3}
          tierCounts={{ Elite: 1, High: 1, Solid: 1, Emerging: 0 }}
        />,
      );
      // 1/3 = 33.333... -> "33%" — appears for Elite, High, and Solid
      expect(screen.getAllByText("33%").length).toBe(3);
    });
  });

  describe("animation delays", () => {
    it("applies staggered animation delays to cards", () => {
      const { container } = render(<AdminStatsCards {...defaultProps} />);
      const cards = container.querySelectorAll(".animate-fade-in-up");
      expect(cards.length).toBe(5);

      // Check the delay values are staggered
      const delays = Array.from(cards).map((card) =>
        (card as HTMLElement).style.animationDelay,
      );
      expect(delays).toEqual(["0ms", "50ms", "100ms", "150ms", "200ms"]);
    });
  });
});
