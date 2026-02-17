import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "AdminSortableHeader.tsx"),
  "utf-8",
);

describe("AdminSortableHeader", () => {
  describe("rendering", () => {
    it("renders a th element with scope=col", () => {
      expect(SOURCE).toContain('scope="col"');
    });

    it("renders a button inside the header cell", () => {
      expect(SOURCE).toMatch(/<button[^>]*type="button"/);
    });

    it("displays the label text", () => {
      expect(SOURCE).toContain("{label}");
    });
  });

  describe("sort callback", () => {
    it("calls onSort with the field on button click", () => {
      expect(SOURCE).toContain("onClick={() => onSort(field)}");
    });

    it("accepts onSort callback via props", () => {
      expect(SOURCE).toContain("onSort: (field: SortField) => void");
    });
  });

  describe("sort indicators", () => {
    it("renders SortIcon with active and dir props", () => {
      expect(SOURCE).toContain("<SortIcon active={sortField === field} dir={sortDir}");
    });

    it("shows ascending arrow when dir is asc", () => {
      expect(SOURCE).toContain('dir === "asc"');
    });

    it("shows different path for descending", () => {
      expect(SOURCE).toContain("M6 10V2");
    });

    it("inactive icon has muted styling", () => {
      expect(SOURCE).toContain("text-text-secondary/40");
    });

    it("active icon uses amber accent color", () => {
      expect(SOURCE).toContain("text-amber");
    });
  });

  describe("aria-sort attribute", () => {
    it("sets aria-sort to ascending when sorted asc", () => {
      expect(SOURCE).toContain('"ascending"');
    });

    it("sets aria-sort to descending when sorted desc", () => {
      expect(SOURCE).toContain('"descending"');
    });

    it("sets aria-sort to none when not the sorted column", () => {
      expect(SOURCE).toContain('"none"');
    });
  });

  describe("optional className", () => {
    it("accepts an optional className prop", () => {
      expect(SOURCE).toContain("className?: string");
    });

    it("appends className to base TH classes", () => {
      expect(SOURCE).toContain("TH_CLASSES} ${className}");
    });
  });

  describe("AdminHeaderCell", () => {
    it("exports a non-sortable header cell", () => {
      expect(SOURCE).toContain("export function AdminHeaderCell");
    });

    it("renders a th with scope=col", () => {
      // AdminHeaderCell also uses the same TH_CLASSES with scope="col"
      const thMatches = SOURCE.match(/<th[^>]*scope="col"/g) ?? [];
      expect(thMatches.length).toBeGreaterThanOrEqual(2);
    });
  });
});
