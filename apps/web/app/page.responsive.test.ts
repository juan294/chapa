import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

describe("mobile responsiveness (#240)", () => {
  it("main container uses responsive section spacing (space-y-16 md:space-y-24)", () => {
    expect(SOURCE).toContain("space-y-16 md:space-y-24");
  });

  it("main container uses responsive padding (pt-24 pb-20 md:pt-28 md:pb-32)", () => {
    expect(SOURCE).toContain("pt-24 pb-20 md:pt-28 md:pb-32");
  });

  it("hero h1 uses smaller text on mobile (text-3xl sm:text-4xl)", () => {
    expect(SOURCE).toContain("text-3xl sm:text-4xl");
  });

  it("feature list items use flex-col sm:flex-row (stack on mobile)", () => {
    expect(SOURCE).toContain("flex-col sm:flex-row");
  });

  it("feature labels use sm:w-48 without a bare w-44 class (no fixed width on mobile)", () => {
    expect(SOURCE).toContain("sm:w-48");
    expect(SOURCE).not.toMatch(/(?<!\S)w-44(?!\S)/);
  });

  it("enterprise labels also use flex-col sm:flex-row", () => {
    // There should be multiple instances of flex-col sm:flex-row (features + enterprise)
    const matches = SOURCE.match(/flex-col sm:flex-row/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });
});
