import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

describe("mobile responsiveness (#240)", () => {
  it("main container uses reduced mobile padding (px-4 sm:px-6)", () => {
    expect(SOURCE).toContain("px-4 sm:px-6");
  });

  it("main container uses reduced mobile vertical padding (pt-20 pb-16 sm:pt-24 sm:pb-24)", () => {
    expect(SOURCE).toContain("pt-20 pb-16 sm:pt-24 sm:pb-24");
  });

  it("embed code blocks use smaller font on mobile (text-xs sm:text-sm)", () => {
    expect(SOURCE).toContain("text-xs sm:text-sm");
  });
});
