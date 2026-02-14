import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "UserMenu.tsx"),
  "utf-8",
);

describe("mobile responsiveness (#240)", () => {
  it("dropdown has max-w-[calc(100vw-2rem)] to constrain to viewport", () => {
    expect(SOURCE).toContain("max-w-[calc(100vw-2rem)]");
  });
});
