import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

describe("AdminPage", () => {
  describe("landmark accessibility (#287)", () => {
    it("has id='main-content' on the <main> element", () => {
      // The <main> element must have id="main-content" for skip-nav links
      expect(SOURCE).toMatch(/<main[^>]*id="main-content"/);
    });
  });

  describe("a11y: sr-only h1 heading (#421)", () => {
    it("has a screen-reader-only <h1> with 'Admin Dashboard' text", () => {
      // The admin page needs a static <h1> for screen readers so the page
      // has a heading landmark independent of client-side loading state.
      expect(SOURCE).toMatch(/<h1[^>]*className="sr-only"[^>]*>Admin Dashboard<\/h1>/);
    });
  });
});
