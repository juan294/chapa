import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "ErrorBanner.tsx"),
  "utf-8",
);

describe("ErrorBanner", () => {
  describe("mobile responsiveness (#240)", () => {
    it("uses responsive gap (gap-2 sm:gap-3)", () => {
      expect(SOURCE).toContain("gap-2 sm:gap-3");
    });

    it("uses responsive padding (px-4 sm:px-6)", () => {
      expect(SOURCE).toContain("px-4 sm:px-6");
    });

    it("uses responsive text size (text-xs sm:text-sm)", () => {
      expect(SOURCE).toContain("text-xs sm:text-sm");
    });
  });
});
