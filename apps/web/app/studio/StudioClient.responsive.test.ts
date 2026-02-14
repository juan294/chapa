import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "StudioClient.tsx"),
  "utf-8",
);

describe("StudioClient", () => {
  describe("mobile responsiveness (#240)", () => {
    it("preview pane uses reduced horizontal padding on mobile (px-3 sm:px-4)", () => {
      expect(SOURCE).toContain("px-3 sm:px-4");
    });

    it("preview pane uses reduced vertical padding on mobile (py-4 sm:py-6)", () => {
      expect(SOURCE).toContain("py-4 sm:py-6");
    });

    it("terminal pane uses min-h-[50vh] for mobile min-height", () => {
      expect(SOURCE).toContain("min-h-[50vh]");
    });
  });
});
