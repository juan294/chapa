import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

describe("Landing page — Enterprise EMU section", () => {
  it("contains the $ chapa enterprise terminal command", () => {
    expect(SOURCE).toContain("chapa enterprise");
  });

  it("mentions GitHub Enterprise Managed Users", () => {
    expect(SOURCE).toMatch(/Enterprise Managed Users|EMU/);
  });

  it("references the chapa-cli package", () => {
    expect(SOURCE).toContain("chapa-cli");
  });

  it("includes the npx command for the CLI", () => {
    expect(SOURCE).toContain("npx chapa-cli");
  });

  it("follows the terminal output pattern with border-l border-stroke", () => {
    // The enterprise section output block should use the standard terminal pattern
    expect(SOURCE).toContain("border-l border-stroke");
  });

  it("uses animate-fade-in-up for the section", () => {
    // All terminal sections use this animation class
    expect(SOURCE).toContain("animate-fade-in-up");
  });

  it("is placed between features/how-it-works and stats sections", () => {
    const enterpriseIndex = SOURCE.indexOf("chapa enterprise");
    const featuresIndex = SOURCE.indexOf("chapa features");
    const statsIndex = SOURCE.indexOf("chapa stats");

    expect(enterpriseIndex).toBeGreaterThan(-1);
    expect(enterpriseIndex).toBeGreaterThan(featuresIndex);
    expect(enterpriseIndex).toBeLessThan(statsIndex);
  });
});
