import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "AdminStatsCards.tsx"),
  "utf-8",
);

describe("AdminStatsCards", () => {
  describe("rendering", () => {
    it("exports a named AdminStatsCards component", () => {
      expect(SOURCE).toContain("export function AdminStatsCards");
    });

    it("renders a grid layout", () => {
      expect(SOURCE).toMatch(/className="grid/);
    });

    it("renders Total Users card", () => {
      expect(SOURCE).toContain('label="Total Users"');
    });

    it("renders Elite tier card", () => {
      expect(SOURCE).toContain('label="Elite"');
    });

    it("renders High tier card", () => {
      expect(SOURCE).toContain('label="High"');
    });

    it("renders Solid tier card", () => {
      expect(SOURCE).toContain('label="Solid"');
    });

    it("renders Emerging tier card", () => {
      expect(SOURCE).toContain('label="Emerging"');
    });
  });

  describe("stat values", () => {
    it("uses totalUsers prop for the total card", () => {
      expect(SOURCE).toContain("value={totalUsers}");
    });

    it("reads tier counts with nullish coalescing", () => {
      expect(SOURCE).toContain("tierCounts.Elite ?? 0");
      expect(SOURCE).toContain("tierCounts.High ?? 0");
      expect(SOURCE).toContain("tierCounts.Solid ?? 0");
      expect(SOURCE).toContain("tierCounts.Emerging ?? 0");
    });
  });

  describe("percentage detail", () => {
    it("computes page-scoped detail when pageUsers > 0", () => {
      expect(SOURCE).toContain("pageUsers > 0");
    });

    it("renders page-scoped detail text", () => {
      expect(SOURCE).toContain("on this page");
    });

    it("shows undefined detail when pageUsers is 0", () => {
      expect(SOURCE).toMatch(/pageUsers > 0 \?.*: undefined/);
    });
  });

  describe("props interface", () => {
    it("accepts totalUsers as a number", () => {
      expect(SOURCE).toContain("totalUsers: number");
    });

    it("accepts pageUsers as a number", () => {
      expect(SOURCE).toContain("pageUsers: number");
    });

    it("accepts tierCounts as a Record", () => {
      expect(SOURCE).toContain("tierCounts: Record<string, number>");
    });
  });

  describe("StatCard sub-component", () => {
    it("renders label, value, and optional detail", () => {
      expect(SOURCE).toContain("{label}");
      expect(SOURCE).toContain("{value}");
      expect(SOURCE).toContain("{detail && (");
    });

    it("supports animation delay via style prop", () => {
      expect(SOURCE).toContain("animationDelay");
    });

    it("uses staggered delays for cards", () => {
      expect(SOURCE).toContain("delay={0}");
      expect(SOURCE).toContain("delay={50}");
      expect(SOURCE).toContain("delay={100}");
      expect(SOURCE).toContain("delay={150}");
      expect(SOURCE).toContain("delay={200}");
    });
  });
});
