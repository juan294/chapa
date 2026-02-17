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

  describe("a11y: badge link aria-label (#334)", () => {
    it("uses aria-label on the badge SVG link", () => {
      expect(SOURCE).toContain("aria-label={`View badge SVG for ${user.handle}`}");
    });

    it("keeps title for tooltip", () => {
      expect(SOURCE).toContain('title="View badge SVG"');
    });
  });

  describe("a11y: h1 heading in loading and error states (#364)", () => {
    it("loading state contains an <h1> element", () => {
      // The loading branch (if (loading)) must include an <h1> so screen
      // readers have a heading landmark. We locate the loading block by
      // finding the section between "Loading state" and "Error state" comments.
      const loadingBlock = SOURCE.match(
        /\/\/ Loading state[\s\S]*?\/\/ [-]+\s*\n\s*\/\/ Error state/,
      );
      expect(loadingBlock).not.toBeNull();
      expect(loadingBlock![0]).toMatch(/<h1[\s>]/);
    });

    it("error state contains an <h1> element", () => {
      // The error branch (if (error)) must include an <h1> so screen
      // readers have a heading landmark. We locate the error block by
      // finding the section between "Error state" and "Dashboard" comments.
      const errorBlock = SOURCE.match(
        /\/\/ Error state[\s\S]*?\/\/ [-]+\s*\n\s*\/\/ Dashboard/,
      );
      expect(errorBlock).not.toBeNull();
      expect(errorBlock![0]).toMatch(/<h1[\s>]/);
    });

    it("loading and error h1 use font-heading class", () => {
      const loadingBlock = SOURCE.match(
        /\/\/ Loading state[\s\S]*?\/\/ [-]+\s*\n\s*\/\/ Error state/,
      );
      const errorBlock = SOURCE.match(
        /\/\/ Error state[\s\S]*?\/\/ [-]+\s*\n\s*\/\/ Dashboard/,
      );
      expect(loadingBlock).not.toBeNull();
      expect(errorBlock).not.toBeNull();

      // Extract <h1 ...> tags from each block
      const loadingH1 = loadingBlock![0].match(/<h1[^>]*>/);
      const errorH1 = errorBlock![0].match(/<h1[^>]*>/);
      expect(loadingH1).not.toBeNull();
      expect(errorH1).not.toBeNull();
      expect(loadingH1![0]).toContain("font-heading");
      expect(errorH1![0]).toContain("font-heading");
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
