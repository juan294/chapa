import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "BadgeToolbar.tsx"),
  "utf-8",
);

describe("BadgeToolbar", () => {
  describe("mobile responsiveness (#240)", () => {
    it("button class uses responsive padding (px-2 sm:px-3)", () => {
      expect(SOURCE).toContain("px-2 sm:px-3");
    });

    it("toolbar container uses flex-wrap to allow wrapping on small screens", () => {
      expect(SOURCE).toContain("flex-wrap");
    });

    it("share dropdown uses right-0 sm:left-0 sm:right-auto for mobile alignment", () => {
      expect(SOURCE).toContain("right-0 sm:left-0 sm:right-auto");
    });
  });

  describe("WCAG 2.5.8 touch target size (#370)", () => {
    it("toolbar button class includes min-h-[44px] for 44px minimum touch target", () => {
      // WCAG 2.5.8 recommends a minimum touch target size of 44×44 CSS pixels.
      // Toolbar buttons previously used px-2 py-2 producing ~32-36px height.
      expect(SOURCE).toContain("min-h-[44px]");
    });

    it("toolbar button class includes min-w-[44px] for 44px minimum touch target width", () => {
      // Square touch target ensures both width and height meet WCAG minimum.
      expect(SOURCE).toContain("min-w-[44px]");
    });
  });
});
