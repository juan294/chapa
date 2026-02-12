import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

describe("WebComponentExperiment", () => {
  // #122 — innerHTML XSS prevention
  describe("innerHTML XSS prevention", () => {
    it("escapes handle before interpolating into innerHTML", () => {
      // Must define an escape function
      expect(SOURCE).toContain("escapeAttr");
      // Must create a safe handle variable
      expect(SOURCE).toContain("safeHandle");
      // The innerHTML line must use safeHandle, not raw handle
      const innerHTMLLines = SOURCE.split("\n").filter(
        (l) => l.includes(".innerHTML") && l.includes("chapa-badge"),
      );
      expect(innerHTMLLines.length).toBeGreaterThan(0);
      for (const line of innerHTMLLines) {
        expect(line).toContain("safeHandle");
        expect(line).not.toMatch(/\$\{handle\}/);
      }
    });
  });
});
