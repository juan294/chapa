import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "TierVisuals.tsx"),
  "utf-8",
);

describe("TierVisuals (#233)", () => {
  it("uses bg-amber-light instead of bg-[#9D8FFF]", () => {
    expect(SOURCE).not.toContain("bg-[#9D8FFF]");
    expect(SOURCE).toContain("bg-amber-light");
  });

  it("uses bg-amber instead of bg-[#7C6AEF]", () => {
    expect(SOURCE).not.toContain("bg-[#7C6AEF]");
    expect(SOURCE).toContain("bg-amber");
  });
});
