import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "VerifyForm.tsx"),
  "utf-8",
);

describe("VerifyForm", () => {
  describe("accessibility", () => {
    it("has role='alert' on the error message", () => {
      expect(SOURCE).toContain('role="alert"');
    });

    it("focus ring on input has sufficient opacity (#435)", () => {
      // ring-complement/50 provides better visibility than /20
      expect(SOURCE).toContain("ring-complement/50");
      expect(SOURCE).not.toContain("ring-complement/20");
    });
  });
});
