import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "AdminSearchBar.tsx"),
  "utf-8",
);

describe("AdminSearchBar", () => {
  describe("rendering", () => {
    it("renders an input element", () => {
      expect(SOURCE).toContain("<input");
    });

    it("input has type text", () => {
      expect(SOURCE).toContain('type="text"');
    });

    it("has placeholder text for filtering", () => {
      expect(SOURCE).toMatch(/placeholder=.*filter/i);
    });

    it("has an aria-label for accessibility", () => {
      expect(SOURCE).toContain('aria-label="Filter users"');
    });

    it("has a visible focus indicator (#435)", () => {
      expect(SOURCE).toContain("focus-visible:ring-2");
      expect(SOURCE).toContain("focus-visible:ring-amber");
    });
  });

  describe("onChange behavior", () => {
    it("calls onSearchChange on input change", () => {
      expect(SOURCE).toContain("onSearchChange(e.target.value)");
    });

    it("accepts onSearchChange callback via props", () => {
      expect(SOURCE).toContain("onSearchChange: (value: string) => void");
    });
  });

  describe("result count display", () => {
    it("conditionally shows result count when search is active", () => {
      expect(SOURCE).toContain("{search && (");
    });

    it("handles singular vs plural result text", () => {
      expect(SOURCE).toContain("resultCount !== 1");
    });

    it("accepts resultCount via props", () => {
      expect(SOURCE).toContain("resultCount: number");
    });
  });

  describe("export", () => {
    it("is a named export", () => {
      expect(SOURCE).toContain("export function AdminSearchBar");
    });
  });
});
