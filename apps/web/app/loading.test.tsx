import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "loading.tsx"),
  "utf-8",
);

describe("Root loading.tsx — structure", () => {
  it("has terminal window chrome with title bar", () => {
    expect(SOURCE).toContain("Terminal window chrome");
    expect(SOURCE).toContain("Title bar");
  });

  it("has terminal body with command lines", () => {
    expect(SOURCE).toContain("Terminal body");
    expect(SOURCE).toContain("chapa init");
  });

  it("uses staggered animation delays for sequential reveal", () => {
    expect(SOURCE).toContain("[animation-delay:200ms]");
    expect(SOURCE).toContain("[animation-delay:400ms]");
    expect(SOURCE).toContain("[animation-delay:600ms]");
  });

  it("has a subtle loading indicator below the terminal", () => {
    expect(SOURCE).toContain("animate-shimmer");
  });

  it("uses select-none on prompt characters to prevent copy issues", () => {
    expect(SOURCE).toContain("select-none");
  });
});
