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
});
