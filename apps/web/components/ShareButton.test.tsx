import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "ShareButton.tsx"),
  "utf-8",
);

describe("ShareButton", () => {
  // Issue #18 — "use client" should be removed (purely presentational <a> tag)
  describe("server component (#18)", () => {
    it("does not have a 'use client' directive", () => {
      expect(SOURCE).not.toMatch(/^["']use client["']/m);
    });
  });
});
