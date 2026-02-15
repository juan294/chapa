import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "AdminDashboardClient.tsx"),
  "utf-8",
);

describe("AdminDashboardClient", () => {
  describe("sort event handler (#284)", () => {
    it("reads dir from custom event detail", () => {
      // The chapa:admin-sort handler must read an optional dir from the
      // event detail so the /sort command can specify asc/desc explicitly.
      expect(SOURCE).toMatch(/detail\?\.dir/);
    });

    it("applies dir directly when provided instead of toggling", () => {
      // When dir is provided, setSortDir should be called with it directly,
      // not via the toggle logic.
      expect(SOURCE).toMatch(/setSortDir\(dir\)/);
    });
  });

  describe("table header keyboard accessibility (#286)", () => {
    it("wraps sort text in <button> elements inside <th>", () => {
      // Each sortable <th> should contain a <button> for keyboard access
      expect(SOURCE).toMatch(/<th[^>]*>\s*<button/);
    });

    it("does not use onClick on <th> elements directly", () => {
      // onClick should be on the <button> inside <th>, not on <th> itself
      expect(SOURCE).not.toMatch(/<th[^>]*onClick/);
    });

    it("all <th> elements have scope='col'", () => {
      // Every <th> in the table header must have scope="col"
      const thMatches = SOURCE.match(/<th\b[^>]*>/g) ?? [];
      expect(thMatches.length).toBeGreaterThan(0);
      for (const th of thMatches) {
        expect(th).toContain('scope="col"');
      }
    });

    it("sorted column has aria-sort attribute", () => {
      // The currently sorted column should declare aria-sort
      expect(SOURCE).toMatch(/aria-sort/);
    });
  });

  describe("a11y: refresh button (#306)", () => {
    it("uses aria-label instead of title on the refresh button", () => {
      // The refresh button should use aria-label for screen reader text,
      // not title which is inconsistently read by screen readers.
      // Find the refresh button block (the one that calls fetchUsers(true))
      const refreshBtnMatch = SOURCE.match(/<button[\s\S]*?fetchUsers\(true\)[\s\S]*?>/);
      expect(refreshBtnMatch).not.toBeNull();
      const refreshBtn = refreshBtnMatch![0];
      expect(refreshBtn).toContain('aria-label=');
      expect(refreshBtn).not.toContain('title=');
    });
  });
});
