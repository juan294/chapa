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
  });
});
