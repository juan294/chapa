import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "Navbar.tsx"),
  "utf-8",
);

describe("Navbar", () => {
  describe("mobile responsiveness (#240)", () => {
    it("right controls container uses tighter gap on mobile (gap-1 sm:gap-2)", () => {
      expect(SOURCE).toContain("gap-1 sm:gap-2");
    });
  });
});
